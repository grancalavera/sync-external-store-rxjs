import { bind, Subscribe } from "@react-rxjs/core";
import { Suspense } from "react";
import { ErrorBoundary, FallbackProps } from "react-error-boundary";
import { BehaviorSubject, switchMap } from "rxjs";
import { fromFetch } from "rxjs/fetch";

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
      throw new Error("Invalid post ID: " + id);
    }

    return fromFetch(`https://jsonplaceholder.typicode.com/posts/${id}`, {
      selector: async (response) => {
        const post = await response.json();
        return post as BlogPost;
      },
    });
  })
);

const [useSelectedPostId] = bind(selectedPostId$);
const [usePost] = bind(data$);

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

const App = () => {
  return (
    <div>
      <h1>Example 11</h1>
      <Subscribe fallback={<div>Loading...</div>}>
        <SelectPost />
      </Subscribe>
      <ErrorBoundary
        FallbackComponent={InvalidPostId}
        onReset={() => selectedPostId$.next(1)}
      >
        <Subscribe fallback={<div>Loading...</div>}>
          <Post />
        </Subscribe>
      </ErrorBoundary>
    </div>
  );
};

export default App;
