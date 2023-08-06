type Suspender = {
  suspend: () => Promise<void>;
  resume: () => void;
};

export const createSuspender = (): Suspender => {
  let promise: Promise<void> | undefined;
  let resolve: (() => void) | undefined;

  const suspend = (): Promise<void> => {
    if (promise === undefined) {
      promise = new Promise((res) => (resolve = res));
    }
    throw promise;
  };

  const resume = () => {
    if (promise === undefined) return;

    resolve?.();
    promise = undefined;
    resolve = undefined;
  };

  return { suspend, resume };
};
