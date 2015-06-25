import {EventEmitter} from './vertebrate.js';
import assert from 'assert';
import sinon from 'sinon';

describe('EventEmitter', () => {
  var sandbox = sinon.sandbox.create();

  afterEach(() => {
    sandbox.restore();
  });

  describe('class', () => {
    it('is a function', () => {
        assert.equal(typeof EventEmitter, 'function');
    });

    it('throws when called without new', () => {
        assert.throws(EventEmitter);
    });

    it('returns an object when called with new', () => {
        assert.doesNotThrow(() => new EventEmitter());
    });

    it('has a writable, configurable, non-enumerable "on" instance method', () => {
        var descriptor = Object.getOwnPropertyDescriptor(EventEmitter.prototype, 'on');

        assert.equal(typeof descriptor.value, 'function');
        assert.ok(descriptor.writable);
        assert.ok(!descriptor.enumerable);
        assert.ok(descriptor.configurable);
    });
  });

  describe('instances', () => {
    var eventEmitter;
    var testHandler;

    beforeEach(() => {
        eventEmitter = new EventEmitter();
        testHandler = sandbox.stub();
    });

    it('are instances of EventEmitter', () => {
        assert.ok(eventEmitter instanceof EventEmitter);
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
        assert.ok(eventEmitter.emit.calledWithExactly('newListener', 'test', testHandler));
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

    describe('emit', () => {
      beforeEach(() => {
        eventEmitter.on('test', testHandler);
      });

      it('throws if the name is undefined', () => {
        assert.throws(
          () => eventEmitter.on('test'),
          err => err instanceof Error,
          'The handler must be a function.'
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
    });

    describe('removeAllListeners', () => {
      var testHandler1;
      var testHandler2;
      var testHandler3;

      beforeEach(() => {
        testHandler1 = sandbox.stub();
        testHandler2 = sandbox.stub();
        testHandler3 = sandbox.stub();

        eventEmitter.on('test', testHandler1);
        eventEmitter.on('test', testHandler2);
        eventEmitter.on('something-else', testHandler3);
      });

      describe('when called with an event name', () => {
        it('removes all events for that event name', () => {
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
        it('removes all events for all event names', () => {
          eventEmitter.removeAllListeners();

          eventEmitter.emit('test');
          eventEmitter.emit('something-else');

          assert.equal(testHandler1.callCount, 0);
          assert.equal(testHandler2.callCount, 0);
          assert.equal(testHandler3.callCount, 0);
        });

        it('returns the instance for chaining', () => {
          assert.equal(eventEmitter.removeAllListeners(), eventEmitter);
        });
      });
    });
  });
});
