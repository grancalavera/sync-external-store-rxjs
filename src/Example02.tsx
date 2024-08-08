import { memo, Suspense, useState, useSyncExternalStore } from "react";
import { finalize, interval, tap } from "rxjs";
import { createObservableStore } from "./observable-store-v2";

const source$ = interval(1500).pipe(
  tap((tick) => console.log("** still ticking...", tick)),
  finalize(() => console.log("** unsubscribed at ", Date.now()))
);
const store = createObservableStore(source$, () => {});
const useTick = () => useSyncExternalStore(store.subscribe, store.getSnapshot);

export const Ticker = memo(() => {
  const tick = useTick();
  return <div>{tick}</div>;
});

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
        <Suspense>
          <Ticker />
        </Suspense>
      )}
    </div>
  );
};
