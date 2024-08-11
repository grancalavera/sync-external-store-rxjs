import { CSSProperties, memo, Suspense, useSyncExternalStore } from "react";
import { ErrorBoundary, FallbackProps } from "react-error-boundary";
import {
  BehaviorSubject,
  combineLatest,
  dematerialize,
  firstValueFrom,
  map,
  Observable,
  ObservableNotification,
  shareReplay,
  Subscription,
  switchMap,
} from "rxjs";
import { fromFetch } from "rxjs/fetch";

type Result<T> = Pending | Success<T> | Failure;

type Pending = { kind: "pending" };
type Success<T> = { kind: "success"; value: T };
type Failure = { kind: "failure"; error: unknown };

type BlogPost = {
  userId: number;
  id: number;
  title: string;
  body: string;
};

function materializeAndRetry<T>() {
  return (source$: Observable<T>): Observable<ObservableNotification<T>> =>
    new Observable<ObservableNotification<T>>((observer) => {
      const subscription = new Subscription();

      const subscribeToSource = () => {
        const sub = source$.subscribe({
          next(value: T) {
            observer.next({ kind: "N", value });
          },
          error(error) {
            observer.next({ kind: "E", error });
            subscribeToSource();
          },
          complete() {
            observer.next({ kind: "C" });
            observer.complete();
          },
        });
        subscription.add(sub);
      };

      subscribeToSource();

      return () => subscription.unsubscribe();
    });
}
// https://react.dev/reference/react/useSyncExternalStore
const createObservableStore = <T,>(
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
      // Immediately before throwing, clear the notifiers and unsubscribe from the source
      // wait for the next render to resubscribe, but do not delete the promise yet because
      // otherwise the component will suspend again on the next `getSnapshot` call, which
      // will happen synchronously before the component is unmounted by the error boundary.
      notifiers.clear();
      subscription?.unsubscribe();
      subscription = undefined;
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

const selectedPostId$ = new BehaviorSubject(1);
const postError$ = new BehaviorSubject(false);

const [useSelectedPostId, selected$] = createObservableStore(selectedPostId$);
const [usePostError, error$] = createObservableStore(postError$);
const [usePost, post$] = createObservableStore(
  selectedPostId$.pipe(
    switchMap((id) => {
      if (![1, 2, 3].includes(id)) {
        throw new Error("Invalid post ID: " + id);
      }

      return fromFetch(`https://jsonplaceholder.typicode.com/posts/${id}`, {
        selector: async (response) => {
          const post = await response.json();
          return post as BlogPost;
        },
      });
    })
  )
);
const [useStatus] = createObservableStore(
  combineLatest([selected$, error$, post$]).pipe(
    map(([selected, error, post]) => ({ selected, error, post }))
    // catchError((error, caught$) => {
    //   const message =
    //     error instanceof Error ? error.message : "An error occurred";
    //   return concat(of({ error: message }), caught$);
    // })
  )
);

const LoadPost = () => {
  const post = usePost();
  return (
    <div style={{ padding: 5 }}>
      <h2>{post.title}</h2>
      <p>{post.body}</p>
    </div>
  );
};

const Row = ({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: CSSProperties;
}) => (
  <div
    style={{
      ...style,
      display: "flex",
      gap: 5,
      padding: 5,
      alignItems: "center",
    }}
  >
    {children}
  </div>
);

const SelectPost = () => {
  const selectedPostId = useSelectedPostId();
  const hasPostError = usePostError();
  return (
    <Row style={{ backgroundColor: "lightgray" }}>
      <Suspense>
        <SelectPostButton
          postId={1}
          disabled={selectedPostId === 1 || hasPostError}
        />
        <SelectPostButton
          postId={2}
          disabled={selectedPostId === 2 || hasPostError}
        />
        <SelectPostButton
          postId={3}
          disabled={selectedPostId === 3 || hasPostError}
        />
        <SelectPostButton
          postId={4}
          disabled={selectedPostId === 4 || hasPostError}
        />
      </Suspense>
    </Row>
  );
};

const SelectPostButton = memo(
  ({ postId, disabled }: { postId: number; disabled: boolean }) => {
    return (
      <button
        value={postId}
        disabled={disabled}
        onClick={() => selectedPostId$.next(postId)}
      >
        {postId}
      </button>
    );
  }
);

const InvalidPostId = (props: FallbackProps) => {
  const message =
    props.error instanceof Error ? props.error.message : "An error occurred";
  return (
    <div
      style={{ padding: 20, margin: 10, border: "1px solid red", color: "red" }}
    >
      <Row>
        {message}
        <button onClick={props.resetErrorBoundary}>Reset</button>
      </Row>
    </div>
  );
};

const UnknownError = () => (
  <div
    style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      width: "100%",
      fontSize: 100,
    }}
  >
    🥴
  </div>
);

const Status = () => {
  const status = useStatus();
  return <pre>{JSON.stringify(status, null, 2)}</pre>;
};

const Controls = () => (
  <Suspense fallback={<div>Loading...</div>}>
    <SelectPost />
  </Suspense>
);

const Post = () => (
  <ErrorBoundary
    FallbackComponent={InvalidPostId}
    onReset={() => {
      postError$.next(false);
      selectedPostId$.next(1);
    }}
    onError={() => postError$.next(true)}
  >
    <Suspense fallback={<div>Loading...</div>}>
      <LoadPost />
    </Suspense>
  </ErrorBoundary>
);

const Footer = () => (
  <Row style={{ backgroundColor: "lightblue" }}>
    <ErrorBoundary FallbackComponent={UnknownError}>
      <Suspense fallback={<div>Loading...</div>}>
        <Status />
      </Suspense>
    </ErrorBoundary>
  </Row>
);

const App = () => {
  return (
    <div>
      <h1>Example 10</h1>
      <Controls />
      <Post />
      <Footer />
    </div>
  );
};

export default App;
