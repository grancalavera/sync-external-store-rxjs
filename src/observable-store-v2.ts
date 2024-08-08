import { Observable, shareReplay, Subscription } from "rxjs";
import { createSuspender } from "./suspender";

type Notifier = () => void;
type State<T> = HasError | Empty | HasValue<T>;
type HasError = { kind: "error"; error: unknown };
type Empty = { kind: "empty" };
type HasValue<T> = { kind: "value"; value: T };

// https://react.dev/learn/passing-data-deeply-with-context
// https://react.dev/reference/react/use

/*
- El problema es que releaseSubscription solo se llama en el teardown del store.subscribe.
- React puede llamar al store.getSnapshot y no llegar nunca a llamar el store.subscribe.
- Esto pasa cuando hay suspense por el medio...
- Imaginate un componente que:
  - antes de que se monte,
  - hace un trigger de Suspense
  - y antes de que Suspense resuelva,
  - el usuario pulsa un botón que hace que este componente “se desmonte”
  - (que no se desmonta porque nunca se ha montado en primer lugar)
  - React va a descartar ese componente sin que releaseSubscription se llame
  - getSnapshot no puede crear subscripciones
  - al final [...] queda una subscripcion abierta sin que haya ningun componente que la esté referenciando

- The problem is that releaseSubscription is only called in the teardown of store.subscribe.
- React can call store.getSnapshot and never reach store.subscribe.
- This happens when there is suspense in between...
- Imagine a component that:
  - before it mounts,
  - triggers Suspense,
  - and before Suspense resolves,
  - the user clicks a button that causes this component to "unmount"
  - (which doesn't actually unmount because it was never mounted in the first place)
  - React will discard that component without calling releaseSubscription
  - getSnapshot cannot create subscriptions
  - in the end [...] there is an open subscription without any component referencing it
*/

export const createObservableStore = <T>(
  source$: Observable<T>,
  capture: (subscription: Subscription) => void
) => {
  let state: State<T> = { kind: "empty" };

  let suspendedSubscription: Subscription | undefined;
  let retainedSubscription: Subscription | undefined;

  const multicastSource$ = source$.pipe(
    shareReplay({ bufferSize: 1, refCount: true })
  );
  const subscribers = new Set<Notifier>();
  const suspender = createSuspender();

  const set = (value: T) => {
    state = { kind: "value", value };
  };

  const fail = (error: unknown) => {
    state = { kind: "error", error };
  };

  const reset = () => {
    state = { kind: "empty" };
  };

  const getSnapshot = (): T => {
    console.log("* getSnapshot", Date.now());

    if (state.kind === "empty") {
      suspendedSubscription = multicastSource$.subscribe({
        next: (value) => {
          set(value);
          suspender.resume();
        },
        error: (error) => {
          fail(error);
        },
      });
      capture(suspendedSubscription);
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
      releaseSubscription();
    };
  };

  const retainSubscription = () => {
    if (retainedSubscription === undefined && subscribers.size === 0) {
      retainedSubscription = multicastSource$.subscribe({
        next: (value) => {
          set(value);

          // the first time source$ emits a value after we suspended
          // we will always have 0 subscribers because the component
          // that triggered the getSnapshot will not be mounted yet.
          //
          // but if the component was discarded by React before it was mounted
          // we will have 0 subscribers and we will not call releaseSubscription
          // until source$ emits a value again, which could be never.
          //
          // if the source$ emits again we will have 0 subscribers and we will
          // call releaseSubscription and unsubscribe from source$.
          if (!suspender.isSuspended() && subscribers.size === 0) {
            releaseSubscription();
            return;
          }

          if (suspender.isSuspended()) {
            suspender.resume();
          }

          subscribers.forEach((notify) => notify());
        },
        error: (error) => {
          fail(error);
          subscribers.forEach((notify) => notify());
        },
      });
    }
  };

  const releaseSubscription = () => {
    console.log("** releaseSubscription", Date.now());
    if (retainedSubscription && subscribers.size === 0) {
      retainedSubscription.unsubscribe();
      retainedSubscription = undefined;
      state = { kind: "empty" };
    }
  };

  return {
    getSnapshot,
    subscribe,
  };
};
