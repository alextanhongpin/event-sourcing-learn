# Event Sourcing Implementation 

Based on the following references: https://victoramartinez.com/posts/event-sourcing-in-go/

## Basic implementation of Event Sourcing in TypeScript

```ts
function generateUID(length: number): string {
  return window.btoa(Array.from(window.crypto.getRandomValues(new Uint8Array(length * 2))).map((b) => String.fromCharCode(b)).join("")).replace(/[+/]/g, "").substring(0, length);
}

class BaseEvent {
  public id: string = generateUID(5)
}

class PatientAdmitted implements BaseEvent {
  constructor(
    public id: string,
    public name: string,
    public wardNumber: number,
    public age: number
  ) {}
}

class PatientTransferred implements BaseEvent {
  constructor(
    public id: string,
    public newWardNumber: number
  ) {}
}

class PatientDischarged implements BaseEvent {
  constructor(
    public id: string
  ) {}
}

class Patient {
  discharged: boolean = false
  events: BaseEvent[] = [];
  version: number = 0

  constructor(
    public id: string = '',
    public name: string = '',
    public age: number = 0,
    public ward: number = 0
  ) {
  }

  // We use this instead of a constructor to raise the event when a new Patient is admitted.
  static new(id: string, name = '', age = 0, ward = 0): Patient {
    const patient = new Patient(id, name, age, ward)
    patient.raise(new PatientAdmitted(id, name, age, ward))
    return patient
  }

  static newFromEvents(events: BaseEvent[]): Patient {
    const patient = new Patient()
    for (let event of events) {
      patient.on(event, false)
    }
    patient.events = events
    return patient
  }

  on(event: BaseEvent, isNew: boolean = false) {
    if (event instanceof PatientAdmitted) {
      const e = (event as PatientAdmitted)
      this.id = e.id
      this.age = e.age
      this.ward = e.wardNumber
    } else if (event instanceof PatientDischarged) {
      this.discharged = true
    } else if (event instanceof PatientTransferred) {
      const e = (event as PatientTransferred)
      this.ward = e.newWardNumber
    }

    if (!isNew) {
      this.version++
    }
  }

  raise(event: BaseEvent) {
    this.events.push(event)
    this.on(event, true)
  }

  transfer(newWard: number): void {
    if (this.discharged) {
      throw new Error('ErrPatientDischarged')
    }
    this.raise(new PatientTransferred(this.id, newWard))
  }

  discharge(): void {
    if (this.discharged) {
      throw new Error('ErrPatientDischarged')
    }
    this.raise(new PatientDischarged(this.id))
  }
}


class Service {
  constructor(
    private readonly repo: Repository
  ) {}

  async transferPatient(id: string, ward: number): Promise < Patient > {
    const patient = await this.repo.load(id)
    patient.transfer(ward)
    return this.repo.save(patient)
  }
  async dischargePatient(id: string): Promise < Patient > {
    const patient = await this.repo.load(id)
    patient.discharge()
    return this.repo.save(patient)
  }
}

class Aggregate {
  constructor(
    readonly version: number,
    readonly eventType: string,
    readonly data: BaseEvent
  ) {}
}

class Repository {
  constructor(private readonly db: Record < string, Aggregate[] > = {}) {}
  async load(id: string): Promise < Patient > {
    if (!(id in this.db)) {
      return Patient.new(id)
    }
    const aggregates = this.db[id]
    return Patient.newFromEvents(aggregates.map((aggregate: Aggregate) => aggregate.data))
  }

  async save(patient: Patient): Promise < Patient > {
    const aggregates: Aggregate[] = []
    for (let i = 0; i < patient.events.length; i++) {
      const event = patient.events[i]
      const aggregate = new Aggregate(patient.version + i, event.constructor.name, event)
      aggregates.push(aggregate)
    }
    this.db[patient.id] = aggregates
    return patient
  }
}

async function main() {
  const repository = new Repository()
  const service = new Service(repository)
  await service.transferPatient('john', 1)
  await service.transferPatient('john', 40)
  await service.dischargePatient('john')

  await service.transferPatient('alice', 1)
  await service.dischargePatient('alice')

  const john = await repository.load('john')
  const alice = await repository.load('alice')
  console.log({
    john,
    alice
  })
  console.log({
    repository
  })
}

main().catch(console.error)
```

## Golang example

