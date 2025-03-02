import {
  createContext,
  PropsWithChildren,
  Suspense,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { defer, finalize, Observable, shareReplay, Subscription } from "rxjs";
import { fromFetch } from "rxjs/fetch";

function Example() {
  const [show, setShow] = useState(false);
  return (
    <Stack>
      <h1>Example 15</h1>
      <Card variant="dark">
        <Stack>
          <button
            style={{ flex: 1 }}
            onClick={() => setShow((current) => !current)}
          >
            {show ? "hide" : "show"}
          </button>
          {show && (
            <TrapBoundary>
              <Suspense fallback={<p>loading...</p>}>
                <Posts />
              </Suspense>
            </TrapBoundary>
          )}
        </Stack>
      </Card>
    </Stack>
  );
}

export default Example;

// TODO: materialize source
// TODO: handle errors
// TODO: match bind return value
// TODO: allow for indexing on args in bind
// TODO: double check if the trap really needs getters, or if it's enough for the trap itself to be a getter

// low priority
// TODO: figure out why we're not re-subscribing to the source after the component unmounts
// TODO: prevent source from completing

// -----------------------------------------------------------------------------
//
// Types and utils
//
// -----------------------------------------------------------------------------

type EmptyValue = typeof EMPTY_VALUE;
const EMPTY_VALUE = Symbol("EMPTY_VALUE");
type CurrentValue<T> = T | EmptyValue;
type Notify = () => void;

const isEmpty = <T,>(value: CurrentValue<T>): value is EmptyValue =>
  value === EMPTY_VALUE;

const isValue = <T,>(value: CurrentValue<T>): value is T => !isEmpty(value);

// -----------------------------------------------------------------------------
//
// Traps
//
// -----------------------------------------------------------------------------

type Trapped<T> = {
  getSuspender: () => Promise<T>;
  getCurrentValue: () => CurrentValue<T>;
  subscribe: () => Subscription;
};

type Trap = {
  capture: <T>(source$: Observable<T>) => Trapped<T>;
  subscribe: () => Subscription;
};

const createTrapped = <T,>(source$: Observable<T>): Trapped<T> => {
  let resolve: (value: T) => void;
  let reject: (error: unknown) => void;

  const suspender = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  let currentValue: CurrentValue<T> = EMPTY_VALUE;

  const subscribe = () => {
    console.count("trapped: subscribe");
    // handle un-subscription on next
    // handle empty elements error
    // track error in Trapped<T> ?
    // also this must be broken
    return source$
      .pipe(finalize(() => console.log("trapped: finalize")))
      .subscribe({
        next: (value) => {
          currentValue = value;
          resolve(value);
        },
        error: (error) => {
          reject(error);
        },
      });
  };

  return {
    getSuspender: () => suspender,
    getCurrentValue: () => currentValue,
    subscribe,
  };
};

const createTrap = (): Trap => {
  console.log("trap: create");

  const traps = new Map<Observable<unknown>, Trapped<unknown>>();

  const capture = <T,>(source$: Observable<T>) => {
    console.log("trap: capture");

    if (traps.has(source$)) {
      return traps.get(source$) as Trapped<T>;
    }

    const trapped = createTrapped(source$);

    traps.set(source$, trapped);
    return trapped;
  };

  const subscribe = () => {
    const subscription = new Subscription();
    console.count("trap: subscribe");
    traps.forEach((trapped) => {
      subscription.add(trapped.subscribe());
    });
    return subscription;
  };

  return { capture, subscribe };
};

const defaultTrap: Trap = {
  capture: () => {
    throw new ReferenceError("capture: missing TrapContext");
  },
  subscribe: () => {
    throw new ReferenceError("subscribe: missing TrapContext");
  },
};

// -----------------------------------------------------------------------------
//
// Context and Boundary
//
// -----------------------------------------------------------------------------

const TrapContext = createContext<Trap>(defaultTrap);

const TrapBoundary = ({ children }: PropsWithChildren) => {
  const trap = useRef<Trap | undefined>(undefined);

  if (!trap.current) {
    trap.current = createTrap();
  }

  useEffect(() => {
    console.count("TrapBoundary: subscribe");
    const subscription = trap.current?.subscribe();
    return () => {
      console.count("TrapBoundary: unsubscribe");
      subscription?.unsubscribe();
    };
  }, []);

  return (
    <TrapContext.Provider value={trap.current}>{children}</TrapContext.Provider>
  );
};

// -----------------------------------------------------------------------------
//
// Observable Store
//
// -----------------------------------------------------------------------------

const createObservableStore = <T,>(source$: Observable<T>) => {
  const notifiers = new Set<Notify>();

  const sharedSource$ = source$.pipe(
    // maybe this is not needed at all?
    // it is in a way, but needs to be paired with
    //  a way to prevent the source from completing
    shareReplay({ bufferSize: 1, refCount: true }),
    finalize(() => console.log("sharedSource$: finalize"))
  );

  let currentValue: CurrentValue<T> = EMPTY_VALUE;
  let trap: Trap | undefined;
  let subscription: Subscription | undefined;

  const getSnapshot = (): T => {
    console.count("store: getSnapshot");

    if (isValue(currentValue)) {
      return currentValue;
    }

    const trapped = trap?.capture(sharedSource$);

    if (!trapped) {
      throw new Error("Trap failed");
    }

    if (isValue(trapped.getCurrentValue())) {
      currentValue = trapped.getCurrentValue();
      return currentValue as T;
    }

    throw trapped.getSuspender();
  };

  const subscribe = (notify: Notify): (() => void) => {
    notifiers.add(notify);
    if (!subscription) {
      console.count("store: subscribe");
      subscription = sharedSource$.subscribe({
        next: (value) => {
          currentValue = value;
          notifiers.forEach((notify) => notify());
        },
        error: (error) => {
          // handle error
        },
        complete: () => {
          // should not complete
          // but there's the problem presented with observables like the one
          // returned by `fromFetch` that complete after the first emission
          // and where re-subscribing will make them fall into an infinite loop
          // emitting over and over again
        },
      });
    }
    return () => {
      console.count("store: unsubscribe");
      subscription?.unsubscribe();
      subscription = undefined;
      currentValue = EMPTY_VALUE;
    };
  };

  return () => {
    console.log("use observable store");
    trap = useContext(TrapContext);
    return useSyncExternalStore(subscribe, getSnapshot);
  };
};

// -----------------------------------------------------------------------------
//
// Fixture data
//
// -----------------------------------------------------------------------------

type BlogPost = {
  userId: number;
  id: number;
  title: string;
  body: string;
};

// -------------------------------------
//
// All Posts
//
// -------------------------------------

const posts$: Observable<BlogPost[]> = defer(() => {
  console.count("posts$: subscribe");
  return fromFetch("https://jsonplaceholder.typicode.com/posts", {
    selector: (response) => response.json(),
  }).pipe(finalize(() => console.count("posts$: finalize")));
});

const usePosts = createObservableStore(posts$);

// -----------------------------------------------------------------------------
//
// Example
//
// -----------------------------------------------------------------------------

const Stack = ({ children }: PropsWithChildren) => (
  <div
    style={{
      display: "flex",
      gap: 5,
      flexDirection: "column",
    }}
  >
    {children}
  </div>
);

const Posts = () => {
  const posts = usePosts();
  return (
    <Card>
      <Stack>
        {posts.map((post) => (
          <Post key={post.id} post={post} />
        ))}
      </Stack>
    </Card>
  );
};

const Post = ({ post }: { post: BlogPost }) => {
  return (
    <Card>
      <h2>{post.title}</h2>
      <p>{post.body}</p>
    </Card>
  );
};

const Card = ({
  children,
  variant,
}: PropsWithChildren & { variant?: "dark" | "light" }) => (
  <div
    style={{
      padding: 5,
      borderRadius: 5,
      backgroundColor: variant === "dark" ? "lightgray" : "white",
    }}
  >
    {children}
  </div>
);
