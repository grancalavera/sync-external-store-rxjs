import { bind, Subscribe } from "@react-rxjs/core";
import { CSSProperties } from "react";
import { BehaviorSubject, finalize, switchMap } from "rxjs";
import { fromFetch } from "rxjs/fetch";

type BlogPost = {
  userId: number;
  id: number;
  title: string;
  body: string;
};

const selectedPostId$ = new BehaviorSubject(1);
const [useSelectedPostId] = bind(selectedPostId$);

const [, post$] = bind(
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

post$.pipe(finalize(() => console.log("post finalized"))).subscribe({
  next: (post) => console.log("post next", post),
  error: (err) => console.log("post error", err),
});

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
  return (
    <Row style={{ backgroundColor: "lightgray" }}>
      <Subscribe>
        <SelectPostButton postId={1} disabled={selectedPostId === 1} />
        <SelectPostButton postId={2} disabled={selectedPostId === 2} />
        <SelectPostButton postId={3} disabled={selectedPostId === 3} />
        <SelectPostButton postId={4} disabled={selectedPostId === 4} />
      </Subscribe>
    </Row>
  );
};

const SelectPostButton = ({
  postId,
  disabled,
}: {
  postId: number;
  disabled: boolean;
}) => {
  return (
    <button
      value={postId}
      disabled={disabled}
      onClick={() => selectedPostId$.next(postId)}
    >
      {postId}
    </button>
  );
};

const Controls = () => (
  <Subscribe fallback={<div>Loading...</div>}>
    <SelectPost />
  </Subscribe>
);

const App = () => {
  return (
    <div>
      <h1>Example 13</h1>
      <Controls />
    </div>
  );
};

export default App;
