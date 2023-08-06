/* eslint-disable react-refresh/only-export-components */
import "modern-normalize/modern-normalize.css";
import React, {
  PropsWithChildren,
  Suspense,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import ReactDOM from "react-dom/client";
import { Subject, scan, shareReplay } from "rxjs";
import styles from "./main.module.css";
import { createObservableStore } from "./observable-store";

const increment$ = new Subject<void>();
const increment = () => increment$.next();
const count$ = increment$.pipe(
  scan((x) => x + 1, 0),
  shareReplay(1)
);

const store = createObservableStore(count$);
const useCount = () => useSyncExternalStore(store.subscribe, store.getSnapshot);

const Naive = () => {
  const [count, setCount] = useState<number>();

  useEffect(() => {
    const subscription = count$.subscribe(setCount);
    return () => subscription.unsubscribe();
  }, []);

  return (
    <button className={styles.button} onClick={() => increment()}>
      {count === undefined ? "click to start counting" : count}
    </button>
  );
};

const SyncExternalStore = () => {
  const count = useCount();
  return (
    <button className={styles.button} onClick={() => increment()}>
      {count}
    </button>
  );
};

const Card = ({ children }: PropsWithChildren) => (
  <div className={styles.card}>{children}</div>
);

const Toggle = ({ children }: PropsWithChildren) => {
  const [show, setShow] = useState(false);
  return (
    <Card>
      <button className={styles.button} onClick={() => setShow(!show)}>
        {show ? "hide" : "show"}
      </button>
      {show && children}
    </Card>
  );
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Card>
      <Naive />
    </Card>

    <Toggle>
      <Suspense
        fallback={
          <button className={styles.button} disabled>
            ...
          </button>
        }
      >
        <SyncExternalStore />
      </Suspense>
    </Toggle>

    <Toggle>
      <Suspense
        fallback={
          <button className={styles.button} disabled>
            ...
          </button>
        }
      >
        <SyncExternalStore />
      </Suspense>
    </Toggle>
  </React.StrictMode>
);
