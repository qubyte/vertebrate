class Handler {
  constructor(callback, times) {
    this.callback = callback;
    this.callsLeft = times;
  }

  use(...args) {
    if (this.callsLeft > 0) {
      this.callback(...args);
      this.callsLeft--;
    }

    if (this.callsLeft === 0) {
      this.callback = null;
    }
  }

  get done() {
    return !!this.callback;
  }
}

const allHandlers = new WeakMap();
const callbackToHandlerLinks = new WeakMap();

function addHandler(emitter, name, handler) {
  const allHandlersForEmitter = allHandlers.get(emitter);
  const handlers = allHandlersForEmitter.get(name);

  if (handlers) {
    handlers.add(handler);
  } else {
    allHandlersForEmitter.set(name, new Set([handler]));
  }
}

function addLink(emitter, name, callback, handler) {
  const callbackToHandlerLinksForEmitter = callbackToHandlerLinks.get(emitter);
  const links = callbackToHandlerLinksForEmitter.get(name);

  if (links) {
    links.set(callback, handler);
  } else {
    callbackToHandlerLinksForEmitter.set(name, new Map([[callback, handler]]));
  }
}

export default class EventEmitter {
  constructor() {
    allHandlers.set(this, new Map());
    callbackToHandlerLinks.set(this, new Map());
  }

  emit(name, ...args) {
    if (name === undefined) {
      throw new Error('The name cannot be undefined.');
    }

    const handlers = allHandlers.get(this).get(name);
    const links = callbackToHandlerLinks.get(this).get(name);

    if (!handlers || !handlers.size) {
      return;
    }

    for (const handler of handlers) {
      handler.use(...args);

      if (handler.done) {
        handlers.delete(handler);
        links.delete(handler.callback);
      }
    }
  }

  addListener(name, callback, times = Infinity) {
    if (name === undefined) {
      throw new Error('The name cannot be undefined.');
    }

    if (typeof callback !== 'function') {
      throw new Error('The handler must be a function.');
    }

    const handler = new Handler(callback, times);

    addHandler(this, name, handler);
    addLink(this, name, callback, handler);
  }

  on(...args) {
    return this.addListener(...args);
  }

  removeListener(name, callback) {
    const link = callbackToHandlerLinks.get(this).get(name);
    const handlers = allHandlers.get(this).get(name);

    if (!link) {
      return;
    }

    const handler = link.get(callback);

    if (handler && handlers) {
      handlers.delete(handler);
      link.delete(callback);
    }
  }

  removeAllListeners(name) {
    if (name === undefined) {
      allHandlers.get(this).clear();
      callbackToHandlerLinks.get(this).clear();
      return;
    }

    const handlers = allHandlers.get(this).get(name);

    if (handlers) {
      handlers.clear();
    }

    const links = callbackToHandlerLinks.get(this).get(name);

    if (links) {
      links.clear();
    }
  }
}
