/* global fetch */

export let EventEmitter;
export let Collection;
export let Model;

// Used in fetches to ensure that cookies are sent.
let credentials = 'same-origin';

EventEmitter = () => {
  const specificHandlers = new WeakMap();
  const genericHandlers = new WeakMap();

  /*
   * These symbols can be used to listen for special events emitted by an emitter when handlers are
   * added or removed. They should be avoided.
   */
  let specialEventSymbols = new Set([
     Symbol.for('vertebrate:newListener'),
     Symbol.for('vertebrate:newGenericListener'),
     Symbol.for('vertebrate:removeListener'),
     Symbol.for('vertebrate:removeGenericListener')
  ]);

  /*
   * This private method dispatches an emission to all generic handlers registered on an emitter.
   * emissions for special events are filtered out to avoid wierdness.
   */
  function emitToGenericHandlers(eventEmitter, name, args) {
    if (!specialEventSymbols.has(name)) {
      for (let handler of genericHandlers.get(eventEmitter)) {
        handler(name, ...args);
      }
    }
  }

  /*
   * This private method dispatches an emission to handlers registered on an emitter for a given
   * name. It returns true if at least one handler has received the event.
   */
  function emitToSpecificHandlers(eventEmitter, name, args) {
    let allSpecificHandlers = specificHandlers.get(eventEmitter).get(name);

    if (!allSpecificHandlers || !allSpecificHandlers.size) {
      return false;
    }

    for (let handler of allSpecificHandlers) {
      handler(...args);
    }

    return true;
  }

  return class EventEmitter {
    constructor() {
      specificHandlers.set(this, new Map());
      genericHandlers.set(this, new Set());
    }

    get [Symbol.toStringTag]() {
      return 'VertebrateEventEmitter';
    }

    emit(name, ...args) {
      if (name === undefined) {
        throw new Error('The name cannot be undefined.');
      }

      emitToGenericHandlers(this, name, args);

      return emitToSpecificHandlers(this, name, args);
    }

    addListener(name, handler) {
      if (name === undefined) {
        throw new Error('The name cannot be undefined.');
      }

      if (typeof handler !== 'function') {
        throw new Error('The handler must be a function.');
      }

      let allHandlersForThis = specificHandlers.get(this);
      let handlers = allHandlersForThis.get(name);

      if (handlers) {
        handlers.add(handler);
      } else {
        allHandlersForThis.set(name, new Set([handler]));
      }

      this.emit(Symbol.for('vertebrate:newListener'), name, handler);

      return this;
    }

    on(...args) {
      return this.addListener(...args);
    }

    addGenericListener(handler) {
      if (typeof handler !== 'function') {
        throw new Error('The handler must be a function.');
      }

      let handlers = genericHandlers.get(this);
      let alreadyHas = handlers.has(handler);

      if (!alreadyHas) {
        handlers.add(handler);
        this.emit(Symbol.for('vertebrate:newGenericListener'), handler);
      }

      return this;
    }

    removeListener(name, handler) {
      let handlers = specificHandlers.get(this).get(name);

      if (handlers && handlers.delete(handler)) {
        this.emit(Symbol.for('vertebrate:removeListener'), name, handler);
      }

      return this;
    }

    removeGenericListener(handler) {
      let handlers = genericHandlers.get(this);

      if (handlers.delete(handler)) {
        this.emit(Symbol.for('vertebrate:removeGenericListener'), handler);
      }

      return this;
    }

    removeAllListeners(name) {
      let allHandlersForThis = specificHandlers.get(this);

      let removeHandlers = name => {
        let handlers = allHandlersForThis.get(name);

        for (let handler of handlers) {
          this.emit(Symbol.for('vertebrate:removeListener'), name, handler);
        }

        allHandlersForThis.delete(name);
      };

      if (name !== undefined) {
        removeHandlers(name);
        return this;
      }

      for (let handler of genericHandlers.get(this)) {
        this.removeGenericListener(handler);
      }

      for (let name of allHandlersForThis.keys()) {
        removeHandlers(name);
      }

      return this;
    }
  };
}();

