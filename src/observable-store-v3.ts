import { useContext, useSyncExternalStore } from "react";
import {
  firstValueFrom,
  Observable,
  ObservableNotification,
  shareReplay,
  Subscription,
} from "rxjs";
import { createSuspender } from "./suspender-v2";
import { CaptureContext } from "./observable-store-capture-v3";

type Result<T> = Pending | Success<T> | Failure;
type Pending = { kind: "pending" };
type Success<T> = { kind: "success"; value: T };
type Failure = { kind: "failure"; error: unknown };

function resubscribeOnComplete<T>() {
  return (source$: Observable<T>): Observable<T> =>
    new Observable<T>((observer) => {
      const outerSubscription = new Subscription();

      const subscribeToSource = () => {
        const innerSubscription = source$.subscribe({
          next(value: T) {
            observer.next(value);
          },
          error(error) {
            observer.error(error);
          },
          complete() {
            subscribeToSource();
          },
        });

        outerSubscription.add(innerSubscription);
      };

      subscribeToSource();

      return () => {
        outerSubscription.unsubscribe();
      };
    });
}

function materializeAndRetry<T>(maxRetries = 1) {
  return (source$: Observable<T>): Observable<ObservableNotification<T>> =>
    new Observable<ObservableNotification<T>>((observer) => {
      const outerSubscription = new Subscription();
      let retryCount = 0;

      const subscribeToSource = () => {
        const innerSubscription = source$.subscribe({
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

        outerSubscription.add(innerSubscription);
      };

      subscribeToSource();

      return () => {
        outerSubscription.unsubscribe();
      };
    });
}

// this probably doesn't have parity with react-rxjs
const state = <T>(source$: Observable<T>) =>
  source$.pipe(
    resubscribeOnComplete(),
    shareReplay({ bufferSize: 1, refCount: true })
  );

interface FirstValueFromConfig<T> {
  defaultValue: T;
}

export function firstValueFromAndSubscription<T, D>(
  source: Observable<T>,
  config: FirstValueFromConfig<D>
): [Promise<T | D>, Subscription];
export function firstValueFromAndSubscription<T>(
  source: Observable<T>
): [Promise<T>, Subscription];
export function firstValueFromAndSubscription<T, D>(
  source: Observable<T>,
  config?: FirstValueFromConfig<D>
): [Promise<T | D>, Subscription] {
  const hasConfig = typeof config === "object";
  const outerSubscription = new Subscription();

  const promise = new Promise<T | D>((resolve, reject) => {
    const innerSubscription = source.subscribe({
      next: (value: T) => {
        resolve(value);
        outerSubscription.unsubscribe();
      },
      error: reject,
      complete: () => {
        if (hasConfig) {
          resolve(config!.defaultValue);
        } else {
          const error = new Error("No elements in sequence.");
          error.name = "EmptyError";
          reject(error);
        }
      },
    });

    outerSubscription.add(innerSubscription);
  });

  return [promise, outerSubscription];
}

// https://react.dev/reference/react/useSyncExternalStore
export const createObservableStore = <T>(
  source$: Observable<T>
): [() => T, Observable<T>] => {
  const notifiers = new Set<() => void>();
  const state$ = state(source$);
  const materializedState$ = state$.pipe(materializeAndRetry());
  const suspender = createSuspender(materializedState$);

  let promise: Promise<void> | undefined;
  let result: Result<T> = { kind: "pending" };
  let subscription: Subscription | undefined;
  let capture:
    | ((key: Observable<unknown>, subscribe: () => Subscription) => void)
    | undefined;

  const getSnapshot = () => {
    if (!promise) {
      result = { kind: "pending" };
      console.log(capture, suspender);

      promise = firstValueFrom(materializedState$).then((res) => {
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
      subscription = materializedState$.subscribe({
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

  const useObservableStore = () => {
    capture = useContext(CaptureContext);
    return useSyncExternalStore(subscribe, getSnapshot);
  };

  return [useObservableStore, state$];
};
