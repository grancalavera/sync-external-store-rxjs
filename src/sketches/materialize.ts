import {
  catchError,
  concat,
  interval,
  map,
  materialize,
  Observable,
  ObservableNotification,
  of,
  switchMap,
  tap,
} from "rxjs";

const n = (): ObservableNotification<number> => {
  return {
    kind: "N",
    value: 1,
  };
};

const ticker$: Observable<ObservableNotification<number>> = interval(1000).pipe(
  tap((x) => {
    if (x === 3) {
      throw new Error("Boom!");
    }
  }),
  map((x) => ({
    kind: "N" as const,
    value: x,
  })),
  catchError((error, caught$) =>
    concat(
      of({
        kind: "E" as const,
        error,
      }),
      caught$
    )
  )
);

ticker$.subscribe((value) => {
  console.log(value);
});

// ticker$
//   .pipe(
//     switchMap((notification) => {
//       if (notification.kind === "E") {
//         return interval(1000);
//       }

//       return of(notification);
//     })
//   )
//   .subscribe((value) => {
//     console.log(value.kind);
//   });
