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

## Commands vs Events

We can publish a command to perform a specific action. Events are just a description of the past. We can also subscribe to events to perform specific actions. This may cause a lot of confusion, say for example for a user registration system:
1. User register
2. A `UserRegisteredEvent` is created. 

If we want to send an email, how do we do it?

1. Listen to the event `UserRegisteredEvent` and let the __event processor__ delegate it to the right __event handler__ to execute the email delivery.
2. Publish a `SendRegistrationEmailCommand`, and let the __command processor__ delegate it to the right __command handler__ to execute the email delivery.

Both ways are correct, but we can specify a ground rule - that a service can only listen to it's own events, and not publish it to external services. Commands however can be published to external services.

Say if we only have one User Service that handles both registration and email delivery:

```
User Service:
1. Produce UserRegisteredEvent
2. Listens to UserRegisteredEvent
3. Sends email
```

But if we decided to split it:
```
Email Service:
1. Listens to SendRegistrationEmailCommand
2. Sends email

User Service:
1. Produce UserRegisteredEvent
2. Listens to UserRegisteredEvent
3. Maps to SendRegistrationEmailCommand
4. Publish SendRegistrationEmailCommand
```

We choose this over sending an event not related to the Email service domain:

```
Email Service:
1. Listens to UserRegisteredEvent (?, it is hard to discern what to do with the event)
2. Sends email

User Service:
1. Produce UserRegisteredEvent
2. Listens to UserRegisteredEvent
3. Publish UserRegisteredEvent to other services (?)
```

Let's exaggerate the system by creating multiple emails with the suggested approach:

```
# Command Listener
Email Service:
1. Listens to SendRegistrationEmailCommand, SendInvoiceEmailCommand, SendThankYouEmail
2. Sends email

User Service:
1. Produce UserRegisteredEvent
2. Listens to UserRegisteredEvent
3. Maps to SendRegistrationEmailCommand
4. Publish SendRegistrationEmailCommand

Payment Service:
1. Produce PaymentMadeEvent
2. Listens to PaymentMadeEvent
3. Maps to SendInvoiceEmailCommand
4. Publish SendInvoiceEmailCommand

Subscription Service:
1. Produce SubscribedEvent
2. Listens to SubscribedEvent
3. Maps to SendThankYouEmail
4. Publish SendThankYouEmail
```
Versus:

```
# Event Listener
Email Service:
1. Listens to UserRegisteredEvent, PaymentMadeEvent, SubscribedEvent
2. Sends email

User Service:
1. Produce UserRegisteredEvent
2. Publish UserRegisteredEvent

Payment Service:
1. Produce PaymentMadeEvent
2. Publish PaymentMadeEvent

Subscription Service:
1. Produce SubscribedEvent
2. Publish to SubscribedEvent
```

## Versioning events and commands

Since most commands and events does not produce reply, it's hard for client to know if something goes wrong (deprecation, etc). Hence, it is better for the message published to include the source, as well as the versioning.

```
Message:
- supertype of Event and Command

Event
- type
- payload
- version (1, 2...)
- source (to allow us to know which client uses a different version)

Command
- action
- payload
- version
- source
```

## DDD, CQRS and Event Sourcing


What is the limitation of CRUD?
- lack of audit log. In Event Sourcing, events that describes the changes of the entity is stored. CRUD only persist the current state of the system - can we have both? While it is possible to store incoming messages and use it as audit log, this approach results in data duplication and contradicts the single source of truth. When there’s conflict between the persisted data and audit log, there will be no way to determine the state of the system. 


https://axoniq.io/resources/architectural-concepts
https://arkwright.github.io/event-sourcing.html


## Audit Log vs Event Sourcing
https://github.com/JamesRandall/AzureFromTheTrenches.Commanding/wiki/6.-Auditing-and-Event-Sourcing
https://stablekernel.com/article/storing-historical-data-with-postgresql-and-automatic-partitions/


## References
- https://medium.com/@marinithiago/doing-event-sourcing-without-building-a-spaceship-6dc3e7eac00
- https://javascript-conference.com/node-js/implement-event-sourcing-in-node-js/
- https://blog.insiderattack.net/implementing-event-sourcing-and-cqrs-pattern-with-mongodb-66991e7b72be
- https://docs.microsoft.com/en-us/azure/architecture/patterns/event-sourcing#:~:text=The%20Event%20Sourcing%20pattern%20defines,in%20an%20append%2Donly%20store.&text=The%20events%20are%20persisted%20in,current%20state%20of%20the%20data.
- https://kickstarter.engineering/event-sourcing-made-simple-4a2625113224
- http://blog.leifbattermann.de/2017/04/21/12-things-you-should-know-about-event-sourcing/


