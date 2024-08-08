import {
  createContext,
  memo,
  PropsWithChildren,
  Suspense,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { finalize, interval, Subscription, tap } from "rxjs";
import { createObservableStore } from "./observable-store-v2";

const source$ = interval(1500).pipe(
  tap((tick) => console.log("** still ticking...", tick)),
  finalize(() => console.log("** unsubscribed at ", Date.now()))
);

const useTick = () => {
  const capture = useContext(Capture);
  const store = useRef(
    useMemo(() => {
      console.log("** creating store");
      return createObservableStore(source$, capture);
    }, [capture])
  );
  return useSyncExternalStore(
    store.current.subscribe,
    store.current.getSnapshot
  );
};

export const Ticker = memo(() => {
  const tick = useTick();
  return <div>{tick}</div>;
});

type Capture = (subscription: Subscription) => void;
const Capture = createContext<Capture>(() => {});

const Subscribe = (props: PropsWithChildren) => {
  const subscriptionRef = useRef<Subscription>(
    useMemo(() => new Subscription(), [])
  );

  const captureRef = useRef<Capture>(
    useMemo(
      () => (subscription) => {
        console.log("** capturing subscription");
        subscriptionRef.current.add(subscription);
      },
      []
    )
  );

  useEffect(() => {
    return () => {
      subscriptionRef.current.unsubscribe();
    };
  }, []);

  return (
    <Capture.Provider value={captureRef.current}>
      <Suspense>{props.children}</Suspense>
    </Capture.Provider>
  );
};

export const Example02 = () => {
  const [show, setShow] = useState(false);
  return (
    <div style={{ padding: 20 }}>
      <button
        onClick={() => {
          setShow((x) => !x);
        }}
      >
        {show ? "hide ticker" : "show ticker"}
      </button>
      {show && (
        <Subscribe>
          <Ticker />
        </Subscribe>
      )}
    </div>
  );
};
