import { createContext } from "react";

type SubscriptionContext = {
  captureSubscription: () => void;
};

const SuscriptionContext = createContext<SubscriptionContext>({
  captureSubscription: () => {},
});
