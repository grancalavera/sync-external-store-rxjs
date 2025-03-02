import { interval } from "rxjs";

const ticker$ = interval(500);

ticker$.subscribe((tick) => {
  console.log("tick", tick);
});
