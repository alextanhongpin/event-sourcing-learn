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
