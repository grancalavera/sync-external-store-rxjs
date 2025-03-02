import { Suspense } from "react";

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

const fetchData = async (): Promise<BlogPost[]> => {
  const response = await fetch("https://jsonplaceholder.typicode.com/posts");
  if (!response.ok) {
    throw new Error("Network response was not ok");
  }
  return response.json();
};

const resource = {
  read: (() => {
    let result: Result<BlogPost[]> = { kind: "pending" };

    const promise = fetchData()
      .then((res) => {
        result = { kind: "success", value: res };
      })
      .catch((err) => {
        result = { kind: "failure", error: err };
      });

    return () => {
      if (result.kind === "pending") {
        throw promise;
      } else if (result.kind === "failure") {
        throw result.error;
      }

      return result.value;
    };
  })(),
};

const Posts = () => {
  const posts = resource.read();
  return (
    <ul>
      {posts.map((post: { id: number; title: string }) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  );
};

const App = () => {
  return (
    <div>
      <h1>Posts</h1>
      <Suspense fallback={<div>Loading...</div>}>
        <Posts />
      </Suspense>
    </div>
  );
};

export default App;
