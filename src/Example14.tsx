import { CSSProperties, PropsWithChildren, Suspense } from "react";
import { ErrorBoundary, FallbackProps } from "react-error-boundary";
import { BehaviorSubject, switchMap } from "rxjs";
import { fromFetch } from "rxjs/fetch";
import { Capture } from "./observable-store-capture-v3";
import { createObservableStore } from "./observable-store-v4";

type BlogPost = {
  userId: number;
  id: number;
  title: string;
  body: string;
};

const selectedPostId$ = new BehaviorSubject(1);
const postError$ = new BehaviorSubject(false);
const [usePost] = createObservableStore(
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
      <InvalidPostErrorBoundary>
        <Capture>
          <Suspense
            fallback={
              <Card>
                <h2>Loading...</h2>
              </Card>
            }
          >
            <Post />
          </Suspense>
        </Capture>
      </InvalidPostErrorBoundary>
    </div>
  );
};

export default App;
