# Event Sourcing Research

## Transport

Using queues such as RabbitMQ or Kafka (Kinesis on AWS).

## Dealing with missing events

How to deal with missing events? Will the queue be reliable enough? In case of failure, what would be the single source of truth?

## Dealing with replay

Events can be replayed from certain time frame, but still required the previous state from the previous events. How to optimize this? Most likely through snapshots of data from certain time period, and limit query only from specific time frame (from months, rather than days).

## Dealing with multiple streams

Some events can be generated from multiple sources - how do we merge the streams of events and ensure consistency? 

## Initial State

How do we define the initial state of any events?

## Undo

In the case of undo, do we create a new event to undo it? Or delete the event that causes the undo? And how does it affect future states after the undo?

## Thoughts
Aside from splitting the read and write, what other differences does CQRS provide?

For command/event handlers, we might not expect the response. This differs from typical request/response pattern, where the interaction is synchronous. For command/event pattern, they are typically asynchronous, and is handled through a queue. The events can be pushed to a queue, and there can be multiple consumers that listens to the queue and perform actions.
