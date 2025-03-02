import {
  createContext,
  PropsWithChildren,
  Suspense,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import { finalize, interval, Subscription, tap } from "rxjs";
import { createObservableStore, ObservableStore } from "./observable-store-v2";

type Capture = (x: Subscription) => void;
const Capture = createContext<Capture>(() => {});
const useCapture = () => useContext(Capture);

const Subscribe = (props: PropsWithChildren) => {
  const capturedSubscriptions = useRef<Subscription>();
  const capture = useRef<Capture>();

  if (!capturedSubscriptions.current) {
    capturedSubscriptions.current = new Subscription();
  }

  if (!capture.current) {
    capture.current = (subscription) => {
      capturedSubscriptions.current?.add(subscription);
    };
  }

  useEffect(() => {
    return () => {
      capturedSubscriptions.current?.unsubscribe();
      capturedSubscriptions.current = undefined;
    };
  }, []);

  return (
    <Capture.Provider value={capture.current}>
      <Suspense fallback="Loading...">{props.children}</Suspense>
    </Capture.Provider>
  );
};

const tick$ = interval(1500).pipe(
  tap((tick) => console.log("** still ticking...", tick)),
  finalize(() => console.log("** unsubscribed at ", Date.now()))
);

const useTick = () => {
  const capture = useCapture();
  const store = useRef<ObservableStore<number>>();
  if (!store.current) {
    store.current = createObservableStore(tick$, capture);
  }
  return useSyncExternalStore(
    store.current.subscribe,
    store.current.getSnapshot
  );
};

const Tick = () => {
  const tick = useTick();
  return <div>{tick}</div>;
};

export const Example03 = () => {
  return (
    <Subscribe>
      <Tick />
    </Subscribe>
  );
};
