import {
  finalize,
  first,
  Observable,
  ObservableNotification,
  Subscription,
  tap,
} from "rxjs";

export type Suspender<T> = {
  suspend: () => SuspendHandle<T>;
};

type SuspendHandle<T> = [
  Promise<ObservableNotification<T>>,
  () => Subscription
];

export const createSuspender = <T>(
  source$: Observable<ObservableNotification<T>>
): Suspender<T> => {
  let handle: SuspendHandle<T> | undefined;

  const createHandle = (): SuspendHandle<T> => {
    let resolve: (value: ObservableNotification<T>) => void;

    const promise = new Promise<ObservableNotification<T>>(
      (res) => (resolve = res)
    );

    // we also need to take into account the case when the
    // observable completes without emitting any value

    // I want to be able to index this function by the
    // reference to the observable
    const subscribe = () => {
      console.count("subscribing");
      return source$
        .pipe(
          first(),
          tap((x) => console.log("--->", x)),
          finalize(() => console.log("finalizing"))
        )
        .subscribe({
          next: (value) => {
            resolve(value);
            handle = undefined;
          },
        });
    };

    return [promise, subscribe];
  };

  const suspend = () => {
    if (!handle) handle = createHandle();
    return handle;
  };

  return { suspend };
};
