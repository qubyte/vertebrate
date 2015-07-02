/* global fetch */

// Utility functions start.

function checkResponse(res) {
  if (!res.ok) {
    throw new Error('Unexpected response code from server: ' + res.status);
  }

  return res;
}

function checkId(id) {
  if (typeof id === 'string') {
    return;
  }

  if (typeof id !== 'number' || id % 1 !== 0 || id < 0) {
    throw new Error('id must be a string or a positive integer');
  }
}

// Utility functions end.

// EventEmitter starts.

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

// EventEmitter ends.

// Collection starts.

export class Collection extends EventEmitter {
  constructor() {
    super();
  }
}

// Collection ends.

// Model starts.

const modelsAttributes = new WeakMap();
const previousAttributes = new WeakMap();

export class Model extends EventEmitter {
  constructor(attributes = {}, options = {}) {
    super();

    if (attributes.id !== undefined) {
      checkId(attributes.id);
    }

    modelsAttributes.set(this, attributes);
    previousAttributes.set(this, Object.assign({}, attributes));

    if (options.collection instanceof Collection) {
      this.collection = options.collection;
    }
  }

  get(attributeName) {
    return modelsAttributes.get(this)[attributeName];
  }

  set(attributeName, value) {
    let attributes = modelsAttributes.get(this);

    if (attributes[attributeName] === value) {
      return this;
    }

    if (attributeName === 'id') {
      if (attributes.id !== undefined) {
        throw new Error('Cannot change the ID of a model.');
      }

      checkId(value);
    }

    attributes[attributeName] = value;

    this.emit('change');
    this.emit('change:' + attributeName, value);

    return this;
  }

  get id() {
    return this.get('id');
  }

  set id(val) {
    this.set('id', val);
  }

  has(attributeName) {
    let attribute = modelsAttributes.get(this)[attributeName];

    return attribute !== undefined;
  }

  clear({silent = false}) {
    modelsAttributes.set(this, {});

    if (!silent) {
      this.emit('change');
    }
  }

  hasChanged(attributeName) {
    let current = modelsAttributes.get(this);
    let previous = previousAttributes.get(this);

    if (attributeName !== undefined) {
      return !Object.is(current[attributeName], previous[attributeName]);
    }

    let allKeys = new Set([...Object.keys(current), ...Object.keys(previous)]);

    for (let key of allKeys) {
      if (!Object.is(current[key], previous[key])) {
        return true;
      }
    }

    return false;
  }

  changedAttributes() {
    let attributes = modelsAttributes.get(this);
    let previous = previousAttributes.get(this);
    let allKeys = new Set([...Object.keys(attributes), ...Object.keys(previous)]);
    let changes = {};

    for (let key of allKeys) {
      if (!Object.is(attributes[key], previous[key])) {
        changes[key] = attributes[key];
      }
    }

    return changes;
  }

  previous(attribute) {
    let attributes = previousAttributes.get(this);

    if (attribute !== undefined) {
      return attributes[attribute];
    }

    return Object.assign({}, attributes);
  }

  urlRoot() {
    throw new Error('To use a model outside of a collection, a urlRoot method must be defined.');
  }

  isNew() {
    return this.id === undefined;
  }

  url() {
    if (this.isNew()) {
      throw new Error('New Models do not have IDs.');
    }

    let urlRoot = this.collection ? this.collection.url() : this.urlRoot();
    let attributes = modelsAttributes.get(this);

    return urlRoot.endsWith('/') ? urlRoot + attributes.id : urlRoot + '/' + attributes.id;
  }

  fetch(options = {}) {
    return fetch(this.url(), {method: 'get', credentials: 'same-origin'})
      .then(checkResponse)
      .then(res => {
        let data = res.json();

        if (data.id !== this.id) {
          throw new Error('Server ID mismatch.');
        }

        let preFetchAttribute = modelsAttributes.get(this);

        modelsAttributes.set(this, Object.assign({}, data, preFetchAttribute));
        previousAttributes.set(this, Object.assign({}, data));

        if (!options.silent) {
          this.emit('sync');
        }
      });
  }

  save(options = {}) {
    let body;
    let method;
    let attributes = Object.assign({}, modelsAttributes.get(this));
    let url;

    if (this.isNew()) {
      [method, url, body] = ['post', this.collection ? this.collection.url() : this.urlRoot(), attributes];
    } else {
      [method, url, body] = ['put', this.url(), attributes];
    }

    let headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    };

    return fetch(url, {method, body, headers, credentials: 'same-origin'})
      .then(checkResponse)
      .then(() => {
        previousAttributes.set(this, Object.assign({}, attributes));

        if (!options.silent) {
          this.emit('sync');
        }
      });
  }

  destroy(options = {}) {
    let wait = options.wait;

    let collectionRemove = () => {
      if (this.collection) {
        this.collection.remove(this);
        this.collection = undefined;
      }
    };

    if (this.isNew()) {
      previousAttributes.set(this, {});
      collectionRemove();

      if (!options.silent) {
        this.emit('destroy');
      }

      return Promise.resolve();
    }

    let url = this.url();

    if (!wait) {
      collectionRemove();
    }

    return fetch(url, {method: 'delete', credentials: 'same-origin'})
      .then(checkResponse)
      .then(() => {
        previousAttributes.set(this, {});

        if (wait) {
          collectionRemove();
        }

        if (!options.silent) {
          this.emit('destroy');
        }
      });
  }
}

// Model ends.
