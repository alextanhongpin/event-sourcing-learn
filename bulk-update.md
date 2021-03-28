# How does bulk update works in event sourcing, especially with versioning?

The aggregate root should create an event for each of them. And they should have an incremented version each.


References
1. [DDD and bulk operations](https://enterprisecraftsmanship.com/posts/ddd-bulk-operations/)
2. [StackOverflow: How to update bunch of data with Event Sourcing](https://stackoverflow.com/questions/58400041/how-to-update-bunch-of-data-with-event-sourcing)


# Updating multiple aggregates

https://softwareengineering.stackexchange.com/questions/304142/event-sourcing-updates-to-multiple-aggregates
