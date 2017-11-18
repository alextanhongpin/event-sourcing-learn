// Current account states in database
const accounts = {
  account1: { balance: 100 },
  account2: { balance: 50 }
}

// Past events that is persisted in another storage
const events = [
  { type: 'open', id: 'account1', balance: 150, time: 0 },
  { type: 'open', id: 'account2', balance: 0, time: 1 },
  { type: 'transfer', fromId: 'account1', toId: 'account2', amount: 50, time: 2 }
]

// Rebuild
const accountsBuild = events.reduce((accounts, event) => {
  if (event.type === 'open') {
    if (!accounts[event.id]) {
      accounts[event.id] = {}
    }

    accounts[event.id].balance = event.balance
  } else if (event.type === 'transfer') {
    if (!accounts[event.fromId]) {
      accounts[event.fromId] = {}
    }

    if (!accounts[event.toId]) {
      accounts[event.toId] = {}
    }
    accounts[event.fromId].balance -= event.amount
    accounts[event.toId].balance += event.amount
  }
  return accounts
}, {})

console.log('#build events', accountsBuild)

// Undo last events
const accountsUndo = events.splice(-1).reduce((accounts, event) => {
  if (event.type === 'open') {
    delete accounts[event.id]
  } else if (event.type === 'transfer') {
    if (!accounts[event.fromId]) {
      accounts[event.fromId] = {}
    }

    if (!accounts[event.toId]) {
      accounts[event.toId] = {}
    }
    accounts[event.fromId].balance += event.amount
    accounts[event.toId].balance -= event.amount
  }
  return accounts
}, accountsBuild)

console.log('#undo events', accountsUndo)

// Query specific time
function getAccountsAtTime (time) {
  return events.reduce((accounts, event) => {
    if (time > event.time) {
      return accounts
    }

    if (event.type === 'open') {
      if (!accounts[event.id]) {
        accounts[event.id] = {}
      }
      accounts[event.id].balance = event.balance
    } else if (event.type === 'transfer') {
      if (!accounts[event.fromId]) {
        accounts[event.fromId] = {}
      }

      if (!accounts[event.toId]) {
        accounts[event.toId] = {}
      }

      accounts[event.fromId].balance -= event.amount
      accounts[event.toId].balance += event.amount
    }
    return accounts
  }, {})
}

const accountsOut = getAccountsAtTime(2)
console.log(accountsOut)
