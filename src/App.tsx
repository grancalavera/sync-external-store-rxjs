import "modern-normalize/modern-normalize.css";
import React, {
  PropsWithChildren,
  Suspense,
  useState,
  useSyncExternalStore,
} from "react";
import { BehaviorSubject, Subject, map, merge, scan, shareReplay } from "rxjs";
import styles from "./main.module.css";
import { createObservableStore } from "./observable-store";

const increment$ = new Subject<void>();
const increment = () => increment$.next();

const reset$ = new BehaviorSubject<void>(undefined);
const reset = () => reset$.next();

const boom$ = new Subject<void>();
const boom = () => boom$.next();

const count$ = merge(
  reset$.pipe(map(() => "reset" as const)),
  increment$.pipe(map(() => "increment" as const)),
  boom$.pipe(map(() => "boom" as const))
).pipe(
  scan((count, action) => {
    if (action === "reset") return 0;
    if (action === "increment") return count + 1;
    if (action === "boom") throw new Error(`BOOM!`);
    return count;
  }, 0),
  shareReplay({ bufferSize: 1, refCount: true })
);

const store = createObservableStore(count$);
const useCount = () => useSyncExternalStore(store.subscribe, store.getSnapshot);

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
  const [hasError, setHasError] = useState(false);
  return (
    <Card>
      <button
        disabled={hasError}
        className={styles.button}
        onClick={() => setShow(!show)}
      >
        {show ? "hide" : "show"}
      </button>
      {show && (
        <ErrorBoundary
          onClose={() => {
            setShow(false);
            setHasError(false);
          }}
          onError={() => {
            setHasError(true);
          }}
        >
          <Suspense
            fallback={
              <button className={styles.button} disabled>
                ...
              </button>
            }
          >
            {children}
          </Suspense>
        </ErrorBoundary>
      )}
    </Card>
  );
};

const Counter = () => (
  <Toggle>
    <SyncExternalStore />
  </Toggle>
);

type ErrorBoundaryProps = PropsWithChildren<{
  onClose: () => void;
  onError: (error: unknown, info: unknown) => void;
}>;

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  { hasError: boolean; error?: unknown }
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, info: unknown) {
    this.props.onError(error, info);
  }

  render() {
    return (
      <>
        {this.state.hasError ? (
          <span className={styles.inline}>
            <button className={styles.button} disabled>
              boom!
            </button>
            <button
              className={styles.closeButton}
              onClick={() => this.props.onClose()}
            >
              x
            </button>
          </span>
        ) : (
          this.props.children
        )}
      </>
    );
  }
}

export const App = () => (
  <>
    <Card>
      <button className={styles.button} onClick={() => reset()}>
        reset
      </button>
      <button className={styles.button} onClick={() => boom()}>
        boom!
      </button>
    </Card>
    <Counter />
    <Counter />
  </>
);
