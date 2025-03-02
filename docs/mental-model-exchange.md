# Mental Model: Exchange

## Side Effects

Any state of the following form performs a side effect as the initial transition
when entering such state:

```mermaid
stateDiagram-v2

state State {
    [*] --> [*]: side effect
}
```

## Subscription Exchange

Instead of subscribing on render, subscriptions are delegated to some ancestor
component, and then exchanged once the component using the store renders.

```mermaid
stateDiagram-v2

  state Suspended {
    [*] --> [*]: suspend()
  }

  state Subscribed {
    [*] --> [*]: exchangeSubscription()
  }

  state hasValue <<choice>>

  [*] --> Unsubscribed
  Unsubscribed --> hasValue: getSnapshot() + delegateSubscription()
  hasValue --> Suspended: hasValue = no
  hasValue --> Subscribed: hasValue = yes
  Suspended --> hasValue: getSnapshot()
  Subscribed --> Subscribed: getSnapshot()
  Subscribed --> [*]: unsubscribe
```
