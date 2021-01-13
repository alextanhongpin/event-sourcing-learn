# Go's implementation of Event Sourcing Aggregate and Event

```go
package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"reflect"
)

func main() {
	// Create a new Person.
	p, err := NewPerson("id-1", "john", 20)
	if err != nil {
		log.Fatal(err)
	}
	p.SetName("John Doe")
	
	fmt.Println("NewPerson", prettyJSON(p))

	// Assuming the events are serialized into JSON before stored into the EventStore.
	b, err := json.Marshal(p.Events)
	if err != nil {
		log.Fatal(err)
	}
	
	// Deserialize the JSON events into their respective types.
	var genericEvents []GenericEvent
	if err := json.Unmarshal(b, &genericEvents); err != nil {
		log.Fatal(err)
	}

	var events []event
	for _, e := range genericEvents {
		if e.PersonCreated != nil {
			events = append(events, *e.PersonCreated)
		} else if e.PersonNameChanged != nil {
			events = append(events, *e.PersonNameChanged)
		} else {
			log.Fatalf("not implemented: %#v", e)
		}
	}

	// Rebuild the Person from past events.
	p2, err := NewPersonFromEvents("id-1", events)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println("NewPersonFromEvents", prettyJSON(p2))

	// Past events are used to replay the entity to the current state,
	// but they are not stored in the entity. Only new events are appended.
	p2.SetName("alice")

	fmt.Println("p2.SetName", prettyJSON(p2))
}

func prettyJSON(v interface{}) string {
	b, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		log.Fatal(err)
	}
	return string(b)
}

type event interface {
	GetAggregateID() string
	GetAggregateVersion() int
	GetTypeName() string
}

func getTypeName(i interface{}) string {
	if t := reflect.TypeOf(i); t.Kind() == reflect.Ptr {
		return t.Elem().Name()
	} else {
		return t.Name()
	}
}

type Event struct {
	AggregateID      string `json:"aggregate_id"`
	AggregateVersion int    `json:"aggregate_version"`
	TypeName         string `json:"__typename"`
}

func (e Event) GetAggregateID() string   { return e.AggregateID }
func (e Event) GetAggregateVersion() int { return e.AggregateVersion }
func (e Event) GetTypeName() string      { return e.TypeName }

func NewEvent(aggregateID string, aggregateVersion int, typename string) Event {
	return Event{
		AggregateID:      aggregateID,
		AggregateVersion: aggregateVersion,
		TypeName:         typename,
	}
}

type PersonCreated struct {
	Event
	Name string `json:"name"`
	Age  int    `json:"age"`
}

func NewPersonCreated(aggregateID string, aggregateVersion int, name string, age int) PersonCreated {
	return PersonCreated{
		Event: NewEvent(aggregateID, aggregateVersion, getTypeName(new(PersonCreated))),
		Name:  name,
		Age:   age,
	}
}

type PersonNameChanged struct {
	Event
	Name string `json:"name"`
}

func NewPersonNameChanged(aggregateID string, aggregateVersion int, name string) PersonNameChanged {
	return PersonNameChanged{
		Event: NewEvent(aggregateID, aggregateVersion, getTypeName(new(PersonNameChanged))),
		Name:  name,
	}
}

type Aggregate struct {
	TypeName         string  `json:"__typename"`
	AggregateID      string  `json:"aggregate_id"`
	AggregateVersion int     `json:"aggregate_version"`
	Events           []event `json:"events"`
	presentVersion   int
}

func (a *Aggregate) SkipSideEffect() bool { return a.presentVersion > a.AggregateVersion }

func (a *Aggregate) Apply(e event) error {
	if a.AggregateID != e.GetAggregateID() {
		return errors.New("invalid aggregate_id")
	}
	if a.AggregateVersion+1 != e.GetAggregateVersion() {
		return errors.New("invalid aggregate version")
	}
	return nil
}

func (a *Aggregate) Raise(e event) error {
	// Override this in child, to use the child's Apply method.
	// Otherwise calling the parent's Apply method has no effect.
	// a.Events = append(a.Events, e)
	// return a.Apply(e)
	return errors.New("raise not implemented")
}

type Person struct {
	Aggregate
	Name string `json:"name"`
	Age  int    `json:"age"`
}

func (p *Person) Apply(evt event) error {
	if err := p.Aggregate.Apply(evt); err != nil {
		return err
	}

	switch e := evt.(type) {
	case PersonCreated:
		p.AggregateVersion = e.AggregateVersion
		p.Name = e.Name
		p.Age = e.Age
	case PersonNameChanged:
		p.AggregateVersion = e.AggregateVersion
		p.Name = e.Name
	default:
		return fmt.Errorf("not implemented: %s", e)
	}
	return nil
}

func (p *Person) Raise(evt event) error {
	p.Events = append(p.Events, evt)
	return p.Apply(evt)
}

func (p *Person) SetName(name string) error {
	return p.Raise(NewPersonNameChanged(p.AggregateID, p.AggregateVersion+1, name))
}

func NewPerson(aggregateID string, name string, age int) (*Person, error) {
	var aggregateVersion int

	p := new(Person)
	p.AggregateID = aggregateID
	if err := p.Raise(
		NewPersonCreated(aggregateID, aggregateVersion+1, name, age),
	); err != nil {
		return nil, err
	}
	return p, nil
}

func NewPersonFromEvents(aggregateID string, events []event) (*Person, error) {
	p := new(Person)
	p.AggregateID = aggregateID
	for _, e := range events {
		if err := p.Apply(e); err != nil {
			return nil, err
		}
	}
	return p, nil
}

type GenericEvent struct {
	*PersonCreated
	*PersonNameChanged
}

func (g *GenericEvent) UnmarshalJSON(b []byte) error {
	type obj struct {
		TypeName string `json:"__typename"`
	}
	var o obj
	if err := json.Unmarshal(b, &o); err != nil {
		return err
	}
	switch o.TypeName {
	case getTypeName(new(PersonCreated)):
		if err := json.Unmarshal(b, &g.PersonCreated); err != nil {
			return err
		}
	case getTypeName(new(PersonNameChanged)):
		if err := json.Unmarshal(b, &g.PersonNameChanged); err != nil {
			return err
		}
	default:
		return fmt.Errorf("not implemented: %s", o.TypeName)
	}
	return nil
}
```