Collection = () => {
  const privateCollections = new WeakMap();
  const memberGenericEvents = new WeakMap();
  const memberChangeEvents = new WeakMap();

  // PRIVATE METHODS START

  /*
   * Sorts a collection using its comparator. If the order of models was changed by the sort, then
   * the collection will emit a "sort" event.
   */
  function sort(collection) {
    let models = privateCollections.get(collection);
    let modelsBefore = models.slice();

    models.sort(collection.comparator);

    if (models.some((model, index) => model !== modelsBefore[index])) {
      collection.emit('sort');
    }
  }

  /*
   * When a model is added to the collection, the collection will proxy its events.
   */
  function registerEvents(collection, model) {
    function genericListener(name, ...args) {
      collection.emit(name, model, ...args);
    }

    function changeListener() {
      sort(collection);
    }

    memberGenericEvents.get(collection).set(model, genericListener);
    memberChangeEvents.get(collection).set(model, changeListener);

    model.addGenericListener(genericListener);
    model.on('change', changeListener);
  }

  /*
   * When a model is removed, the collection stops proxying events from it.
   */
  function unregisterEvents(collection, model) {
    let collectionGenericEvents = memberGenericEvents.get(collection);
    let genericHandler = collectionGenericEvents.get(model);
    let collectionChangeEvents = memberChangeEvents.get(collection);
    let modelChangeHandler = collectionChangeEvents.get(model);

    if (genericHandler) {
      model.removeGenericListener(genericHandler);
    }

    if (modelChangeHandler) {
      model.removeListener('change', modelChangeHandler);
    }

    memberGenericEvents.delete(model);
  }

  /*
   * Add a new (no ID) model to a collection.
   */
  function addNew(collection, model) {
    let models = privateCollections.get(collection);

    model.collection = collection;
    models.push(model);
    registerEvents(collection, model);

    sort(collection);

    collection.emit('add', model);
  }

  /*
   * Add a model (with ID) to a collection which does not have a model with the same ID.
   */
  function addUnrepresented(collection, model) {
    let models = privateCollections.get(collection);

    model.collection = collection;
    models.push(model);
    registerEvents(collection, model);

    sort(collection);

    collection.emit('add', model);
  }

  /*
   * Replace a model in a collection with a given model, where the IDs are the same.
   */
  function replaceModel(collection, model) {
    let models = privateCollections.get(collection);
    let old = models.splice(models.indexOf(collection.get(model.id)), 1)[0];

    model.collection = collection;
    models.push(model);
    unregisterEvents(collection, old);
    registerEvents(collection, model);
    old.collection = undefined;

    sort(collection);

    collection.emit('replace', old, model);
  }

  /*
   * Update a model in a collection with the attributes of the given model, where the IDs match.
   */
  function mergeNewIntoOld(collection, model) {
    let old = collection.get(model.id);

    old.setAttributes(model.getAttributes());
  }

  /*
   * Replace a model in the collection with the given model where the IDs match, and update the
   * replacement model with the attributes of the replaced model.
   */
  function mergeOldIntoNew(collection, model) {
    let models = privateCollections.get(collection);
    let old = collection.get(model.id);

    model.collection = collection;
    model.setAttributes(old.getAttributes());
    models.splice(models.indexOf(old), 1);
    models.push(model);
    unregisterEvents(collection, old);
    old.collection = undefined;
    registerEvents(collection, model);

    sort(collection);

    collection.emit('replace', old, model);
  }

  /*
   * Handle a duplicate model in a collection according to the given strategy.
   */
  function handleDuplicate(collection, model, strategy) {
    if (strategy === 'replace') {
      return replaceModel(collection, model);
    }

    if (strategy === 'mergeNewIntoOld') {
      return mergeNewIntoOld(collection, model);
    }

    if (strategy === 'mergeOldIntoNew') {
      return mergeOldIntoNew(collection, model);
    }
  }

  // PRIVATE METHODS END

  return class Collection extends EventEmitter {
    constructor() {
      super();

      memberGenericEvents.set(this, new WeakMap());
      memberChangeEvents.set(this, new WeakMap());
      privateCollections.set(this, []);

      this.Model = Model;
    }

    * [Symbol.iterator]() {
      for (let model of privateCollections.get(this)) {
        yield model;
      }
    }

    get [Symbol.toStringTag]() {
      return 'VertebrateCollection';
    }

    get length() {
      return privateCollections.get(this).length;
    }

    url() {
      throw new Error('Subclass collection to set the URL field.');
    }

    checkResponse(res) {
      if (!res.ok) {
        throw new Error(`Unexpected response code from server: ${res.status}`);
      }

      return res;
    }

    parse(response) {
      let data = response.json();

      if (!Array.isArray(data)) {
        throw new Error('Parsed server response body was not an array.');
      }

      return data;
    }

    fetch({add = true, remove = true, merge = true} = {}) {
      return fetch(this.url(), {credentials})
        .then(response => this.checkResponse(response))
        .then(response => this.parse(response))
        .then(data => {
          let currentModels = privateCollections.get(this);
          let currentIds = currentModels.filter(model => !model.isNew()).map(model => model.id);
          let updatedModelAttributes = data.filter(datum => currentIds.includes(datum.id));

          if (remove) {
            let newIds = data.map(datum => datum.id);
            let removedModels = currentModels.filter(model => !newIds.includes(model.id));

            this.remove(removedModels);
          }

          if (add) {
            let newModelAttributes = data.filter(datum => !currentIds.includes(datum.id));

            this.add(newModelAttributes);
          }

          for (let datum of updatedModelAttributes) {
            this.get(datum.id).reset(datum, {keepExistingAsChanges: merge});
          }

          this.emit('sync');
        });
    }

    save(options) {
      return Promise.all(privateCollections.get(this).map(model => model.save(options)));
    }

    models() {
      return privateCollections.get(this).slice();
    }

    get(element) {
      let collection = privateCollections.get(this);

      if (collection.includes(element)) {
        return element;
      }

      let id = typeof element === 'object' ? element.id : element;

      return collection.find(model => model.id === id);
    }

    add(objects, {handleDuplicates = 'ignore'} = {}) {
      let modelsNotCorrect = [].concat(objects).some(object => {
        return typeof object !== 'object' || object instanceof Model && !(object instanceof this.Model);
      });

      if (modelsNotCorrect) {
        throw new Error('Models added must be non-model objects or instances of collection.Model');
      }

      let dispatchAdd = model => {
        if (model.isNew()) {
          return addNew(this, model);
        }

        let isDuplucate = privateCollections.get(this).some(collectionModel => collectionModel.id === model.id);

        if (isDuplucate) {
          return handleDuplicate(this, model, handleDuplicates);
        }

        addUnrepresented(this, model);
      };

      for (let object of [].concat(objects)) {
        dispatchAdd(object instanceof this.Model ? object : new this.Model(object));
      }

      this.emit('update');
    }

    remove(models) {
      let collection = privateCollections.get(this);
      let toRemove = [].concat(models).map(model => this.get(model)).filter(model => model);

      for (let model of toRemove) {
        collection.splice(collection.indexOf(model), 1);
        unregisterEvents(this, model);
        this.emit('remove', model);
      }

      this.emit('update');

      return toRemove;
    }

    comparator(a, b) {
      return a.id - b.id;
    }

    toJSON() {
      return privateCollections.get(this).map(model => model.toJSON());
    }
  };
}();

