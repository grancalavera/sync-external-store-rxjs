import { Suspense } from "react";

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
    let result: BlogPost[];
    let error: unknown;

    const promise = fetchData()
      .then((res) => {
        result = res;
      })
      .catch((err) => {
        error = err;
      });

    return () => {
      if (!result && !error) {
        throw promise;
      } else if (error) {
        throw error;
      }

      return result;
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
