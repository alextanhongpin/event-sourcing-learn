## Using Generics

```go
// You can edit this code!
// Click here and start typing.
package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
)

const (
	PersonNameUpdatedEvent = "person_name_updated"
	PersonCreatedEvent     = "person_created"
)

func main() {
	person, err := NewPerson("person-1", "John Doe", 1)
	if err != nil {
		panic(err)
	}
	fmt.Println(person.Name, person.Age)
	fmt.Println(person.UpdateName("Jane"))
	fmt.Println(person.Name, person.Age, person.Aggregate)

	b, err := json.Marshal(person.Events)
	if err != nil {
		panic(err)
	}
	fmt.Println(string(b))
	var jsonEvents []JSONEvent
	if err := json.Unmarshal(b, &jsonEvents); err != nil {
		panic(err)
	}
	fmt.Println("JSONEvents", jsonEvents)
	events := make([]Event[any], len(jsonEvents))
	for i, je := range jsonEvents {
		events[i] = je.Event
	}
	person2, err := NewPersonFromEvents(person.Aggregate.ID, events)
	if err != nil {
		panic(err)
	}
	fmt.Println("person 2", person2)
	if err := person2.UpdateName("jessie"); err != nil {
		panic(err)
	}

	// Only new events should be appended. This new events will then be saved in the storage layer.
	fmt.Println("person 2: updated name", person2)
}

type JSONEvent struct {
	Event[any]
}

func (j *JSONEvent) UnmarshalJSON(raw []byte) error {
	type event struct {
		Event[any]
		Data json.RawMessage `json:"data"`
	}
	var e event
	if err := json.Unmarshal(raw, &e); err != nil {
		return fmt.Errorf("JSONEvent.UnmarshalJSON Error: %w", err)
	}

	dec := json.NewDecoder(bytes.NewReader(e.Data))
	dec.DisallowUnknownFields()

	switch e.Event.TypeName {
	case PersonCreatedEvent:
		var data PersonCreated
		if err := dec.Decode(&data); err != nil {
			return err
		}
		e.Event.Data = data
	case PersonNameUpdatedEvent:
		var data PersonNameUpdated
		if err := dec.Decode(&data); err != nil {
			return err
		}
		e.Event.Data = data
	default:
		return fmt.Errorf("JSONEvent.UnmarshalJSON Error: invalid typename %s", j.Event.TypeName)
	}

	j.Event = e.Event
	return nil
}

type Event[T any] struct {
	AggregateID      string `json:"aggregateId"`
	AggregateVersion int64  `json:"aggregateVersion"`
	TypeName         string `json:"__typename"`
	Data             T      `json:"data"`
}

type Aggregate struct {
	ID      string
	Version int64
	Events  []Event[any]
}

func NewAggregate(id string) *Aggregate {
	return &Aggregate{
		ID:      id,
		Version: 0,
		Events:  make([]Event[any], 0),
	}
}

func (a *Aggregate) CanApply(event Event[any]) error {
	if event.AggregateID != a.ID {
		return errors.New("invalid aggregate id")
	}
	if event.AggregateVersion != a.Version+1 {
		return errors.New("invalid aggregate version")
	}
	return nil
}

func (a *Aggregate) Apply(event Event[any]) error {
	if err := a.CanApply(event); err != nil {
		return err
	}
	a.Version = event.AggregateVersion
	return nil
}

func (a *Aggregate) Append(event Event[any]) {
	a.Events = append(a.Events, event)
}

type PersonCreated struct {
	Name string `json:"name"`
	Age  int64  `json:"age"`
}

func NewPersonCreated(aggregateID string, aggregateVersion int64, name string, age int64) Event[any] {
	return Event[any]{
		AggregateID:      aggregateID,
		AggregateVersion: aggregateVersion,
		// Instead of inferring the type from the struct name, we hardcode.
		// This makes it more resistant to chance as well as accidental renaming of the event.
		TypeName: PersonCreatedEvent,
		Data: PersonCreated{
			Name: name,
			Age:  age,
		},
	}
}

type PersonNameUpdated struct {
	Name string `json:"name"`
}

func NewPersonNameUpdated(aggregateID string, aggregateVersion int64, name string) Event[any] {
	return Event[any]{
		AggregateID:      aggregateID,
		AggregateVersion: aggregateVersion,
		TypeName:         PersonNameUpdatedEvent,
		Data: PersonNameUpdated{
			Name: name,
		},
	}
}

type Person struct {
	Aggregate
	Name string
	Age  int64
}

func NewPerson(aggregateID string, name string, age int64) (*Person, error) {
	agg := &Person{
		Aggregate: *NewAggregate(aggregateID),
	}

	// The creator of the event must increment the event version.
	evt := NewPersonCreated(agg.Aggregate.ID, agg.Aggregate.Version+1, name, age)
	if err := agg.Raise(evt); err != nil {
		return nil, err
	}
	return agg, nil
}

func (p *Person) UpdateName(name string) error {
	evt := NewPersonNameUpdated(p.Aggregate.ID, p.Aggregate.Version+1, name)
	return p.Raise(evt)
}

func (p *Person) Apply(events ...Event[any]) error {
	for _, evt := range events {
		if err := p.Aggregate.Apply(evt); err != nil {
			return err
		}

		switch e := any(evt.Data).(type) {
		case PersonCreated:
			p.Name = e.Name
			p.Age = e.Age
		case PersonNameUpdated:
			p.Name = e.Name
		default:
			return fmt.Errorf("not implemented: %s", evt.TypeName)
		}
	}

	return nil
}

func (p *Person) Raise(events ...Event[any]) error {
	for _, evt := range events {
		if err := p.Apply(evt); err != nil {
			return err
		}
		p.Aggregate.Append(evt)
	}
	return nil
}

func NewPersonFromEvents(aggregateID string, events []Event[any]) (*Person, error) {
	p := &Person{
		Aggregate: *NewAggregate(aggregateID),
	}
	if err := p.Apply(events...); err != nil {
		return nil, err
	}
	return p, nil
}
```
