import { Observable, Subscription, first, shareReplay } from "rxjs";
import { createSuspender } from "./suspender";

type StoreSubscriber = () => void;
const emptyCache = Symbol("emptyCache");
type EmptyCache = typeof emptyCache;

export const createObservableStore = <T>(source$: Observable<T>) => {
  const subscribers = new Set<StoreSubscriber>();
  const suspender = createSuspender();
  const innerSource$ = source$.pipe(shareReplay(1));

  let cache: T | EmptyCache = emptyCache;
  let subscription: Subscription | undefined;
  let cacheSubscription: Subscription | undefined;

  const getSnapshot = (): T => {
    if (cache === emptyCache) {
      cacheSubscription?.unsubscribe();
      cacheSubscription = innerSource$.pipe(first()).subscribe((count) => {
        cache = count;
        suspender.resume();
        subscribers.forEach((notify) => notify());
      });
      throw suspender.suspend();
    }

    return cache;
  };

  const subscribe = (onChange: StoreSubscriber) => {
    console.log("[lc] subscribe");
    innerSubscribe();
    subscribers.add(onChange);
    return () => {
      console.log("[lc] unsubscribe");
      subscribers.delete(onChange);
      innerUnsubscribe();
    };
  };

  const innerSubscribe = () => {
    if (subscribers.size === 0 && subscription === undefined) {
      subscription = innerSource$.subscribe((count) => {
        cache = count;
        subscribers.forEach((notify) => notify());
      });
    }
  };

  const innerUnsubscribe = () => {
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
