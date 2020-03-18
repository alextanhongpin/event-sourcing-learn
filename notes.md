# # Comment handler pattern
- Go through the book again and document down the changes
- Explore code generation for golang, use it to generate migration files and cli tools for passport and also slug generator

https://docs.microsoft.com/en-us/azure/architecture/patterns/event-sourcing
https://microservices.io/patterns/data/event-sourcing.html
https://medium.com/@hugo.oliveira.rocha/what-they-dont-tell-you-about-event-sourcing-6afc23c69e9a
https://martinfowler.com/bliki/CQRS.html
https://martinfowler.com/eaaDev/EventSourcing.html
https://dev.to/olibutzki/why-event-sourcing-is-a-microservice-anti-pattern-3mcj
https://itnext.io/1-year-of-event-sourcing-and-cqrs-fb9033ccd1c6
https://hackernoon.com/migrating-to-microservices-and-event-sourcing-the-dos-and-donts-195153c7487d
https://ibm-cloud-architecture.github.io/refarch-eda/design-patterns/event-sourcing/
https://medium.com/@shijuvar/building-microservices-with-event-sourcing-cqrs-in-go-using-grpc-nats-streaming-and-cockroachdb-983f650452aa
https://eventuate.io/post/eventuate/2020/02/24/why-eventuate.html
http://chrisrichardson.net/post/antipatterns/2019/07/09/developing-sagas-part-1.html


## What is event sourcing?

- Do not mutate the state, but rather model state as a form of sequence of immutable events
- Changes to state are reflected by saving the event that triggers the change instead of actually changing the current state
- Processing each event in the stream will produce the latest state of that entity

Questions
- How do we replay event sourcing models to build the final state?
- What happens if the process crash?
- How do we deal with states such as deletion? 
- What happens if there’s inconsistency of state (having update events after deletion)
- How often do we need to build the model/or rebuild it? Do we need to compute it all the time? 
- How do we perform snapshotting?
- How do we deal with events that are versioned differently? Doesn’t that mean more hardcoding on the application layer when dealing with aggregates?
- How robust is the event sourcing against schema changes (addition or removal of fields?)
    - If the field is removed, we can ignore processing it, unless we want to query information during that time period
    - If the field is renamed, we might need to handle the naming changes
    - If new field is added, we need to ensure we process it only from the time the field is added (old events does not have new field)
- Is it related to https://en.wikipedia.org/wiki/Conflict-free_replicated_data_type
- Are the any relevant examples for event sourcing? E.g. anything to do with bank transactions is actually an event for each transaction. We need to record all the changes and the display the final amount in the bank.

Example
```go
package main

import (
	"context"
	"fmt"
	"log"
)

type UserRegisteredEvent struct {
	Email string
}

type registerUserCommand func(ctx context.Context, email, password string) (*UserRegisteredEvent, error)

type hasher func(string) (string, error)

// A factory command allows us to perform dependency injection when creating commands.
func RegisterUserCommandFactory(h hasher) registerUserCommand {
	return func(ctx context.Context, email, password string) (*UserRegisteredEvent, error) {
		// Check if email exists.
		// Hash password.
		enc, err := h(password)
		if err != nil {
			return nil, err
		}
		fmt.Println(enc)

		// Register user.

		return &UserRegisteredEvent{
			Email: email,
		}, nil
	}
}

func hashFn(s string) (string, error) {
	return fmt.Sprintf("encrypted:%s", s), nil
}

func main() {
	// Create a new command.
	cmd := RegisterUserCommandFactory(hashFn)

	// Execute.
	var (
		email    = "john.doe@mail.com"
		password = "123456"
	)

	// Command produces events or errors.
	evt, err := cmd(context.TODO(), email, password)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(evt)
}
```


### Another example

```go
package main

import (
	"context"
	"fmt"
)

type OrderEvent string

const (
	// NOTE: This does not have the flexibility to pass in params.
	OrderCreatedEvent  = OrderEvent("order_created")
	OrderRejectedEvent = OrderEvent("order_rejected")
	OrderApprovedEvent = OrderEvent("order_approved")
)

type Order struct {
	ID   string
	Name string
}

type OrderService struct{}

func (o *OrderService) createOrder(ctx context.Context, o Order) (OrderEvent, error) {
	return OrderCreatedEvent, nil
}
func (o *OrderService) approveOrder(ctx context.Context, o Order) (OrderEvent, error) {
	return OrderApprovedEvent, nil
}
func (o *OrderService) rejectOrder(ctx context.Context, o Order) (OrderEvent, error) {
	return OrderRejectedEvent, nil
}

func main() {
	fmt.Println("Hello, playground")
}
```
