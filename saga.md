## Naive Saga

```js
class CreateOrderSaga {
  constructor() {
    this.actions = [
      [this.createOrder, this.cancelOrder],
      [this.createPayment, this.cancelPayment],
      [this.createDelivery, this.cancelDelivery],
      [this.approveOrder, null]
    ]
    this.status = 0 // 0: Execute, 1: Compensate, refers to the index of the nested array in this.actions
    this.progress = 0
  }

  exec() {
    if (!this.status) {
      while (this.progress < this.actions.length) {
        try {
          const ok = Math.random() < 0.4
          const result = this.actions[this.progress][this.status]?.(ok)
          console.log(result)
          if (!ok) {
            throw new Error('failed')
          }
          this.progress++
        } catch (error) {
          console.log(error)
          this.status = 1
          break
        }
      }
    }
    if (this.status) {
      while (this.progress > -1) {
        this.progress--
        try {
          const result = this.actions[this.progress][this.status]?.()
          console.log(result)
        } catch (error) {
          break
        }
      }
    }
    const success = this.status === 0 && this.progress === this.actions.length - 1
    const failure = this.status === 1 && this.progress === 0
    return {
      success,
      failure
    }
  }

  createOrder(ok = true) {
    console.log('creating order') // NOTE: This is event, we can also send command to trigger the next step, e.g. REQUEST_CREATE_PAYMENT.
    return ok ? 'ORDER_CREATED' : 'ORDER_CREATION_FAILED'
  }
  cancelOrder(ok = true) {
    console.log('cancelling order')
    return ok ? 'ORDER_CANCELLED' : 'ORDER_CANCELLATION_FAILED'
  }
  createPayment(ok = true) {
    console.log('creating payment')
    return ok ? 'PAYMENT_CREATED' : 'PAYMENT_REJECTED'
  }
  cancelPayment(ok = true) {
    console.log('cancelling payment')
    return ok ? 'PAYMENT_CANCELLED' : ''
  }
  createDelivery(ok = true) {
    console.log('creating delivery')
    return ok ? 'DELIVERY_CREATED' : 'DELIVERY_REJECTED'
  }
  cancelDeliver(ok = true) {
    console.log('cancelling delivery')
    return ok ? 'DELIVERY_CANCELLED' : 'DELIVERY_CANCELLED_FAILED'
  }
  approveOrder(ok = true) {
    console.log('approving order')
    return ok ? 'ORDER_APPROVED' : 'ORDER_REJECTED'
  }
}

const createOrderSaga = new CreateOrderSaga()
createOrderSaga.exec()
```