```go
package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"reflect"
)

type Record struct {
	Version int             `json:"int"`
	Data    json.RawMessage `json:"data"`
	Type    string          `json:"event_type"`
}

var ErrPatientDischarged = errors.New("Patient is discharged")

type Event interface {
	isEvent()
}

func (e PatientAdmitted) isEvent()    {}
func (e PatientTransferred) isEvent() {}
func (e PatientDischarged) isEvent()  {}

type PatientAdmitted struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Ward int    `json:"ward"`
	Age  int    `json:"age"`
}

type PatientTransferred struct {
	ID            string `json:"id"`
	NewWardNumber int    `json:"new_ward"`
}

type PatientDischarged struct {
	ID string `json:"id"`
}

// Patient aggregate.
type Patient struct {
	ID         string
	Ward       int
	Name       string
	Age        int
	Discharged bool

	Events  []Event
	Version int
}

func NewFromEvents(events []Event) *Patient {
	var isNew bool
	p := new(Patient)

	for _, event := range events {
		p.On(event, isNew)
	}
	p.Events = events

	return p
}

func New(id, name string, age, ward int) *Patient {
	p := new(Patient)
	p.raise(&PatientAdmitted{
		ID:   id,
		Name: name,
		Age:  age,
		Ward: ward,
	})
	return p
}

func (p *Patient) Transfer(newWard int) error {
	if p.Discharged {
		return ErrPatientDischarged
	}
	p.raise(&PatientTransferred{
		ID:            p.ID,
		NewWardNumber: newWard,
	})
	return nil
}

func (p *Patient) Discharge() error {
	if p.Discharged {
		return ErrPatientDischarged
	}
	p.raise(&PatientDischarged{
		ID: p.ID,
	})

	return nil
}

// On handles patient events on the patient aggregate.
func (p *Patient) On(event Event, new bool) {
	switch e := event.(type) {
	case *PatientAdmitted:
		p.ID = e.ID
		p.Age = e.Age
		p.Ward = e.Ward
	case *PatientDischarged:
		p.Discharged = true
	case *PatientTransferred:
		p.Ward = e.NewWardNumber
	}

	if !new {
		p.Version++
	}
}

func (p *Patient) raise(event Event) {
	p.Events = append(p.Events, event)
	isNew := true
	p.On(event, isNew)
}

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{
		repo: repo,
	}
}

func (s *Service) TransferPatient(ctx context.Context, id string, newWard int) error {
	p, err := s.repo.Load(ctx, id)
	if err != nil {
		return fmt.Errorf("error loading: %w", err)
	}
	if err := p.Transfer(newWard); err != nil {
		return fmt.Errorf("error transferring: %w", err)
	}
	if err := s.repo.Save(ctx, p); err != nil {
		return fmt.Errorf("error saving transferred patient: %w", err)
	}
	return nil
}

func (s *Service) DischargePatient(ctx context.Context, id string) error {
	p, err := s.repo.Load(ctx, id)
	if err != nil {
		return err
	}
	if err := p.Discharge(); err != nil {
		return err
	}
	if err := s.repo.Save(ctx, p); err != nil {
		return err
	}
	return nil
}

type Repository struct {
	records map[string][]Record
}

func NewRepository() *Repository {
	return &Repository{
		records: make(map[string][]Record, 0),
	}
}

func (r *Repository) Save(ctx context.Context, p *Patient) error {
	records := make([]Record, len(p.Events))
	for i, e := range p.Events {
		data, err := json.Marshal(e)
		if err != nil {
			return fmt.Errorf("marshal error: %w", err)
		}
		records[i] = Record{
			Type:    eventName(e),
			Data:    json.RawMessage(data),
			Version: p.Version + i,
		}
	}
	r.records[p.ID] = records
	return nil
}

func (r *Repository) Load(ctx context.Context, id string) (*Patient, error) {
	records, ok := r.records[id]
	if !ok {
		return New(id, "", 0, 0), nil
	}
	events := make([]Event, len(records))
	for i, r := range records {
		var e Event
		switch r.Type {
		case eventName(PatientAdmitted{}):
			e = new(PatientAdmitted)
		case eventName(PatientTransferred{}):
			e = new(PatientTransferred)
		case eventName(PatientDischarged{}):
			e = new(PatientDischarged)
		}
		if err := json.Unmarshal(r.Data, e); err != nil {
			return nil, err
		}
		events[i] = e
	}
	return NewFromEvents(events), nil
}

func eventName(event Event) string {
	t := reflect.TypeOf(event)
	if t.Kind() == reflect.Ptr {
		t = t.Elem()
	}
	return t.Name()
}

func main() {
	repo := NewRepository()
	svc := NewService(repo)
	if err := svc.TransferPatient(context.Background(), "john", 51); err != nil {
		log.Fatalf("error transfering patient: %v", err)
	}
	if err := svc.TransferPatient(context.Background(), "john", 42); err != nil {
		log.Fatalf("error transfering patient: %v", err)
	}
	if err := svc.DischargePatient(context.Background(), "john"); err != nil {
		log.Fatalf("error discharging patient: %v", err)
	}
	john, err := repo.Load(context.Background(), "john")
	if err != nil {
		log.Fatalf("error loading user: %v", err)
	}
	fmt.Println(john)
	fmt.Printf("%#v\n", repo)
}
```
