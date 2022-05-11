## Using Generics

```go
// You can edit this code!
// Click here and start typing.
package main

import (
	"errors"
	"fmt"
)

func main() {
	person, err := NewPerson("person-1", "John Doe", 1)
	if err != nil {
		panic(err)
	}
	fmt.Println(person.Name, person.Age)
	fmt.Println(person.UpdateName("Jane"))
	fmt.Println(person.Name, person.Age, person.Aggregate)
}

type IEvent interface {
	isEvent()
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
	Events  []Event[IEvent]
}

func NewAggregate(id string) *Aggregate {
	return &Aggregate{
		ID:      id,
		Version: 0,
		Events:  make([]Event[IEvent], 0),
	}
}

func (a *Aggregate) CanApply(event Event[IEvent]) error {
	if event.AggregateID != a.ID {
		return errors.New("invalid aggregate id")
	}
	if event.AggregateVersion != a.Version+1 {
		return errors.New("invalid aggregate version")
	}
	return nil
}

func (a *Aggregate) Append(event Event[IEvent]) {
	a.Events = append(a.Events, event)
}

type PersonCreated struct {
	Name string
	Age  int64
}

func NewPersonCreated(aggregateID string, aggregateVersion int64, name string, age int64) Event[IEvent] {
	return Event[IEvent]{
		AggregateID:      aggregateID,
		AggregateVersion: aggregateVersion,
		// Instead of inferring the type from the struct name, we hardcode.
		// This makes it more resistant to chance as well as accidental renaming of the event.
		TypeName: "person_created",
		Data: PersonCreated{
			Name: name,
			Age:  age,
		},
	}
}
func (p PersonCreated) isEvent() {}

type PersonNameUpdated struct {
	Name string
}

func NewPersonNameUpdated(aggregateID string, aggregateVersion int64, name string) Event[IEvent] {
	return Event[IEvent]{
		AggregateID:      aggregateID,
		AggregateVersion: aggregateVersion,
		TypeName:         "person_name_updated",
		Data: PersonNameUpdated{
			Name: name,
		},
	}
}
func (p PersonNameUpdated) isEvent() {}

type Person struct {
	Aggregate
	Name string
	Age  int64
}

func NewPerson(aggregateID string, name string, age int64) (*Person, error) {
	agg := &Person{
		Aggregate: *NewAggregate(aggregateID),
	}
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

func (p *Person) Apply(event Event[IEvent]) error {
	if err := p.Aggregate.CanApply(event); err != nil {
		return err
	}

	switch e := any(event.Data).(type) {
	case PersonCreated:
		p.Name = e.Name
		p.Age = e.Age
	case PersonNameUpdated:
		p.Name = e.Name
	default:
		return fmt.Errorf("not implemented: %s", event.TypeName)
	}
	return nil
}

func (p *Person) Raise(event Event[IEvent]) error {
	p.Aggregate.Append(event)
	return p.Apply(event)
}
```
