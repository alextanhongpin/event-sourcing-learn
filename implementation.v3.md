# Another golang implementation

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

type TodoEvent interface {
	ID() string
	Version() int
	Data() (json.RawMessage, error)
	SetData(json.RawMessage) error
}

type TodoCreatedData struct {
	Name string
}
type TodoCreated struct {
	id      string
	version int
	data    TodoCreatedData
}

func NewTodoCreated(id string, version int, name string) *TodoCreated {
	return &TodoCreated{
		id:      id,
		version: version,
		data: TodoCreatedData{
			Name: name,
		},
	}
}

func (t *TodoCreated) ID() string   { return t.id }
func (t *TodoCreated) Version() int { return t.version }
func (t *TodoCreated) Data() (json.RawMessage, error) {
	b, err := json.Marshal(t.data)
	if err != nil {
		return nil, err
	}
	return json.RawMessage(b), nil
}
func (t *TodoCreated) SetData(raw json.RawMessage) error {
	return json.Unmarshal(raw, &t.data)
}

type TodoCompletedData struct {
	Completed bool
}
type TodoCompleted struct {
	id      string
	version int
	data    TodoCompletedData
}

func NewTodoCompleted(id string, version int) *TodoCompleted {
	return &TodoCompleted{
		id:      id,
		version: version,
		data: TodoCompletedData{
			Completed: true,
		},
	}
}
func (t *TodoCompleted) ID() string   { return t.id }
func (t *TodoCompleted) Version() int { return t.version }
func (t *TodoCompleted) Data() (json.RawMessage, error) {
	b, err := json.Marshal(t.data)
	if err != nil {
		return nil, err
	}
	return json.RawMessage(b), nil
}
func (t *TodoCompleted) SetData(raw json.RawMessage) error {
	return json.Unmarshal(raw, &t.data)
}

type Todo struct {
	id      string
	version int

	name      string
	completed bool
	events    []TodoEvent
}

func NewTodo(id string) *Todo {
	t := &Todo{
		id:     id,
		events: make([]TodoEvent, 0),
	}
	return t
}

func NewTodoFromEvents(id string, version int, events []TodoEvent) *Todo {
	t := NewTodo(id)
	t.version = version
	for _, event := range events {
		t.On(event, true)
	}
	return t
}

func (t *Todo) raise(event TodoEvent) {
	// No events are loaded when loading the entity from the store.
	// Only local events are applied here.
	t.events = append(t.events, event)
	t.On(event, false)
}

func (t *Todo) On(event TodoEvent, isNew bool) {
	switch e := event.(type) {
	case *TodoCreated:
		t.id = e.ID()
		t.version = e.Version()
		t.name = e.data.Name
	case *TodoCompleted:
		t.id = e.ID()
		t.version = e.Version()
		t.completed = e.data.Completed
	default:
	}
	// Only update the version if the event is not new.
	if isNew {
		t.version++
	}
}

func (t *Todo) MarkCompleted() error {
	if t.completed {
		return errors.New("cannot change status of completed todo")
	}
	t.raise(NewTodoCompleted(t.id, t.version))
	return nil
}

func (t *Todo) SetName(name string) error {
	if t.completed {
		return errors.New("cannot change name of completed todo")
	}
	t.raise(NewTodoCreated(t.id, t.version, name))
	return nil
}

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{
		repo: repo,
	}
}

func (s *Service) Query(ctx context.Context, id string) (*Todo, error) {
	return s.repo.Load(ctx, id)
}

func (s *Service) CreateTodo(ctx context.Context, name string) (*Todo, error) {
	todo, err := s.repo.Load(ctx, "xyz")
	if err != nil {
		return nil, err
	}
	if err := todo.SetName(name); err != nil {
		return nil, err
	}
	if err := s.repo.Write(ctx, todo); err != nil {
		return nil, err
	}
	return todo, nil
}

func (s *Service) MarkCompleted(ctx context.Context, id string) error {
	todo, err := s.repo.Load(ctx, id)
	if err != nil {
		return err
	}
	if err := todo.MarkCompleted(); err != nil {
		return err
	}
	if err := s.repo.Write(ctx, todo); err != nil {
		return err
	}
	return nil
}
func eventName(event TodoEvent) string {
	t := reflect.TypeOf(event)
	if t.Kind() == reflect.Ptr {
		t = t.Elem()
	}
	return t.Name()
}

type RawTodoEvent struct {
	ID      string
	Version int
	Name    string
	Data    json.RawMessage
}

type Repository struct {
	aggregates map[string]*Todo
	events     map[string][]RawTodoEvent
}

func NewRepository() *Repository {
	return &Repository{
		aggregates: make(map[string]*Todo),
		events:     make(map[string][]RawTodoEvent),
	}
}

func (r *Repository) Load(ctx context.Context, id string) (*Todo, error) {
	todo, ok := r.aggregates[id]
	if !ok {
		return NewTodo(id), nil
	}
	rawEvents := r.events[id]
	events := make([]TodoEvent, len(rawEvents))
	for idx, rawEvent := range rawEvents {
		var event TodoEvent
		switch rawEvent.Name {
		case eventName(&TodoCreated{}):
			event = NewTodoCreated(rawEvent.ID, rawEvent.Version, "")
			event.SetData(rawEvent.Data)
		case eventName(&TodoCompleted{}):
			event = NewTodoCompleted(rawEvent.ID, rawEvent.Version)
			event.SetData(rawEvent.Data)
		default:
		}

		events[idx] = event
	}
	return NewTodoFromEvents(todo.id, todo.version, events), nil
}

func (r *Repository) Write(ctx context.Context, todo *Todo) error {
	rawEvents := make([]RawTodoEvent, len(todo.events))
	for idx, event := range todo.events {
		rawData, err := event.Data()
		if err != nil {
			return err
		}
		rawEvents[idx] = RawTodoEvent{
			ID:      event.ID(),
			Version: event.Version(),
			Data:    rawData,
			Name:    eventName(event),
		}
	}
	r.events[todo.id] = append(r.events[todo.id], rawEvents...)
	r.aggregates[todo.id] = todo
	return nil
}

func main() {
	t := NewTodo("1")
	t.SetName("hello")

	if err := t.MarkCompleted(); err != nil {
		log.Println(err)
	}
	if err := t.MarkCompleted(); err != nil {
		log.Println(err)
	}
	fmt.Printf("%#v\n", t)
	for i, event := range t.events {
		fmt.Printf("%d: %#v\n", i, event)
	}
	repo := NewRepository()
	service := NewService(repo)
	ctx := context.Background()
	todo, err := service.CreateTodo(ctx, "hello")
	if err != nil {
		log.Fatal(err)
	}
	if err := service.MarkCompleted(ctx, todo.id); err != nil {
		log.Fatal(err)
	}
	log.Printf("Repo: %#v\n", repo)
	todo, err = service.Query(ctx, todo.id)
	if err != nil {
		log.Fatal(err)
	}
	log.Printf("Todo: %#v\n", todo)
}
```
