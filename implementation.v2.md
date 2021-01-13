# References
- https://eventsourcing.readthedocs.io/en/v8.2.4/topics/minimal.html

## Notes

See `implementation.md` for alternative. Instead of using `mutate` function, they use the `on` callback function to update the entity.
Also, events are stored per entity, and are raised instead of being published.

## TypeScript implementation
```ts
class BaseEvent {
  originatorId: string;
  originatorVersion: number;
  constructor(originatorId: string, originatorVersion: number) {
    this.originatorId = originatorId;
    this.originatorVersion = originatorVersion;
  }
}

class Created extends BaseEvent {
  foo: string;
  constructor(originatorId: string, foo = "") {
    super(originatorId, 0);
    this.foo = foo;
  }
}

class AttributeChanged extends BaseEvent {
  name: string;
  value: string;
  constructor(
    originatorId: string,
    originatorVersion: number,
    name: "foo",
    value: string
  ) {
    super(originatorId, originatorVersion);
    this.name = name;
    this.value = value;
  }
}

class Discarded extends BaseEvent {}

type SubscriberFn = (events: BaseEvent[]) => void;

let subscribers: SubscriberFn[] = [];

function publish(events: BaseEvent[]) {
  for (let subscriber of subscribers) {
    subscriber(events);
  }
}
function subscribe(subscriber: SubscriberFn) {
  subscribers.push(subscriber);
}

function unsubscribe(subscriber: SubscriberFn) {
  subscribers = subscribers.filter((fn: SubscriberFn) => fn !== subscriber);
}

class Entity {
  _foo: string;
  _isDiscarded: boolean = false;

  constructor(
    private originatorId: string,
    private originatorVersion = 0,
    foo = ""
  ) {
    this._foo = foo;
  }

  get id() {
    return this.originatorId;
  }

  get version() {
    return this.originatorVersion;
  }

  get discarded() {
    return this._isDiscarded;
  }

  incrementVersion() {
    this.originatorVersion++;
  }

  get foo() {
    return this._foo;
  }

  set foo(value: string) {
    if (this._isDiscarded) throw new Error("discarded");

    const event = new AttributeChanged(this.id, this.version, "foo", value);
    mutate(event, this);
    publish([event]);
  }

  discard() {
    if (this._isDiscarded) throw new Error("discarded");

    const event = new Discarded(this.id, this.version);
    mutate(event, this);
    publish([event]);
  }

  // Factory method to create the entity, and raise an event on creation.
  static new(foo = ""): Entity {
    const id = "xyz";
    const event = new Created(id, foo);
    const entity = mutate(event);
    if (!entity) {
      throw new Error("entity is undefined");
    }
    publish([event]);
    return entity;
  }
}

function mutate(event: BaseEvent, entity?: Entity): Entity | undefined {
  if (event instanceof Created) {
    const entity = new Entity(
      event.originatorId,
      event.originatorVersion,
      event.foo
    );
    entity.incrementVersion();
    return entity;
  } else if (event instanceof AttributeChanged) {
    const e = event as AttributeChanged;
    if (!entity) return undefined;
    if (entity.discarded) {
      throw new Error("discarded");
    }
    // Set the private variables instead to avoid max recursion stack.
    switch (e.name) {
      case "foo":
        entity._foo = e.value;
        break;
      default:
    }
    entity.incrementVersion();
    return entity;
  } else if (event instanceof Discarded) {
    if (!entity) return undefined;
    if (entity.discarded) {
      throw new Error("discarded");
    }
    entity.incrementVersion();
    entity._isDiscarded = true;
    return undefined;
  }
  return undefined;
}

async function main() {
  // A list of received events.
  const receivedEvents: BaseEvent[] = [];
  subscribe((events: BaseEvent[]) => receivedEvents.push(...events));
  const entity = Entity.new("bar");
  if (entity) {
    entity.foo = "hello";
    entity.foo = "world";
  }
  entity.discard();
  console.table({ entity });
  console.table({ receivedEvents });
}

main().catch(console.error);
```

## Another version in TypeScript

### Aggregate

We start by creating a base `Aggregate` class. Whenever we create a new entity (`Person`, `Booking` etc), we just extend the `Aggregate` class, which already provides all the basic functionality.

The constructor defines the following attributes:
- `__typename`: allows us to persist the data in the database as json, and then recreating them back to entity object, independent of programming language. We just need to create a mapper for it. In the case of a `Person` entity, the `__typename` is `Person`.
- `__aggregateId`: a unique identifier for the identity, this has to be generated
- `events`: the constructor here only accept events, and not the attributes for the object. To initialize the entity with predefined attributes, we need to create an event for it, and raise them in another factory method. This will be demonstrated later.
- `presentVersion`: present version of the entity, when rebuilding the entity from past events. This will select the max version (since the aggregate version is a number), and optionally allows us to skip unintended side-effects when replaying the events.

The two main methods for an `Aggregate` is `raise` and `apply`. There differences are as follow:

- `apply`: applies the event, updating the entity to the latest state in the process. Events are not persisted. This is usually called when rebuilding the entity from past events. This method contains an `EventProcessor` (or `CommandProcessor`), which delegates events to the right `EventHandler`.
- `raise`: when raising an event, an event is persisted, and the `apply` is called. 

See the lifecycle below for a better understanding on how this two methods works.


