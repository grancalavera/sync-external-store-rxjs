import { Suspense, useSyncExternalStore } from "react";
import {
  BehaviorSubject,
  firstValueFrom,
  Observable,
  shareReplay,
  Subscription,
  switchMap,
} from "rxjs";
import { fromFetch } from "rxjs/fetch";
import { ErrorBoundary } from "react-error-boundary";

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

const selectedPostId$ = new BehaviorSubject(1);

const data$ = selectedPostId$.pipe(
  switchMap((id) => {
    if (![1, 2, 3].includes(id)) {
      throw new Error("Invalid post ID");
    }

    return fromFetch(`https://jsonplaceholder.typicode.com/posts/${id}`, {
      selector: async (response) => {
        const post = await response.json();
        return post as BlogPost;
      },
    });
  })
);

// https://react.dev/reference/react/useSyncExternalStore
const createObservableStore = <T,>(source$: Observable<T>) => {
  const notifiers = new Set<() => void>();

  const sharedSource$ = source$.pipe(
    shareReplay({ bufferSize: 1, refCount: true })
  );

  let promise: Promise<void> | undefined;
  let result: Result<T> = { kind: "pending" };
  let subscription: Subscription | undefined;

  const getSnapshot = () => {
    if (!promise) {
      promise = firstValueFrom(sharedSource$)
        .then((res) => {
          result = { kind: "success", value: res };
        })
        .catch((err) => {
          result = { kind: "failure", error: err };
        });
    }

    if (result.kind === "pending") {
      throw promise;
    }

    if (result.kind === "failure") {
      throw result.error;
    }

    return result.value;
  };

  const subscribe = (notifier: () => void) => {
    notifiers.add(notifier);

    if (subscription === undefined) {
      subscription = sharedSource$.subscribe({
        next: (value) => {
          result = { kind: "success", value };
          notifiers.forEach((notify) => notify());
        },
        error: (err) => {
          result = { kind: "failure", error: err };
          notifier();
        },
      });
    }

    return () => {
      notifiers.delete(notifier);
      if (notifiers.size === 0) {
        subscription?.unsubscribe();
        subscription = undefined;
      }
    };
  };

  return () => useSyncExternalStore(subscribe, getSnapshot);
};

const useSelectedPostId = createObservableStore(selectedPostId$);
const usePost = createObservableStore(data$);

const Post = () => {
  const post = usePost();
  return (
    <div style={{ padding: 5 }}>
      <h2>{post.title}</h2>
      <p>{post.body}</p>
    </div>
  );
};

const Row = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      display: "flex",
      gap: 5,
      padding: 5,
      backgroundColor: "lightgray",
    }}
  >
    {children}
  </div>
);

const SelectPost = () => (
  <Row>
    <Suspense>
      <SelectPostButton postId={1} />
      <SelectPostButton postId={2} />
      <SelectPostButton postId={3} />
      <SelectPostButton postId={4} />
    </Suspense>
  </Row>
);

const SelectPostButton = ({ postId }: { postId: number }) => {
  const selectedPostId = useSelectedPostId();
  return (
    <button
      value={postId}
      disabled={selectedPostId === postId}
      onClick={() => selectedPostId$.next(postId)}
    >
      {postId}
    </button>
  );
};

const InvalidPostId = () => (
  <div
    style={{ padding: 20, margin: 10, border: "1px solid red", color: "red" }}
  >
    Invalid post ID
  </div>
);

const App = () => {
  return (
    <div>
      <Suspense fallback={<div>Loading...</div>}>
        <SelectPost />
      </Suspense>

      <ErrorBoundary FallbackComponent={InvalidPostId}>
        <Suspense fallback={<div>Loading...</div>}>
          <Post />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
};

export default App;
