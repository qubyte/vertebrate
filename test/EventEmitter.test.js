import {EventEmitter} from '../vertebrate.js';
import assert from 'assert';
import sinon from 'sinon';

describe('EventEmitter', () => {
  let sandbox = sinon.sandbox.create();

  afterEach(() => sandbox.restore());

  describe('class', () => {
    it('is a function', () => {
      assert.equal(typeof EventEmitter, 'function');
    });

    it('throws when called without new', () => {
      assert.throws(EventEmitter);
    });

    it('returns an instance when called with new', () => {
      let eventEmitter;

      assert.doesNotThrow(() => eventEmitter = new EventEmitter());
      assert.ok(eventEmitter instanceof EventEmitter);
    });
  });

  describe('instance', () => {
    let eventEmitter;
    let testHandler;

    beforeEach(() => {
        eventEmitter = new EventEmitter();
        testHandler = sandbox.stub();
    });

    it('is instance of EventEmitter', () => {
        assert.ok(eventEmitter instanceof EventEmitter);
    });

    it('has a string tag of "VertebrateEventEmitter"', () => {
      assert.equal(Object.prototype.toString.call(new EventEmitter()), '[object VertebrateEventEmitter]');
    });

    describe('addListener', () => {
      it('throws when the event name is undefined', () => {
        assert.throws(
          () => eventEmitter.addListener(undefined, () => {}),
          err => err instanceof Error,
          'The name cannot be undefined.'
        );
      });

      it('throws when the event handler is not a function', () => {
        assert.throws(
          () => eventEmitter.addListener('test'),
          err => err instanceof Error,
          'The handler must be a function.'
        );
      });

      it('does not throw when the event name is not undefined and the handler is a function', () => {
        assert.doesNotThrow(() => {
          eventEmitter.addListener('test', sandbox.stub());
        });
      });

      it('does not throw when a second handler for a given event name is registered', function(){
        assert.doesNotThrow(() => {
          eventEmitter.addListener('test', sandbox.stub());
          eventEmitter.addListener('test', sandbox.stub());
        });
      });

      it('returns the instance for chaining', () => {
        assert.equal(eventEmitter.addListener('test', sandbox.stub()), eventEmitter);
      });

      it('emits "newListener" with the name and the handler', () => {
        sandbox.stub(EventEmitter.prototype, 'emit');

        assert.equal(eventEmitter.emit.callCount, 0);

        eventEmitter.addListener('test', testHandler);

        assert.equal(eventEmitter.emit.callCount, 1);
        assert.ok(eventEmitter.emit.calledWithExactly(Symbol.for('vertebrate:newListener'), 'test', testHandler));
      });
    });

    describe('on', () => {
      beforeEach(() => {
        sandbox.stub(EventEmitter.prototype, 'addListener').returns('the-return-value');
      });

      it('passes arguments on to addListener', () => {
        assert.equal(eventEmitter.addListener.callCount, 0);

        eventEmitter.on('x', 'y', 'z');

        assert.equal(eventEmitter.addListener.callCount, 1);
        assert.ok(eventEmitter.addListener.calledWithExactly('x', 'y', 'z'));
      });

      it('returns the return value of addListener', function(){
        assert.equal(eventEmitter.on(), 'the-return-value');
      });
    });

    describe('addGenericListener', () => {
      it('throws when the event handler is not a function', () => {
        assert.throws(
          () => eventEmitter.addGenericListener(),
          err => err instanceof Error,
          'The handler must be a function.'
        );
      });

      it('does not throw when the handler is a function', () => {
        assert.doesNotThrow(() => {
          eventEmitter.addGenericListener(sandbox.stub());
        });
      });

      it('returns the instance for chaining', () => {
        assert.equal(eventEmitter.addListener('test', sandbox.stub()), eventEmitter);
      });

      it('emits "newGenericListener" symbol with the handler', () => {
        sandbox.stub(EventEmitter.prototype, 'emit');

        assert.equal(eventEmitter.emit.callCount, 0);

        eventEmitter.addGenericListener(testHandler);

        assert.equal(eventEmitter.emit.callCount, 1);
        assert.ok(eventEmitter.emit.calledWithExactly(Symbol.for('vertebrate:newGenericListener'), testHandler));
      });

      it('emits "newGenericListener" symbol once per handler', () => {
        sandbox.stub(EventEmitter.prototype, 'emit');

        assert.equal(eventEmitter.emit.callCount, 0);

        eventEmitter.addGenericListener(testHandler);
        eventEmitter.addGenericListener(testHandler);

        assert.equal(eventEmitter.emit.callCount, 1);
      });
    });

    describe('emit', () => {
      let genericListener1;
      let genericListener2;

      beforeEach(() => {
        genericListener1 = sandbox.stub();
        genericListener2 = sandbox.stub();

        eventEmitter.addGenericListener(genericListener1);
        eventEmitter.addGenericListener(genericListener2);
        eventEmitter.on('test', testHandler);
      });

      it('throws if the name is undefined', () => {
        assert.throws(
          () => eventEmitter.emit(),
          err => err instanceof Error,
          'The name cannot be undefined.'
        );
      });

      it('does not call the handler when an unrelated event is emitted', () => {
        eventEmitter.emit('something');

        assert.equal(testHandler.callCount, 0);
      });

      it('calls and passes arguments to the handler when the relevant event is emitted', () => {
        eventEmitter.emit('test', 'a', 'b', 'c');

        assert.equal(testHandler.callCount, 1);
        assert.ok(testHandler.calledWithExactly('a', 'b', 'c'));
      });

      it('calls and passes arguments to more than one handler when the relevant event is emitted', () => {
        let anotherHandler = sandbox.stub();

        eventEmitter.on('test', anotherHandler);
        eventEmitter.emit('test', 'a', 'b', 'c');

        assert.equal(testHandler.callCount, 1);
        assert.ok(testHandler.calledWithExactly('a', 'b', 'c'));
        assert.equal(anotherHandler.callCount, 1);
        assert.ok(anotherHandler.calledWithExactly('a', 'b', 'c'));
      });

      it('returns false when no handlers were called', () => {
        assert.strictEqual(eventEmitter.emit('something'), false);
      });

      it('returns true when handlers were called', () => {
        assert.strictEqual(eventEmitter.emit('test'), true);
      });

      it('dispatches the event to genericHandlers with the name and the arguments', () => {
        eventEmitter.emit('test', 'a', 'b', 'c');

        assert.equal(genericListener1.callCount, 1);
        assert.ok(genericListener1.calledWithExactly('test', 'a', 'b', 'c'));
        assert.equal(genericListener2.callCount, 1);
        assert.ok(genericListener2.calledWithExactly('test', 'a', 'b', 'c'));
      });

      it('does not dispatch "newListener" events to generic handlers', () => {
        eventEmitter.emit(Symbol.for('vertebrate:newListener'));

        assert.equal(genericListener1.callCount, 0);
      });

      it('does not dispatch "newGenericListener" events to generic handlers', () => {
        eventEmitter.emit(Symbol.for('vertebrate:newGenericListener'));

        assert.equal(genericListener1.callCount, 0);
      });

      it('does not dispatch "removeListener" events to generic handlers', () => {
        eventEmitter.emit(Symbol.for('vertebrate:removeListener'));

        assert.equal(genericListener1.callCount, 0);
      });

      it('does not dispatch "removeGenericListener" events to generic handlers', () => {
        eventEmitter.emit(Symbol.for('vertebrate:removeGenericListener'));

        assert.equal(genericListener1.callCount, 0);
      });
    });

    describe('removeListener', () => {
      beforeEach(() => {
        eventEmitter.on('test', testHandler);
      });

      it('removes the handler', () => {
        eventEmitter.removeListener('test', testHandler);

        eventEmitter.emit('test', 'a', 'b', 'c');

        assert.equal(testHandler.callCount, 0);
      });

      it('returns the instance for chaining', () => {
        assert.equal(eventEmitter.removeListener('test', testHandler), eventEmitter);
      });

      it('emits "removeListener" symbol with the handler', () => {
        sandbox.stub(EventEmitter.prototype, 'emit');

        assert.equal(eventEmitter.emit.callCount, 0);

        eventEmitter.removeListener('test', testHandler);

        assert.equal(eventEmitter.emit.callCount, 1);
        assert.ok(eventEmitter.emit.calledWithExactly(Symbol.for('vertebrate:removeListener'), 'test', testHandler));
      });
    });

    describe('removeGenericListener', () => {
      beforeEach(() => {
        eventEmitter.addGenericListener(testHandler);
      });

      it('removes the handler', () => {
        eventEmitter.removeGenericListener(testHandler);

        eventEmitter.emit('test', 'a', 'b', 'c');

        assert.equal(testHandler.callCount, 0);
      });

      it('returns the instance for chaining', () => {
        assert.equal(eventEmitter.removeGenericListener(testHandler), eventEmitter);
      });

      it('emits "removeGenericListener" symbol with the handler', () => {
        sandbox.stub(EventEmitter.prototype, 'emit');

        assert.equal(eventEmitter.emit.callCount, 0);

        eventEmitter.removeGenericListener(testHandler);

        assert.equal(eventEmitter.emit.callCount, 1);
        assert.ok(eventEmitter.emit.calledWithExactly(Symbol.for('vertebrate:removeGenericListener'), testHandler));
      });

      it('does not emit "removeGenericListener" symbol when the handler is not registered', () => {
        sandbox.stub(EventEmitter.prototype, 'emit');

        assert.equal(eventEmitter.emit.callCount, 0);

        eventEmitter.removeGenericListener(() => {});

        assert.equal(eventEmitter.emit.callCount, 0);
      });
    });

    describe('removeAllListeners', () => {
      let testHandler1;
      let testHandler2;
      let testHandler3;
      let testGenericHandler1;
      let testGenericHandler2;

      beforeEach(() => {
        testHandler1 = sandbox.stub();
        testHandler2 = sandbox.stub();
        testHandler3 = sandbox.stub();
        testGenericHandler1 = sandbox.stub();
        testGenericHandler2 = sandbox.stub();

        eventEmitter.on('test', testHandler1);
        eventEmitter.on('test', testHandler2);
        eventEmitter.on('something-else', testHandler3);
        eventEmitter.addGenericListener(testGenericHandler1);
        eventEmitter.addGenericListener(testGenericHandler2);
      });

      describe('when called with an event name', () => {
        it('removes all listeners for that event name', () => {
          eventEmitter.removeAllListeners('test');

          eventEmitter.emit('test');
          eventEmitter.emit('something-else');

          assert.equal(testHandler1.callCount, 0);
          assert.equal(testHandler2.callCount, 0);
          assert.equal(testHandler3.callCount, 1);
        });

        it('returns the instance for chaining', () => {
          assert.equal(eventEmitter.removeAllListeners('test'), eventEmitter);
        });
      });

      describe('when called with no event name', () => {
        it('removes all listners for all event names', () => {
          eventEmitter.removeAllListeners();

          eventEmitter.emit('test');
          eventEmitter.emit('something-else');

          assert.equal(testHandler1.callCount, 0);
          assert.equal(testHandler2.callCount, 0);
          assert.equal(testHandler3.callCount, 0);
        });

        it('removes all generic listeners', () => {
          eventEmitter.removeAllListeners();

          eventEmitter.emit('test');
          eventEmitter.emit('something-else');

          assert.equal(testGenericHandler1.callCount, 0);
          assert.equal(testGenericHandler2.callCount, 0);
        });

        it('returns the instance for chaining', () => {
          assert.equal(eventEmitter.removeAllListeners(), eventEmitter);
        });
      });
    });
  });
});