```ts
class Aggregate {
  // Allows deserialization from json to object.
  __typename: string
  aggregateId: string
  aggregateVersion: number = 0
  events: BaseEvent[] = []

  // Allows skipping side effect when replaying events.
  readonly presentVersion: number = 0 

  // Extended class cannot inherit private properties.
  constructor(
    aggregateId: string, 
    aggregateVersion: number = 0, 
    events: BaseEvent[] = []
    ) {
    this.__typename = this.constructor.name
    this.aggregateId = aggregateId
    this.aggregateVersion = aggregateVersion
    this.events = events
    this.presentVersion = events.length 
      ? Math.max(...events.map((evt) => evt.aggregateVersion)) 
      : 0
    
    // This will not work, because the apply method refers to the parent class, not child.
    // for (const event of events) {
    //   this.apply(event)
    // }
    // this.events = []
  }

  apply(event: BaseEvent): void {
    if (this.aggregateId !== event.aggregateId) {
      throw new Error('invalid aggregateId')
    }
    if (this.aggregateVersion + 1 !== event.aggregateVersion) {
      throw new Error('invalid aggregateVersion')
    }
  }

  raise(event: BaseEvent): void {
    this.events.push(event)
    this.apply(event)
  }

  get skipSideEffect() {
    return this.presentVersion > this.aggregateVersion
  }
}
```

### Event

Event is a description of past actions. By replaying events, we can almost always rebuild our entity to the present state. Events are raised whenever the entity executes and action, and are persisted in the database. Hence, we need to implement our own event mapper to map the json events to class (or structs, depending on the programming language). Aside from that, the events structure is pretty simple. Each event define the (final) changes in the state, not the delta changes (instead of saying increment the value of a counter by 1, we say the value is n after incrementing).


```ts
// Type-hinting for json object.
interface IEvent {
  __typename: string
  aggregateId: string
  aggregateVersion: number
}

abstract class BaseEvent implements IEvent {
  __typename: string
  constructor(
    readonly aggregateId: string, 
    readonly aggregateVersion: number
  ) {
    this.__typename = this.constructor.name
    this.aggregateId = aggregateId
    this.aggregateVersion = aggregateVersion
  }
}
```

For each event in the system, we extends the base event. One thing to note here is that for every event created, we will increment the version (current entity aggregate version plus one). This creates a kind of sorted events, and the rule for applying the event is that the next event must be a version higher than the current entity's version. Processing the events out-of-order event is not possible.

```ts
class PersonCreated extends BaseEvent {
  constructor(
    readonly aggregateId: string, 
    readonly aggregateVersion: number, 
    readonly name: string,
    readonly age: number
  ) {
    super(aggregateId, aggregateVersion)
    this.name = name
    this.age = age
  }
}

class PersonNameChanged extends BaseEvent {
  constructor(
    readonly aggregateId: string, 
    readonly aggregateVersion: number, 
    readonly name: string
  ) {
    super(aggregateId, aggregateVersion)
    this.name = name
  }
}
```

### Basic Entity
```ts
class Person extends Aggregate {
  name: string = ''
  age: number = 0
  // NOTE: The person constructor cannot receive other props to 
  // define it's properties. This is done in a separate event.
  // This ensures that the Person can be created purely by events,
  // and not second guesssing the initial properties.
  constructor(
    aggregateId: string, 
    aggregateVersion: number,
    events: BaseEvent[] = []
  ) {
    super(aggregateId, aggregateVersion, events)
    // Rebuilds the entity state from past events.
    for (const event of events) {
      this.apply(event)
    }
    // Discard past events after rebuilding to present state.
    this.events = []
  }

  apply(event: BaseEvent) {
    super.apply(event)

    switch (event.__typename) {
      case PersonCreated.name: {
        const e = event as PersonCreated
        if (!this.skipSideEffect) {
          console.log(`setting from '${this.name}' to ${e.name}`)
        }
        this.name = e.name
        this.age = e.age
        break
      }
      case PersonNameChanged.name: {
        const e = event as PersonNameChanged
        this.name = e.name
        break
      }
      default:
        throw new Error(`${event.__typename} is not implemented`)
    }
    // Update aggregate version upon completion.
    this.aggregateVersion = event.aggregateVersion
  }

  setName(name: string) {
    const event = new PersonNameChanged(this.aggregateId, this.aggregateVersion + 1, name)
    this.raise(event)
  }

  // The actual constructor that creates the user with the initial values.
  static new(aggregateId: string, name: string, age: number): Person {
    const aggregateVersion = 0
    const person = new Person(aggregateId, aggregateVersion)
    // NOTE: Create the person by raising an event, and persisting that event.
    person.raise(new PersonCreated(aggregateId, aggregateVersion+1, name, age))
    return person
  }
}
```

Let's test the implementation now:

```ts
const person = Person.new('1', 'John', 20)
person.setName('John Doe')
console.log({person})

function eventProcessor(event: IEvent): BaseEvent {
  switch (event.__typename) {
    case 'PersonCreated': {
      const e = event as PersonCreated
      return new PersonCreated(e.aggregateId, e.aggregateVersion, e.name, e.age)
    }
    case 'PersonNameChanged': {
      const e = event as PersonNameChanged
      return new PersonNameChanged(e.aggregateId, e.aggregateVersion, e.name)
    }
    default:
      throw new Error(`not implemented: ${event.__typename}`)
  }
}

const serializedEvents: IEvent[] = JSON.parse(JSON.stringify(person.events))
const deserializedEvents: BaseEvent[] = serializedEvents.map(eventProcessor)
const personFromSerializedEvent = new Person('1', 0, serializedEvents)
const personFromDeserializedEvent = new Person('1', 0, deserializedEvents)
console.log({
  personFromSerializedEvent,
  personFromDeserializedEvent
})
```
