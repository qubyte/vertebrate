# vertebrate

Inspired by Backbone, crafted in ES6.

This library currently houses only a minimalist event emitter implementation and a model
implementation.

Why? Because whilst Backbone is small, it depends on underscore, and (technically it's optional)
jQuery. These were must-haves when Backbone arrived on the scene, but are becoming less and less
necessary. Use them by all means, but this library won't force you to.

Backbone also works around the trickiness of implementing inheritance in ES5. Since ES6 gives us
syntax sugar in the form of `class`es, this library uses those.

One major departure from Backbone is that events are not mixed onto objects. Instead, a Node.js-like
`EventEmitter` class is provided, and other vertebrate classes inherit from it.

## EventEmitter

The EventEmitter class is built to have an API similar too, but smaller than, that of Node.js.

```javascript
import {EventEmitter} from 'vertebrate';

let emitter = new EventEmitter();
```

### methods

#### `emit`

```javascript
emitter.emit(name, ...args);
```

Triggers all handlers registered for an event name to be called with `args`.

#### `on` and `addListener`

```javascript
emitter.on(name, handler);

// or

emitter.addListener(name, handler);
```

Registers a handler function against the given name. The name can be anything (including objects
etc.) except `undefined`. When an event is registered, it triggers the `'newListener'` event, with
the name and the handler function registered.

One important difference when compared with the Node `EventEmitter` is that a name-handler pair can
only be registered once, since internally this implementation uses an ES6 `Set`. If you try to add
the same event handler twice for the same event name, it'll ignore the second.

#### `addGenericListener`

```javascript
emitter.addGenericListener(handler);
```

Registers a generic handler, which will receive the names and arguments of all events emitted
(except special events). Triggers the emission of an `addGenericListener` event with the handler.

#### `removeListener`

```javascript
emitter.removeListener(name, handler);
```

Removes a previously registered handler, and emits the `removeListener` event with the name and the
handler.

#### `removeGenericListener`

```javascript
emitter.removeGenericListener(handler);
```

Removes a generic handler. Triggers the emission of a `removeGenericListener` event with the
handler.

#### `removeAllListeners`

```javascript
emitter.removeAllListeners(name);
```

Removes all event handlers for the given name registered with the emitter. Emits the
`removeListener` event for each removed handler (see above).

```javascript
emitter.removeAllListeners();
```

Remove all event handlers for all names registered with the emitter. Emits the `removeListener`
event for each removed handler (see above). Also removes all generic listeners.

#### notes

The most obvious thing that this implementation of `EventEmitter` is missing is a `once` method.
This is deliberate. Writing an event that fires once is easy:

```javascript
var emitter = new EventEmitter();

function logOnce(message) {
  console.log(message);
  emitter.removeListener('message', logOnce);
}

emitter.on('message', logOnce);

emitter.emit('message', 'hello, world'); // logs
emitter.emit('message', 'oh noes! :(');  // does't log
```

and doing so keeps the implementation of `removeListener` and the storage of events simple.

## Collection

Collections are inspired by, but depart from those of Backbone. They serve the same use case but
the implementation is different, so don't expect the same behaviour. Do expect behaviour to be sane
though!

```javascript
import {Collection, Model} from 'vertebrate';

class MyModel extends Model {...}

class MyCollection extends Collection {
  constructor() {
    super();

    this.Model = MyModel; // Set the Model in the constructor.
  }
}
```

### model events

Events from models are re-emitted on the collection, so:

```javascript
model.emit('something', 1, 2, 3);
```

will be re-emitted on the collection with the model to look like:

```javascript
collection.emit('something', model, 1, 2, 3);
```


### iteration

Instances of `Collection` may be iterated over with a `for-of` loop:

```javascript
// collection is an instance of Collection.
for (let model of collection) {
  // Do something with the model.
}
```

This is the way I encourage you to use collections. Forget all those unnecessary functional methods
of `Array`. ;)

The `length` property reflects the length og the underlying collection of models.

### methods

#### fetch

Uses the `url` method to get the URL of the collection, and perform a `GET` request using fetch. The
response status is checked, and then the response is passed to the `parse` method. The return value
of parse (an array of models attributes). The parsed data is then used to add to, remove from, and
update models in the collection.

#### models

Retrieves a copy of the internally managed array of models. This is a copy, so operations performed
on the collection will not be reflected in it. Changes to attributes of the models in the copy will
be.

Try to use the collection as an iterator before you use the `models` method.

#### add

Add models, or objects to vivify as models, to a collection. If your collection has a subclassed
model set to its `Model` property, then you may only add this kind of model (or an instance of a
subclass of it) or a plain object (to vivify). Models which do not inherit from `collection.Model`
will result in an error being thrown. After models are added, a single "update" event is fired.

Add has four strategies for dealing with a model to be added with the same ID as a model already in
the collection. By default, the addition is skipped, resulting in no change for duplicate.
Strategies are:

##### ignore (default)

Leave the existing entry in the collection, and ignore the model that would have been added. No
events will be fired for this case.

##### replace

Replace the old model with the same ID with the new one being added. This fires the "replace" event
with the old model and the new model as arguments (in that order).

```javascript
collection.add(model, {handleDuplicates: 'replace'});
```

##### mergeNewIntoOld

Leave an existing entry in the collection, and set the properties of the model to be added on it. No
collection specific events will be fired, but the collection will proxy change events from the
updated model.

```javascript
collection.add(model, {handleDuplicates: 'mergeNewIntoOld'});
```

##### mergeOldIntoNew

Replace the existing entry in the collection, but set its attributes on the added model. This fires
the `replace` event with the old and new models.

```javascript
collection.add(model, {handleDuplicate: 'mergeOldIntoNew'});
```

#### remove

Remove a model from a collection. Models to remove are acceptable as any of the same types that the
get method takes. Fires a remove event per model removed, and after a single "update" event.

#### comparator

The comparator is used to sort models, and is internally used for `Array.prototype.sort` calls. By
default the comparator sorts by ID ascending. Elements added or changed will trigger a sort.
