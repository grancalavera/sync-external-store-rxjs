import {
  delay,
  materialize,
  merge,
  Observable,
  of,
  shareReplay,
  takeUntil,
} from "rxjs";

/*
This kind of works to signal when an Observable hasn't emitted synchronously, but
it doesn't work to re-subscribe when the Observable throws an error, and neither
when the Observable completes.
*/

const SUSPEND = Symbol("SUSPEND");

const factory = <T>(source$: Observable<T>) => {
  const suspend$ = of(SUSPEND).pipe(takeUntil(source$));
  return merge(suspend$, source$).pipe(
    materialize(),
    shareReplay({ bufferSize: 1, refCount: true })
  );
};

factory(of(1)).subscribe(console.log);
console.log("----");
factory(of(1).pipe(delay(1))).subscribe(console.log);
