# Patterns for handling multiple events


1. Define event type, e.g. `UserRegisteredEvent`
2. Define event handlers, e.g. Send Welcome Email, Send Confirmation Email (note that one primary event can have multiple handlers, in order to ensure guarantee, we should create each of them as individual events in the `Outbox Pattern` instead. A 1:1 mapping of event to event handler would be better for delivery guarantee. 

