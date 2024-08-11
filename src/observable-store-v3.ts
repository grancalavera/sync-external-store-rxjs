import { useSyncExternalStore } from "react";
import {
  dematerialize,
  firstValueFrom,
  Observable,
  ObservableNotification,
  shareReplay,
  Subscription,
} from "rxjs";

type Result<T> = Pending | Success<T> | Failure;
type Pending = { kind: "pending" };
type Success<T> = { kind: "success"; value: T };
type Failure = { kind: "failure"; error: unknown };

function materializeAndRetry<T>(maxRetries = 1) {
  return (source$: Observable<T>): Observable<ObservableNotification<T>> =>
    new Observable<ObservableNotification<T>>((observer) => {
      const subscription = new Subscription();
      let retryCount = 0;

      const subscribeToSource = () => {
        const sub = source$.subscribe({
          next(value: T) {
            retryCount = 0;
            observer.next({ kind: "N", value });
          },
          error(error) {
            observer.next({ kind: "E", error });
            retryCount++;
            if (retryCount < maxRetries) {
              subscribeToSource();
            } else {
              observer.error(error);
            }
          },
          complete() {
            retryCount = 0;
            observer.next({ kind: "C" });
            observer.complete();
          },
        });
        subscription.add(sub);
      };

      subscribeToSource();

      return () => {
        subscription.unsubscribe();
      };
    });
}

// https://react.dev/reference/react/useSyncExternalStore
export const createObservableStore = <T>(
  source$: Observable<T>
): [() => T, Observable<T>] => {
  const notifiers = new Set<() => void>();

  const sharedSource$ = source$.pipe(
    materializeAndRetry(),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  let promise: Promise<void> | undefined;
  let result: Result<T> = { kind: "pending" };
  let subscription: Subscription | undefined;

  const getSnapshot = () => {
    if (!promise) {
      result = { kind: "pending" };

      promise = firstValueFrom(sharedSource$).then((res) => {
        if (res.kind === "N") {
          result = { kind: "success", value: res.value };
        }

        if (res.kind === "E") {
          result = { kind: "failure", error: res.error };
        }
      });
    }

    if (result.kind === "pending") {
      throw promise;
    }

    if (result.kind === "failure") {
      notifiers.clear();
      throw result.error;
    }

    return result.value;
  };

  const subscribe = (notifier: () => void) => {
    notifiers.add(notifier);

    if (subscription === undefined) {
      subscription = sharedSource$.subscribe({
        next: (value) => {
          if (value.kind === "N") {
            result = { kind: "success", value: value.value };
          }

          if (value.kind === "E") {
            result = { kind: "failure", error: value.error };
          }

          notifiers.forEach((notify) => notify());
        },
      });
    }

    return () => {
      notifiers.delete(notifier);
      if (notifiers.size === 0) {
        subscription?.unsubscribe();
        subscription = undefined;
        promise = undefined;
      }
    };
  };

  return [
    () => useSyncExternalStore(subscribe, getSnapshot),
    sharedSource$.pipe(dematerialize()),
  ];
};
