import { Observable, Subscription } from "rxjs";
import { createSuspender } from "./suspender";

type Notifier = () => void;
type State<T> = HasError | Empty | HasValue<T>;
type HasError = { kind: "error"; error: unknown };
type Empty = { kind: "empty" };
type HasValue<T> = { kind: "value"; value: T };

export const createObservableStore = <T>(source$: Observable<T>) => {
  let state: State<T> = { kind: "empty" };
  let subscription: Subscription | undefined;

  const subscribers = new Set<Notifier>();
  const suspender = createSuspender();

  const set = (value: T) => {
    state = { kind: "value", value };
  };

  const fail = (error: unknown) => {
    state = { kind: "error", error };
  };

  const getSnapshot = (): T => {
    retainSubscription();

    if (state.kind === "empty") {
      throw suspender.suspend();
    }

    if (state.kind === "error") {
      throw state.error;
    }

    return state.value;
  };

  const subscribe = (notifier: Notifier) => {
    retainSubscription();
    subscribers.add(notifier);
    return () => {
      subscribers.delete(notifier);
      console.log("unsubscribe");
      releaseSubscription();
    };
  };

  const retainSubscription = () => {
    if (subscription === undefined && subscribers.size === 0) {
      subscription = source$.subscribe({
        next: (value) => {
          set(value);
          if (suspender.isSuspended()) {
            suspender.resume();
          }

          if (subscribers.size === 0) {
            releaseSubscription();
          } else {
            subscribers.forEach((notify) => notify());
          }
        },
        error: (error) => {
          fail(error);
          subscribers.forEach((notify) => notify());
        },
      });
    }
  };

  const releaseSubscription = () => {
    if (subscription && subscribers.size === 0) {
      subscription.unsubscribe();
      subscription = undefined;
    }
  };

  return {
    getSnapshot,
    subscribe,
  };
};
