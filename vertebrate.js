const allHandlers = new WeakMap();

export class EventEmitter {
  constructor() {
    allHandlers.set(this, new Map());
  }

  emit(name, ...args) {
    if (name === undefined) {
      throw new Error('The name cannot be undefined.');
    }

    let handlers = allHandlers.get(this).get(name);

    if (!handlers || !handlers.size) {
      return false;
    }

    for (let handler of handlers) {
      handler(...args);
    }

    return true;
  }

  addListener(name, handler) {
    if (name === undefined) {
      throw new Error('The name cannot be undefined.');
    }

    if (typeof handler !== 'function') {
      throw new Error('The handler must be a function.');
    }

    let allHandlersForThis = allHandlers.get(this);
    let handlers = allHandlersForThis.get(name);

    if (handlers) {
      handlers.add(handler);
    } else {
      allHandlersForThis.set(name, new Set([handler]));
    }

    this.emit('newListener', name, handler);

    return this;
  }

  on(...args) {
    return this.addListener(...args);
  }

  removeListener(name, handler) {
    let handlers = allHandlers.get(this).get(name);

    if (handlers && handlers.delete(handler)) {
      this.emit('removeListener', name, handler);
    }

    return this;
  }

  removeAllListeners(name) {
    let allHandlersForThis = allHandlers.get(this);

    let removeHandlers = name => {
      let handlers = allHandlersForThis.get(name);

      for (let handler of handlers) {
        this.emit('removeListener', name, handler);
      }

      allHandlersForThis.delete(name);
    };

    if (name === undefined) {
      for (let name of allHandlersForThis.keys()) {
        removeHandlers(name);
      }
    } else {
      removeHandlers(name);
    }

    return this;
  }
}
