import { interval, Subscription } from "rxjs";

const subscription = new Subscription();
const inter = interval(1000).subscribe(console.log);

subscription.add(inter);

setTimeout(() => {
  inter.unsubscribe();

  setTimeout(() => {
    subscription.unsubscribe();
    console.log("ok computer");
  }, 1000);
}, 3000);
