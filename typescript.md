## Implementation in Typescript

This example demonstrate the following components in an event-sourcing system

- event
- event handler
- event processor
- event bus
- command
- command handler
- command processor
- command bus

```ts
interface BookRoomDto {
  guestName: string
  startDate: Date
  endDate: Date
}

class Controller {
  constructor(private readonly commandBus: CommandBus) {
  }

  bookRoom(dto: BookRoomDto) {
    console.log('[Controller] Booking room', { dto })
    const bookRoomCmd = new BookRoomCommand(
      '1',
      dto.guestName,
      dto.startDate,
      dto.endDate
    )
    this.commandBus.send(bookRoomCmd)
  }
}

// CommandBus transports commands to command handlers.
class CommandBus {
  constructor(private commandHandlers: Record<string, CommandHandler> = {}) {}

  send(cmd: Command) {
    console.log('[CommandBus] sending cmd', {cmd})
    const name = cmd.constructor.name
    const handler = this.commandHandlers[name]
    handler.handle(cmd)
  }

  receive(cmd: Command, fn: CommandHandler) {
    console.log(`[CommandBus] registered command handler(${fn.constructor.name}) for command(${cmd.name})`)
    const name = cmd.name
    if (this.commandHandlers[name]) {
      throw new Error('Only one CommandHandler per Command')
    }
    this.commandHandlers[name] = fn
    console.log('commandHandlers', this.commandHandlers)
  }
}


// Command is a simple data structure, representing the request for executing some operation.
class Command {}

class BookRoomCommand extends Command {
  constructor(
    readonly roomId: string,
    readonly guestName: string,
    readonly startDate: Date,
    readonly endDate: Date
  ) {
    super()
  }
}


// CommandProcessor determines which CommandHandler should handle the command received from the command bus.
class CommandProcessor {
  constructor(
    private readonly commandBus: CommandBus, 
  ) {}

  register(cmd: Command, handler: CommandHandler) {
    this.commandBus.receive(cmd, handler)
  }
}

// CommandHandler receives a command and handle it with the handle method.
// If using DDD, CommandHandler may modify and persist the aggregate.
// In constrast to EventHandler, every Command must have only one CommandHandler.
abstract class CommandHandler {
  abstract handle(cmd: Command): void
}

class BookRoomCommandHandler extends Command {  
  constructor(private readonly eventBus: EventBus) {
    super()
  }

  handle(command: Command): void {
    const cmd = command as BookRoomCommand
    // Do work with aggregate.
    // Raise events.
    // Save to repository.
    // Create event.
    // Publish event.
    this.eventBus.publish(new RoomBookedEvent(
      'random-id', 
      cmd.roomId, 
      cmd.guestName, 
      1_000, // Fake price
      cmd.startDate,
      cmd.endDate
    ))
  }
}

// Event represents something that already took place. Events are immutable.
class BaseEvent {}
class RoomBookedEvent {
  constructor(
    private readonly reserverationId: string,
    private readonly roomId: string,
    private readonly guestName: string,
    private readonly price: number,
    private readonly startDate: Date,
    private readonly endDate: Date
  ) {}
}

// EventBus transports events to event handlers.
class EventBus {
  constructor(private readonly eventHandlers: Record<string, EventHandler[]> = {}) {}

  publish(event: BaseEvent): void {
    // Object name...
    const eventHandlers = this.eventHandlers[event.constructor.name]
    eventHandlers.forEach((fn: EventHandler) => fn.handle(event))
  }

  subscribe(event: BaseEvent, fn: EventHandler) {
    console.log(`[EventBus] subscribed event handler(${fn.constructor.name}) for event(${event.name})`)
    // Class name...
    const name = event.name
    if (!this.eventHandlers[name]) {
      this.eventHandlers[name] = []
    }
    this.eventHandlers[name].push(fn)
  }
}
// EventHandler receives events and handles them with its handle method.
// If using DDD, EventHandler may modify and persist the aggregate.
// It can also invoke  a process manager, a saga or ust build a read model.
// In contrast to CommandHandler, every Event can have multiple EventHandlers.
abstract class BaseEventHandler {
  abstract handle(event: BaseEvent): void
}

class OrderBeerOnRoomBooked extends BaseEventHandler {
  constructor(private readonly commandBus: CommandBus) {
    super()
  }

  handle(event: BaseEvent) {
    console.log(`[OrderBeerOnRoomBooked]: received event`, {event})
    // E.g. execute the next command.
  }
}

// EventProcessor determines which EventHandler should handle event received from event bus.
class EventProcessor {
  constructor(private readonly eventBus: EventBus) {}

  register(event: BaseEvent, eventhandler: BaseEventHandler) {
    this.eventBus.subscribe(event, eventhandler)
  }
}

abstract class EventHandler {
  abstract handle(event: BaseEvent): void
}


async function main() {
  const commandBus = new CommandBus()
  const eventBus = new EventBus()
  const commandProcessor = new CommandProcessor(commandBus)
  commandProcessor.register(BookRoomCommand, new BookRoomCommandHandler(eventBus))

  const eventProcessor = new EventProcessor(eventBus)
  eventProcessor.register(RoomBookedEvent, new OrderBeerOnRoomBooked(commandBus))

  const controller = new Controller(commandBus)
  controller.bookRoom({
    guestName: "john doe",
    startDate: new Date(2020, 0, 1),
    endDate: new Date(2020, 0, 7)
  } as BookRoomDto)
}

main().catch(console.error)
```
