# vertebrate

Inspired by Backbone, crafted in ES6.

This library currently houses only a minimalist event emitter implementation.

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

#### `removeListener`

```javascript
emitter.removeListener(name, handler);
```

Removes a previously registered handler, and emits the `removeListener` event with the name and the
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
event for each removed handler (see above).

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

emitter.emit('hello, world'); // logs
emitter.emit('oh noes! :(');  // does't log
```

and doing so keeps the implementation of `removeListener` and the storage of events simple.
