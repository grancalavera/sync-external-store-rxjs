import { createContext, PropsWithChildren, useEffect, useRef } from "react";
import { Observable, Subscription } from "rxjs";

type Capture = (
  key: Observable<unknown>,
  subscribe: () => Subscription
) => void;

type Trap = {
  capture: Capture;
  subscribe: () => void;
  unsubscribe: () => void;
};

const createTrap = (): Trap => {
  const subscription = new Subscription();
  const traps = new Map<Observable<unknown>, () => Subscription>();

  const capture: Capture = (key, subscribe) => {
    traps.set(key, subscribe);
  };

  const subscribe = () => {
    console.log(`${traps.size} subscriptions captured`);
    traps.forEach((subscribe) => subscription.add(subscribe()));
    // traps.clear();
  };

  const unsubscribe = () => {
    subscription.unsubscribe();
    // traps.clear();
  };

  return { capture, subscribe, unsubscribe };
};

export const CaptureContext = createContext<Capture>(() => {
  throw new Error("CaptureContext is not provided");
});

export const Capture = ({ children }: PropsWithChildren) => {
  const trap = useRef<Trap>();

  if (trap.current === undefined) {
    trap.current = createTrap();
  }

  useEffect(() => {
    console.log("set trap");
    trap.current?.subscribe();
    return () => {
      console.log("clear trap");
      trap.current?.unsubscribe();
    };
  }, []);

  return (
    <CaptureContext.Provider value={trap.current.capture}>
      {children}
    </CaptureContext.Provider>
  );
};
