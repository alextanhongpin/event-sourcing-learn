# Atomic Events

The typical event driven architecture flow is as follow:

1. commit changes to a database
2. publish an event detailing the changes through a message bus


However, a lot can happen in the second step (code error, infra error) which could fail the delivery of the events and lead to data inconsistency.
What if we reverse them - publishing an event and then commiting changes to the database? This would not work too, since now the events could be published while the database operation fails.

There are several approaches to this problem, mainly:

- event sourcing
- application events
- database triggers
- transaction log trailing

With the `Application Events` pattern, the process is as follow:

The OrderService inserts a row into the Order table and inserts an OrderCreatedEvent into the Event table (in the scope of a single local db transaction).
The EventPublisher thread or process queries the Event table for unpublished events, publishes the events and the updates the Event table to mark the events as published.

At any point, if the EventPublisher crashes or otherwise fails, the events it did not process are still marked as unpublished. So when the EventPublisher comes back online, it will immediately publish those events.




https://www.nginx.com/blog/event-driven-data-management-microservices/
https://microservices.io/patterns/data/transactional-outbox.html
https://microservices.io/patterns/data/transaction-log-tailing.html
https://medium.com/@odedia/listen-to-yourself-design-pattern-for-event-driven-microservices-16f97e3ed066
https://stackoverflow.com/questions/41655915/microservices-atomic-events
