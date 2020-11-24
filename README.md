# Event Sourcing Research

## Transport

Using queues such as RabbitMQ or Kafka (Kinesis on AWS).

## Dealing with missing events

How to deal with missing events? Will the queue be reliable enough? In case of failure, what would be the single source of truth?

## Dealing with replay

Events can be replayed from certain time frame, but still required the previous state from the previous events. How to optimize this? Most likely through snapshots of data from certain time period, and limit query only from specific time frame (from months, rather than days).

Alternatively, we can update the snapshot once the version drifts to a specific delta (`event.version - aggregate.version > MAX_N_BEFORE_UPDATE_SNAPSHOT`).

## Dealing with multiple streams

Some events can be generated from multiple sources - how do we merge the streams of events and ensure consistency? 
It seems like the final aggregate states (projections?) are stored in-memory. 

## Initial State

How do we define the initial state of any events? The creation should not include other field, and should be the first event to be raised. (It could include other fields, but specifying them would be hard).

## Undo

In the case of undo, do we create a new event to undo it? Or delete the event that causes the undo? And how does it affect future states after the undo?

## Thoughts
Aside from splitting the read and write, what other differences does CQRS provide?

For command/event handlers, we might not expect the response. This differs from typical request/response pattern, where the interaction is synchronous. For command/event pattern, they are typically asynchronous, and is handled through a queue. The events can be pushed to a queue, and there can be multiple consumers that listens to the queue and perform actions.

## References
- https://medium.com/@marinithiago/doing-event-sourcing-without-building-a-spaceship-6dc3e7eac00
- https://javascript-conference.com/node-js/implement-event-sourcing-in-node-js/
- https://blog.insiderattack.net/implementing-event-sourcing-and-cqrs-pattern-with-mongodb-66991e7b72be
- https://docs.microsoft.com/en-us/azure/architecture/patterns/event-sourcing#:~:text=The%20Event%20Sourcing%20pattern%20defines,in%20an%20append%2Donly%20store.&text=The%20events%20are%20persisted%20in,current%20state%20of%20the%20data.
- https://kickstarter.engineering/event-sourcing-made-simple-4a2625113224
- http://blog.leifbattermann.de/2017/04/21/12-things-you-should-know-about-event-sourcing/
