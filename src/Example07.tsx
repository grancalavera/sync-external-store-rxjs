import { Suspense, useSyncExternalStore, useRef } from "react";

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

const useResource = () => {
  const resourceRef = useRef<{ subscribe: () => () => void; getSnapshot: () => BlogPost[] } | null>(null);

  if (!resourceRef.current) {
    console.log("createResource");
    let result: Result<BlogPost[]> = { kind: "pending" };

    const subscribe = () => {
      const unsubscribe = () => {
        /* Empty function for compliance */
      };
      return unsubscribe;
    };

    const getSnapshot = () => {
      if (result.kind === "pending") {
        throw Promise.resolve(
          fetchData()
            .then((res) => {
              result = { kind: "success", value: res };
            })
            .catch((err) => {
              result = { kind: "failure", error: err };
            })
        );
      } else if (result.kind === "failure") {
        throw result.error;
      }

      return result.value;
    };

    resourceRef.current = { subscribe, getSnapshot };
  }

  return resourceRef.current;
};

const Posts = () => {
  const resource = useResource();
  const posts = useSyncExternalStore(resource.subscribe, resource.getSnapshot);
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
