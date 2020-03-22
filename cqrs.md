## CQRS

Inspired by NestJS CQRS https://docs.nestjs.com/recipes/cqrs

```js
class EventEmitter {}
const EventBus = (eventName) {
  const eventEmitter = new EventEmitter()
  return {
    handle: (fn) => eventEmitter.on(eventName, fn)
    execute: (params) => eventEmitter.emit(eventName, params)
  }
}
const eventBus = EventBus('user_created')

class UserService {
  constructor(commandBus) {
    this.commandBus = commandBus
  }

  createUser(params) {
    this.commandBus.execute(new CreateUserCommand(params))
  }
}

class CreateUserCommand {
  email: ''
  name: ''
}

class CreateUserCommandHandler {
  constructor(eventBus, userRepository) {
    this.eventBus = eventBus
    this.userRepository = userRepository
  }

  async execute(createUserCommand) {
    const user = await this.userRepository.save(createUserCommand)
    this.eventBus.emit('user_created', new UserCreatedEvent(user))
  }
}

class UserCreatedEvent {
  id = ''
  name = ''
  email = ''
}


class UserCreatedEventHandler {
  constructor(eventBus) {
    this.eventBus = eventBus
    this.eventBus.on('user_created', this.handle.bind(this))
  }

  handle(userCreatedEvent) {
    console.log(userCreatedEvent)
  }
}
```
