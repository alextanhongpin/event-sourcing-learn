# Event sourcing

## What is an event?
- an event is something that happened in the past
- an event is immutable and cannot be changed or undone
- an event has a single source that publishes the event and one or more recipients may receive events. The source publishes the event by notifying other parts of the system that can be in interested in when an event has occured
- in event sourcing, an event should describe business intent


## Event Store

We can model the event store using RDBMS. 

The `aggregate` table has the following columns:
- aggregate id: a unique identifier
- type: the type of aggregate. In an object-oriented event sourcing implementation, this is the aggregate's class name
- version: current version of the aggregate. Incremented every time an event is applied to the aggregate and indicates how many events have been applied to it since it was first created

| aggregate id | type | version |
| - | - | - |
| 1 | "Patient" | 3 |

The `event` table has the following columns:
- aggregate id: a foreign key pointing to the aggregate table
- version: incremented version number
- event data: the actual event

| aggregate id | version | event data |
| - | - | - |
| 1 | 1 | patient_admitted; name = 'john' |
| 1 | 2 | patient_transferred; new_ward_number = 4 |
| 1 | 3 | patient_discharged; |


Event store only supports two operations.

1. Retrieve all events for an aggregate. This operation uses the version number to return the events ordered in order to replay the events to build up to the current state
2. Writes a set of events to the event store, based on the following steps:
  1. Check if an aggregate with the unique aggregate id exists. If it doesn't, insert it into the aggregate table and set current version to 0
  2. The version number of the first event should equal to the version number in the aggregate table plus one. If it's not, there is a conflict and an exception should be raised. This approach is called _optimistic concurrency control_.
  3. Loop through the set of events and insert them into the event store, incrementing the version number for each event.
  4. Update the version in the aggregate table to the version of the last inserted event.
  
We can store the final state in a `snapshot` table:

| aggregate id | version | serialized data |
| - | - | - |
| 1 | 3 | name = "john"; new_ward_number = 4; |
