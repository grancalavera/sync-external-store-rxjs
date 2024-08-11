import { CSSProperties, memo, PropsWithChildren, Suspense } from "react";
import { ErrorBoundary, FallbackProps } from "react-error-boundary";
import { BehaviorSubject, combineLatest, finalize, map, switchMap } from "rxjs";
import { fromFetch } from "rxjs/fetch";
import { createObservableStore } from "./observable-store-v3";

type BlogPost = {
  userId: number;
  id: number;
  title: string;
  body: string;
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
const [useStatus, status$] = createObservableStore(
  combineLatest([selected$, error$, post$]).pipe(
    map(([selected, error, post]) => ({ selected, error, post }))
  )
);

status$
  .pipe(
    finalize(() => {
      console.log("-> status finalized");
    })
  )
  .subscribe({
    next: (status) => {
      console.log("-> status next", status);
    },
    error: (error) => {
      console.log("-> status error [begin]");
      console.log("-> status error", error);
      console.log("-> status error [end]");
    },
    complete: () => {
      console.log("-> status complete");
    },
  });

const Post = () => {
  const post = usePost();
  return (
    <Card>
      <h2>{post.title}</h2>
      <p>{post.body}</p>
    </Card>
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

const Card = ({
  children,
  style,
}: {
  children: React.ReactNode;

  style?: CSSProperties;
}) => <div style={{ ...style, padding: 20 }}>{children}</div>;

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
    <Card style={{ backgroundColor: "red", color: "white" }}>
      <Row>
        {message}
        <button onClick={props.resetErrorBoundary}>Reset</button>
      </Row>
    </Card>
  );
};

const Status = () => {
  const status = useStatus();
  return (
    <Card style={{ backgroundColor: "lightblue" }}>
      <pre>{JSON.stringify(status, null, 2)}</pre>
    </Card>
  );
};

const Controls = () => (
  <Suspense fallback={<div>Loading...</div>}>
    <SelectPost />
  </Suspense>
);

const InvalidPostErrorBoundary = ({ children }: PropsWithChildren) => (
  <ErrorBoundary
    FallbackComponent={InvalidPostId}
    onReset={() => {
      postError$.next(false);
      selectedPostId$.next(1);
    }}
    onError={() => postError$.next(true)}
  >
    {children}
  </ErrorBoundary>
);

const App = () => {
  return (
    <div>
      <h1>Example 10</h1>
      <Controls />
      <InvalidPostErrorBoundary>
        <Suspense
          fallback={
            <Card>
              <h2>Loading...</h2>
            </Card>
          }
        >
          <Post />
          <Status />
        </Suspense>
      </InvalidPostErrorBoundary>
    </div>
  );
};

export default App;
