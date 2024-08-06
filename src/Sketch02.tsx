/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Component,
  ErrorInfo,
  PropsWithChildren,
  ReactNode,
  Suspense,
} from "react";
import { defer, Observable, Subscription, tap, timer } from "rxjs";
import { createSuspender, Suspender } from "./suspender";

type SubscribeBoundaryState =
  | { kind: "ready" }
  | { kind: "rethrow"; error: unknown }
  | { kind: "subscribe"; observable: Observable<unknown> };

type ErrorBoundaryState = { hasError: boolean };
type ErrorBoundaryProps = PropsWithChildren<{ fallback: ReactNode }>;

class ObservableBoundary extends Component<
  ErrorBoundaryProps,
  SubscribeBoundaryState
> {
  private suspender: Suspender;
  private subscriptions: Subscription;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { kind: "ready" };
    this.suspender = createSuspender();
    this.subscriptions = new Subscription();
  }

  static getDerivedStateFromError(error: unknown): SubscribeBoundaryState {
    if (error instanceof Observable) {
      return { kind: "subscribe", observable: error };
    } else {
      return { kind: "rethrow", error };
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.log("componentDidCatch", { error, info });
  }

  componentDidMount(): void {
    const state = this.state;
    console.log("componentDidMount", state.kind);

    if (state.kind === "subscribe") {
      console.log("subscribe to unbound observable");
      const subscription = state.observable.subscribe({
        next: () => {
          console.log("next");
          // this.setState({ kind: "ready" });
          // this.suspender.resume();
        },
        error: (error) => {
          console.log("error");
          this.setState({ kind: "rethrow", error });
        },
      });

      console.log("add subscription");
      this.subscriptions.add(subscription);
      this.setState({ kind: "rethrow", error: this.suspender.suspend() });
    }
  }

  componentWillUnmount(): void {
    const state = this.state;
    console.log("remove subscription, componentWillUnmount", {
      kind: state.kind,
    });
    this.subscriptions.unsubscribe();
  }

  render(): ReactNode {
    const state = this.state;
    console.log("render", state.kind);

    // if (state.kind === "rethrow") {
    //   throw state.error;
    // }

    if (state.kind === "ready") {
      return this.props.children;
    }

    return null;
  }
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.log("ErrorBoundary", error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

const ThrowError = () => {
  throw new Error("Failed");
};

const ThrowUnresolvedPromise = () => {
  throw new Promise(() => {});
};

const ThrowObservable = () => {
  console.log("ThrowObservable");
  throw timer(2000).pipe(tap(() => console.log("timer")));
};

const ThrowFailObservable = () => {
  throw defer(() => {
    throw new Error("Observable Error");
  });
};

export const Sketch02 = () => (
  <Suspense fallback={<p>Loading...</p>}>
    <ErrorBoundary fallback={<p>Failed to render</p>}>
      {/* <ObservableBoundary fallback={<p>Missing Subscription</p>}> */}
      <div>
        <h1>Sketch02</h1>
        <ThrowUnresolvedPromise />
      </div>
      {/* </ObservableBoundary> */}
    </ErrorBoundary>
  </Suspense>
);
