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
