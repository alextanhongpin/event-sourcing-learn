## Using Generics

```go
// You can edit this code!
// Click here and start typing.
package main

import "fmt"

func main() {
	person := NewPerson("person-1", 1, "John Doe", 1)
	fmt.Println(person.Name, person.Age)
	person.UpdateName("Jane")
	fmt.Println(person)
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

type PersonCreated struct {
	Name string
	Age  int64
}

func NewPersonCreated(aggregateID string, aggregateVersion int64, name string, age int64) Event[IEvent] {
	return Event[IEvent]{
		AggregateID:      aggregateID,
		AggregateVersion: aggregateVersion,
		TypeName:         "person_created",
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

func (p *Person) UpdateName(name string) Event[IEvent] {
	evt := NewPersonNameUpdated(p.Aggregate.ID, p.Aggregate.Version+1, name)
	p.Raise(evt)
	return evt
}

func NewPerson(aggregateID string, aggregateVersion int64, name string, age int64) *Person {
	agg := &Person{
		Aggregate: Aggregate{
			ID:      aggregateID,
			Version: aggregateVersion,
			Events:  make([]Event[IEvent], 0),
		},
	}
	evt := NewPersonCreated(aggregateID, aggregateVersion, name, age)
	agg.Raise(evt)
	return agg
}

func (p *Person) Apply(event Event[IEvent]) {
	switch e := any(event.Data).(type) {
	case PersonCreated:
		p.Aggregate.ID = event.AggregateID
		p.Aggregate.Version = event.AggregateVersion
		p.Name = e.Name
		p.Age = e.Age
	}
}

func (p *Person) Raise(event Event[IEvent]) {
	p.Aggregate.Events = append(p.Aggregate.Events, event)
	p.Apply(event)
}

```