Model = () => {
  /*
   * IDs may be either a string or a positive integer.
   */
  function checkId(id) {
    if (typeof id === 'string') {
      return true;
    }

    if (typeof id !== 'number' || id % 1 !== 0 || id < 0) {
      return false;
    }

    return true;
  }

  const modelsAttributes = new WeakMap();
  const previousAttributes = new WeakMap();

  return class Model extends EventEmitter {
    constructor(attributes = {}, options = {}) {
      super();

      if (attributes.id !== undefined && !checkId(attributes.id)) {
        throw new Error('id must be a string or a positive integer');
      }

      modelsAttributes.set(this, attributes);
      previousAttributes.set(this, Object.assign({}, attributes));

      if (options.collection instanceof Collection) {
        this.collection = options.collection;
      }
    }

    get [Symbol.toStringTag]() {
      return 'VertebrateModel';
    }

    getAttribute(attributeName) {
      return modelsAttributes.get(this)[attributeName];
    }

    getAttributes(...attributeNames) {
      let attributes = modelsAttributes.get(this);

      if (!attributeNames.length) {
        return Object.assign({}, attributes);
      }

      let toReturn = {};

      for (let attributeName of attributeNames) {
        toReturn[attributeName] = attributes[attributeName];
      }

      return toReturn;
    }

    setAttributes(newAttributes) {
      let attributes = modelsAttributes.get(this);

      let checkToUpdate = (attributeName, newValue, oldValue) => {
        if (newValue === oldValue) {
          return false;
        }

        if (attributeName === 'id' && !checkId(newValue)) {
          return false;
        }

        return true;
      };

      for (let attributeName of Object.keys(newAttributes)) {
        let value = attributes[attributeName];
        let newValue = newAttributes[attributeName];

        if (checkToUpdate(attributeName, newValue, value)) {
          attributes[attributeName] = newValue;

          this.emit('change:' + attributeName, newValue);
        }
      }

      this.emit('change');

      return this;
    }

    get id() {
      return modelsAttributes.get(this).id;
    }

    set id(val) {
      this.set('id', val);
    }

    has(...attributeNames) {
      let attributes = modelsAttributes.get(this);

      return attributeNames.every(attributeName => attributes[attributeName] !== undefined);
    }

    clear() {
      modelsAttributes.set(this, {});

      this.emit('clear');
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
      let allUniqueKeys = new Set([...Object.keys(attributes), ...Object.keys(previous)]);
      let changes = {};

      for (let key of allUniqueKeys) {
        if (!Object.is(attributes[key], previous[key])) {
          changes[key] = attributes[key];
        }
      }

      return changes;
    }

    previous() {
      return Object.assign({}, previousAttributes.get(this));
    }

    toJSON() {
      return Object.assign({}, modelsAttributes.get(this));
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

    reset(attributes, {keepExistingAsChanges = false} = {}) {
      previousAttributes.set(this, Object.assign({}, attributes));

      if (keepExistingAsChanges) {
        modelsAttributes.set(this, Object.assign({}, attributes, modelsAttributes.get(this)));
      } else {
        modelsAttributes.set(this, Object.assign({}, attributes));
      }

      this.emit('reset');
    }

    checkResponse(res) {
      if (!res.ok) {
        throw new Error(`Unexpected response code from server: ${res.status}`);
      }

      return res;
    }

    parse(response) {
      return response.json();
    }

    fetch(options = {keepExistingAsChanges: true}) {
      return fetch(this.url(), {method: 'get', credentials})
        .then(response => this.checkResponse(response))
        .then(response => this.parse(response))
        .then(data => {
          if (data.id !== this.id) {
            throw new Error('Server ID mismatch.');
          }

          this.reset(data, options);
          this.emit('sync');
        });
    }

    save({force = false} = {}) {
      if (!force && !this.hasChanged()) {
        return Promise.resolve();
      }

      let attributes = Object.assign({}, modelsAttributes.get(this));
      let body;
      let method;
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

      return fetch(url, {method, body, headers, credentials})
        .then(response => this.checkResponse(response))
        .then(() => {
          previousAttributes.set(this, Object.assign({}, attributes));

          this.emit('sync');
        });
    }

    destroy({wait = false} = {}) {
      let collectionRemove = () => {
        if (this.collection) {
          this.collection.remove(this);
          this.collection = undefined;
        }
      };

      if (this.isNew()) {
        previousAttributes.set(this, {});
        collectionRemove();

        this.emit('destroy');

        return Promise.resolve();
      }

      let url = this.url();

      if (!wait) {
        collectionRemove();
      }

      return fetch(url, {method: 'delete', credentials})
        .then(response => this.checkResponse(response))
        .then(() => {
          previousAttributes.set(this, {});

          if (wait) {
            collectionRemove();
          }

          this.emit('destroy');
        });
    }
  };
}();
