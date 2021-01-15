## Publishing events in Repository Layer


After calling a repository successfully, we may want to perform additional (non-critical) actions, such as updating cache, or sending results to websocket, or slack notification.

Critical actions such as sending email or publishing events should be done separately using a message queue, to allow retries in the case of failure. One approach is to use channels to publish the events to a background worker.


```go
package main

import (
	"fmt"
	"reflect"
	"sync"
	"time"
)

func getTypeName(i interface{}) string {
	if t := reflect.TypeOf(i); t.Kind() == reflect.Ptr {
		return t.Elem().Name()
	} else {
		return t.Name()
	}
}

type Event interface {
	TypeName() string
}

type UserCreated struct {
	Name  string
	Email string
}

func (u UserCreated) TypeName() string {
	return getTypeName(new(UserCreated))
}

type UserRepository struct {
	ch chan Event
}

func (u *UserRepository) CreateUser(name, email string) (err error) {
	var e UserCreated
	defer func() {
		if err == nil {
			select {
			case u.ch <- e:
			default:
			}
		}
	}()
	e = UserCreated{
		Name:  name,
		Email: email,
	}
	return nil
}

func NewUserRepository(ch chan Event) *UserRepository {
	return &UserRepository{
		ch: ch,
	}
}

func main() {

	var wg sync.WaitGroup

	ch := make(chan Event, 1_000_000)
	done := make(chan struct{})

	wg.Add(1)
	go func() {
		defer wg.Done()

		for {
			select {
			case <-done:
				fmt.Println("channel closed")
				return
			case msg, ok := <-ch:
				if !ok {
					return
				}
				switch v := msg.(type) {
				case UserCreated:
					fmt.Printf("Received event UserCreated with Name=%s and Email=%s\n", v.Name, v.Email)
				default:
					fmt.Println("not implemented")
				}
			}
		}

	}()

	repo := NewUserRepository(ch)
	_ = repo.CreateUser("john", "john.doe@mail.com")

	time.Sleep(3 * time.Second)
	close(done)
	wg.Wait()
	fmt.Println("exit")
}
```

Here's a similar implementation, but instead of sending events, we just send the number of operation performed (one transaction may have multiple operations) to use it to trigger the database to pool events from the outbox table:

```go
package main

import (
	"fmt"
	"sync"
	"time"
)

type UserRepository struct {
	ch chan int64
}

func (u *UserRepository) CreateUser(name, email string) (err error) {
	defer func() {
		if err == nil {
			select {
			case u.ch <- 1:
			default:
			}
		}
	}()
	return nil
}

func NewUserRepository(ch chan int64) *UserRepository {
	return &UserRepository{
		ch: ch,
	}
}

func main() {

	var wg sync.WaitGroup

	ch := make(chan int64, 10)
	done := make(chan struct{})

	wg.Add(1)
	go func() {
		defer wg.Done()
		var counter int64
		var threshold int64 = 2
		duration := 5 * time.Second

		t := time.NewTicker(duration)
		defer t.Stop()

		// Alternatively, we can combine the ticker and threshold concept, like redis snapshotting logic.
		// E.g.
		// 1000 5 // If there are at least 1000 items every 5 seconds, process it.
		// 100 10
		// 10 20
		// 1 30 // If there is at least 1 item every 30 seconds, process it.

		for {
			select {
			case <-done:
				fmt.Println("channel closed")
				return
			case <-t.C:
				fmt.Println("pooling")
			case i, ok := <-ch:
				if !ok {
					return
				}
				counter += i
				fmt.Println("counter is now", counter)
				if counter%threshold == 0 {
					fmt.Println("do work")
					// Reset to ensure the number never gets too big.
					counter = 0
				}
				// We can perform actions when
				// 1. counter reach a certain threshold
				// 2. the duration exceeded a threshold
				//
				// Example of actions is pooling the database in Outbox Pattern
				// for publishing events to the message queue.
			}
		}

	}()

	repo := NewUserRepository(ch)
	_ = repo.CreateUser("john", "john.doe@mail.com")
	_ = repo.CreateUser("alice", "alice@mail.com")
	_ = repo.CreateUser("bob", "bob@mail.com")
	_ = repo.CreateUser("carl", "carl@mail.com")

	time.Sleep(10 * time.Second)
	close(done)
	wg.Wait()
	fmt.Println("exit")
}
```

## Publishing events in Service Layer

Note that the responsibility may also lie in the Service Layer.
