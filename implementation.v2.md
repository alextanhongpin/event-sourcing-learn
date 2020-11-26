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

## Another version

```ts
abstract class Aggregate {
  id: string
  version: number
  events: BaseEvent[]
  constructor(id: string, version: number, events: BaseEvent[] = []) {
    this.id = id
    this.version = version
    this.events = events
  }
  abstract apply(event: BaseEvent): void
}

abstract class BaseEvent {
  readonly aggregateId: string
  readonly aggregateVersion: number
  constructor(aggregateId: string, aggregateVersion: number) {
    this.aggregateId = aggregateId
    this.aggregateVersion = aggregateVersion
  } 
}

class PersonCreated extends BaseEvent {
  name: string
  constructor(aggregateId: string, aggregateVersion: number, name: string) {
    super(aggregateId, aggregateVersion)
    this.name = name
  }
}
class PersonNameChanged extends BaseEvent {
  name: string
  constructor(aggregateId: string, aggregateVersion: number, name: string) {
    super(aggregateId, aggregateVersion)
    this.name = name
  }
}

class Person extends Aggregate {
  name: string = ''
  constructor(id: string, version: number, events: BaseEvent[] = []) {
    super(id, version, events)
    for (const event of events) {
      this.apply(event)
    }
    this.events = []
  }

  apply(event: BaseEvent) {
    const eventName = event.constructor.name
    switch (eventName) {
      case PersonCreated.name: {
        const e = event as PersonCreated
        this.version = e.aggregateVersion
        this.name = e.name
        break
      }
      case PersonNameChanged.name: {
        const e = event as PersonNameChanged
        this.version = e.aggregateVersion
        this.name = e.name
        break
      }
      default:
        throw new Error(`${eventName} is not implemented`)
    }
  }

  setName(name: string) {
    const event = new PersonNameChanged(this.id, this.version + 1, name)
    this.apply(event)
    this.events.push(event)
  }

  static new(id: string, name: string): Person {
    const events = [new PersonCreated(id, 1, name)]
    const person = new Person(id, 0, events)
    person.events = events
    return person
  }
}

const person = Person.new('1', 'John')
person.setName('John Doe')
console.log(person)

for (const event of person.events) {
  console.log({...event, type: event.constructor.name})
}

interface RawEvent {
  aggregateId: string
  aggregateVersion: number
  event: string
}

const rawEvents = [ {
  "aggregateId": "1",
  "aggregateVersion": 1,
  "event": `{
    "name": "John",
    "type": "PersonCreated"
  }`
},{
  "aggregateId": "1",
  "aggregateVersion": 2,
  "event": `{
    "name": "John Doe",
    "type": "PersonNameChanged"
  }`
}]

const events = rawEvents.map((rawEvent: RawEvent) => {
  const data = JSON.parse(rawEvent.event)
  const { type: eventType, ...rest } = data
  switch (eventType) {
    case PersonCreated.name:
      return new PersonCreated(rawEvent.aggregateId, rawEvent.aggregateVersion, rest.name)
    case PersonNameChanged.name:
      return new PersonNameChanged(rawEvent.aggregateId, rawEvent.aggregateVersion, rest.name)
    default:
      throw new Error(`${eventType} is not implemented`)
  }
})

const loadedPerson = new Person('1', 2, events)
console.log(loadedPerson.version, loadedPerson)
```
