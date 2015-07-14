import {EventEmitter, Model, Collection} from '../vertebrate.js';
import Deferred from './Deferred';
import assert from 'assert';
import sinon from 'sinon';

describe('Model', () => {
  let sandbox = sinon.sandbox.create();
  let fakeFetch;
  let fetchDeferred;

  beforeEach(() => {
    fetchDeferred = new Deferred();

    fakeFetch = sandbox.stub().returns(fetchDeferred.promise);

    global.fetch = fakeFetch;
  });

  afterEach(() => sandbox.restore());

  describe('class', () => {
    it('is a function', () => {
        assert.equal(typeof Model, 'function');
    });

    it('throws when called without new', () => {
        assert.throws(Model);
    });

    it('returns an object when called with new', () => {
        assert.doesNotThrow(() => new Model());
    });

    describe('instance', () => {
      it('is an instance of Model', () => {
        assert.ok(new Model() instanceof Model);
      });

      it('is an instance of EventEmitter', () => {
        assert.ok(new Model() instanceof EventEmitter);
      });

      it('has a string tag of "VertebrateModel"', () => {
        assert.equal(Object.prototype.toString.call(new Model()), '[object VertebrateModel]');
      });

      describe('constructor', () => {
        it('sets attributes passed to it', () => {
          let model = new Model({a: 1, b: 2, c: 3});

          assert.equal(model.getAttribute('a'), 1);
          assert.equal(model.getAttribute('b'), 2);
          assert.equal(model.getAttribute('c'), 3);
        });

        it('sets a string id passed to it', () => {
          let model = new Model({id: 'an-id'});

          assert.equal(model.getAttribute('id'), 'an-id');
        });

        it('sets a positive integer id passed to it', () => {
          let model = new Model({id: 10});

          assert.equal(model.getAttribute('id'), 10);
        });

        it('throws when given a negative number id', () => {
          assert.throws(
            () => new Model({id: -10}),
            err => err instanceof Error,
            'id must be a string or a positive integer'
          );
        });

        it('throws when given a non-integer number id', () => {
          assert.throws(
            () => new Model({id: 10.1}),
            err => err instanceof Error,
            'id must be a string or a positive integer'
          );
        });

        it('sets collection when options.collection is a Collection instance', () => {
          let collection = new Collection();
          let model = new Model({}, {collection});

          assert.equal(model.collection, collection);
        });

        it('does not set collection when options.collection is not a Collection instance', () => {
          let model = new Model({}, {collection: {}});

          assert.equal(model.collection, undefined);
        });
      });

      describe('getAttribute', () => {
        let model;

        beforeEach(() => {
          model = new Model({a: 1});
        });

        it('gets the value when the property is set', () => {
          assert.equal(model.getAttribute('a'), 1);
        });

        it('gets undefined when property not set', () => {
          assert.equal(model.getAttribute('b'), undefined);
        });
      });

      describe('getAttributes', () => {
        let model;

        beforeEach(() => {
          model = new Model({a: 1, b: 2, c: 3});
        });

        it('gets the value an object populated with the requested values', () => {
          assert.deepEqual(model.getAttributes('a', 'b'), {a: 1, b: 2});
        });

        it('gets undefined when property not set', () => {
          assert.deepEqual(model.getAttributes('d'), {d: undefined});
        });

        it('gets all attributes when no arguments are given', () => {
          assert.deepEqual(model.getAttributes(), {a: 1, b: 2, c: 3});
        });
      });

      describe('setAttributes', () => {
        let model;

        beforeEach(() => {
          model = new Model();
        });

        it('sets a value on the model', () => {
          assert.equal(model.getAttribute('a'), undefined);

          model.setAttributes({'a': 1});

          assert.equal(model.getAttribute('a'), 1);
        });

        it('resets a value on the model', () => {
          model.setAttributes({'a': 2});
          model.setAttributes({'a': 1});

          assert.equal(model.getAttribute('a'), 1);
        });

        it('returns the instance for chaining', () => {
          assert.equal(model.setAttributes({'a': 1}), model);
        });
      });

      describe('id', () => {
        let model;

        beforeEach(() => {
          model = new Model();
        });

        it('can be set by the constructor', () => {
          assert.equal(new Model({id: 1}).id, 1);
        });

        it('can be set with the setAttributes method', () => {
          model.setAttributes({id: 1});

          assert.equal(model.id, 1);
        });
      });

      describe('has', () => {
        let model;

        beforeEach(() => {
          model = new Model({a: 1, b: 0, c: null, d: false, e: undefined});
        });

        it('returns true when the property is not undefined', () => {
          assert.strictEqual(model.has('a'), true);
          assert.strictEqual(model.has('b'), true);
          assert.strictEqual(model.has('c'), true);
          assert.strictEqual(model.has('d'), true);
        });

        it('returns false when the property is undefined', () => {
          assert.strictEqual(model.has('e'), false);
          assert.strictEqual(model.has('f'), false);
        });
      });

      describe('hasChanged', () => {
        let model;

        beforeEach(() => {
          model = new Model({a: 1, b: 2, c: 3});
          model.setAttributes({'b': 4});
          model.setAttributes({'c': 5});
          model.setAttributes({'c': 3});
        });

        describe('with an attribute name', () => {
          it('returns true when the attribute has changed', () => {
            assert.strictEqual(model.hasChanged('b'), true);
          });

          it('returns false when the attribute has not changed', () => {
            assert.strictEqual(model.hasChanged('a'), false);
          });

          it('returns false when the attribute was change, but then returned to its original state', () => {
            assert.strictEqual(model.hasChanged('c'), false);
          });
        });

        describe('without an attribute name', () => {
          it('returns true when an attribute has changed', () => {
            assert.strictEqual(model.hasChanged(), true);
          });

          it('returns false when no attribute has changed', () => {
            assert.strictEqual(new Model({a: 1}).hasChanged(), false);
          });

          it('returns false when attributes changed, but were returned to their original state', () => {
            model.setAttributes({'b': 2});

            assert.strictEqual(model.hasChanged(), false);
          });
        });
      });

      describe('changedAttributes', () => {
        let model;

        beforeEach(() => {
          model = new Model({a: 1, b: 2, c: 3});

          model.setAttributes({'b': 4});
          model.setAttributes({'a': undefined});
          model.setAttributes({'d': 5});
        });

        it('returns added, changed and removed fields', () => {
          let changes = model.changedAttributes();

          assert.deepEqual(changes, {a: undefined, b: 4, d: 5});
        });
      });

      describe('previous', () => {
        let model;
        let attributes;

        beforeEach(() => {
          model = new Model({a: 1, b: 2});
          model.setAttributes({'b': 3});
          attributes = model.previous();
        });

        it('returns an object with original attributes', () => {
          assert.equal(Object.keys(attributes).length, 2);
          assert.equal(attributes.a, 1);
          assert.equal(attributes.b, 2);
        });

        it('returns a shallow copy each time it is called', () => {
          assert.notEqual(model.previous(), attributes);
        });
      });

      describe('urlRoot', () => {
        it('throws if not overridden', () => {
          assert.throws(
            () => new Model().urlRoot(),
            err => err instanceof Error,
            'To use a model outside of a collection, a urlRoot method must be defined.'
          );
        });
      });

      describe('isNew', () => {
        it('returns true if the ID is undefined', () => {
          assert.strictEqual(new Model().isNew(), true);
        });

        it('returns true if the ID is not undefined', () => {
          assert.strictEqual(new Model({id: 123}).isNew(), false);
          assert.strictEqual(new Model({id: 'blah'}).isNew(), false);
        });
      });

      describe('url', () => {
        it('throws if the model is new', () => {
          assert.throws(
            () => new Model().url(),
            err => err instanceof Error,
            'New Models do not have IDs.'
          );
        });

        it('uses the urlRoot and the model ID if no collection is defined', () => {
          let model = new class extends Model {
            urlRoot() {
              return '/test/url/one';
            }
          }({id: 123});

          assert.equal(model.url(), '/test/url/one/123');
        });

        it('ignores trailing "/" in the return value of urlRoot', () => {
          let model = new class extends Model {
            urlRoot() {
              return '/test/url/two/';
            }
          }({id: 123});

          assert.equal(model.url(), '/test/url/two/123');
        });

        it('uses collection.url and the model ID if a collection is defined', () => {
          let collection = new class extends Collection {
            url() {
              return '/test/url/three';
            }
          }();

          let model = new Model({id: 123}, {collection});

          assert.equal(model.url(), '/test/url/three/123');
        });

        it('ignores trailing "/" in the return value of collection.url', () => {
          let collection = new class extends Collection {
            url() {
              return '/test/url/four/';
            }
          }();

          let model = new Model({id: 123}, {collection});

          assert.equal(model.url(), '/test/url/four/123');
        });
      });

      describe('checkResponse', () => {
        let checkResponse = Model.prototype.checkResponse;

        it('throws when res.ok is falsy', () => {
          let fakeRes = {
            ok: false,
            status: 987
          };

          assert.throws(
            () => checkResponse(fakeRes),
            err => err instanceof Error,
            'Unexpected response code from server: 987'
          );
        });

        it('returns the response when res.ok is truthy', () => {
          let fakeRes = {
            ok: true
          };

          assert.equal(checkResponse(fakeRes), fakeRes);
        });
      });

      describe('fetch', () => {
        let model;

        beforeEach(() => {
          model = new class extends Model {
            urlRoot() {
              return '/a/b/c';
            }
          }({id: 10, a: 2});
        });

        it('makes a get request with the model URL and same-origin credentials', () => {
          model.fetch();

          assert.equal(fakeFetch.callCount, 1);
          assert.equal(fakeFetch.args[0][0], '/a/b/c/10');
          assert.deepEqual(fakeFetch.args[0][1], {method: 'get', credentials: 'same-origin'});
        });

        it('rejects if res.ok is falsy', done => {
          fetchDeferred.resolve({ok: false, status: 123});

          model.fetch()
            .catch(err => {
              assert.ok(err instanceof Error);
              assert.equal(err.message, 'Unexpected response code from server: 123');
              done();
            });
        });

        it('rejects if the ID in the response data does not match the model ID', done => {
          fetchDeferred.resolve({
            ok: true,
            json: () => ({id: 9})
          });

          model.fetch()
            .catch(err => {
              assert.ok(err instanceof Error);
              assert.equal(err.message, 'Server ID mismatch.');
              done();
            });
        });

        it('merges the returned state with that of the object', () => {
          fetchDeferred.resolve({
            ok: true,
            json: () => ({id: 10, b: 3})
          });

          return model.fetch()
            .then(() => {
              assert.equal(model.getAttribute('id'), 10);
              assert.equal(model.getAttribute('a'), 2);
              assert.equal(model.getAttribute('b'), 3);
            });
        });

        it('considers the state of the object before the fetch to be changes', () => {
          fetchDeferred.resolve({
            ok: true,
            json: () => ({id: 10, b: 3})
          });

          return model.fetch()
            .then(() => assert.deepEqual(model.changedAttributes(), {a: 2}));
        });

        it('resolves to undefined', () => {
          fetchDeferred.resolve({
            ok: true,
            json: () => ({id: 10, b: 3})
          });

          return model.fetch()
            .then(result => assert.strictEqual(result, undefined));
        });

        it('emits "sync" when the silent option is truthy', () => {
          fetchDeferred.resolve({
            ok: true,
            json: () => ({id: 10})
          });

          let syncStub = sandbox.stub();

          model.on('sync', syncStub);

          return model.fetch()
            .then(() => {
              model.removeListener('sync', syncStub);
              assert.equal(syncStub.callCount, 1);
              assert.ok(syncStub.calledWithExactly());
            });
        });

        it('does not emit "sync" when the silent option is truthy', () => {
          fetchDeferred.resolve({
            ok: true,
            json: () => ({id: 10})
          });

          let syncStub = sandbox.stub();

          model.on('sync', syncStub);

          model.fetch({silent: true})
            .then(() => {
              model.removeListener('sync', syncStub);
              assert.equal(syncStub.callCount, 0);
            });
        });
      });

      describe('save', () => {
        let TestModel;
        let TestCollection;

        beforeEach(() => {
          TestModel = class extends Model {
            urlRoot() {
              return '/a/b/c';
            }
          };

          TestCollection = class extends Collection {
            url() {
              return '/d/e/f';
            }
          };
        });

        describe('new model with no collection', () => {
          let newModelNoCollection;

          beforeEach(() => {
            newModelNoCollection = new TestModel({a: 1, b: 2});
            newModelNoCollection.setAttributes({c: 3});
          });

          it('resolves when there are no changes', () => {
            return new TestModel({a: 1, b: 2}).save();
          });

          it('calls fetch when there are no changes and option "force" is true', () => {
            () => {
              return new TestModel({a: 1, b: 2}).save({force: true});
            }();

            assert.equal(fakeFetch.callCount, 1);
          });

          it('makes a post request with the urlRoot URL', () => {
            newModelNoCollection.save();

            assert.equal(fakeFetch.callCount, 1);
            assert.equal(fakeFetch.args[0][0], '/a/b/c');
            assert.deepEqual(fakeFetch.args[0][1], {
              method: 'post',
              credentials: 'same-origin',
              body: {
                a: 1,
                b: 2,
                c: 3
              },
              headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json'
              }
            });
          });

          it('rejects if the response is not ok', done => {
            let saving = newModelNoCollection.save();

            fetchDeferred.resolve({ok: false, status: 123});

            saving
              .catch(err => {
                assert.ok(err instanceof Error);
                assert.equal(err.message, 'Unexpected response code from server: 123');
                done();
              });
          });

          it('sets the previous attributes to the model attributes when the save began', () => {
            let saving = newModelNoCollection.save();

            newModelNoCollection.setAttributes({'a': 3});

            fetchDeferred.resolve({ok: true, json: sandbox.stub()});

            return saving
              .then(() => {
                assert.deepEqual(newModelNoCollection.previous(), {a: 1, b: 2, c: 3});
              });
          });

          it('emits "sync"', () => {
            let saving = newModelNoCollection.save();
            let syncHandlerStub = sandbox.stub();

            newModelNoCollection.on('sync', syncHandlerStub);

            assert.equal(syncHandlerStub.callCount, 0);

            fetchDeferred.resolve({ok: true, json: sandbox.stub()});

            return saving
              .then(() => {
                assert.equal(syncHandlerStub.callCount, 1);
                assert.ok(syncHandlerStub.calledWithExactly());
              });
          });
        });

        describe('new model with collection', () => {
          let newModelWithCollection;

          beforeEach(() => {
            newModelWithCollection = new Model({a: 1, b: 2}, {collection: new TestCollection()});
            newModelWithCollection.setAttributes({c: 3});
          });

          it('resolves when there are no changes', () => {
            return new Model({a: 1, b: 2}, {collection: new TestCollection()}).save();
          });

          it('calls fetch when there are no changes and option "force" is true', () => {
            () => {
              return new TestModel({a: 1, b: 2}, {collection: new TestCollection()}).save({force: true});
            }();

            assert.equal(fakeFetch.callCount, 1);
          });

          it('makes a post request with the collection URL', () => {
            newModelWithCollection.save();

            assert.equal(fakeFetch.callCount, 1);
            assert.equal(fakeFetch.args[0][0], '/d/e/f');
            assert.deepEqual(fakeFetch.args[0][1], {
              method: 'post',
              credentials: 'same-origin',
              body: {
                a: 1,
                b: 2,
                c: 3
              },
              headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json'
              }
            });
          });

          it('rejects if the response is not ok', done => {
            let saving = newModelWithCollection.save();

            fetchDeferred.resolve({ok: false, status: 123});

            saving
              .catch(err => {
                assert.ok(err instanceof Error);
                assert.equal(err.message, 'Unexpected response code from server: 123');
                done();
              });
          });

          it('Sets the previous attributes to the model attributes when the save began', () => {
            let saving = newModelWithCollection.save();

            newModelWithCollection.setAttributes({'a': 3});

            fetchDeferred.resolve({ok: true, json: sandbox.stub()});

            return saving
              .then(() => {
                assert.deepEqual(newModelWithCollection.previous(), {a: 1, b: 2, c: 3});
              });
          });

          it('emits "sync"', () => {
            let saving = newModelWithCollection.save();
            let syncHandlerStub = sandbox.stub();

            newModelWithCollection.on('sync', syncHandlerStub);

            assert.equal(syncHandlerStub.callCount, 0);

            fetchDeferred.resolve({ok: true, json: sandbox.stub()});

            return saving
              .then(() => {
                assert.equal(syncHandlerStub.callCount, 1);
                assert.ok(syncHandlerStub.calledWithExactly());
              });
          });
        });

        describe('old model with no collection', () => {
          let oldModelNoCollection;

          beforeEach(() => {
            oldModelNoCollection = new TestModel({id: 10, a: 1, b: 2});
            oldModelNoCollection.setAttributes({c: 3});
          });

          it('resolves when there are no changes', () => {
            return new TestModel({id: 10, a: 1, b: 2}).save();
          });

          it('calls fetch when there are no changes and option "force" is true', () => {
            () => {
              return new TestModel({id: 10, a: 1, b: 2}).save({force: true});
            }();

            assert.equal(fakeFetch.callCount, 1);
          });

          it('makes a put request with the urlRoot URL', () => {
            oldModelNoCollection.save();

            assert.equal(fakeFetch.callCount, 1);
            assert.equal(fakeFetch.args[0][0], '/a/b/c/10');
            assert.deepEqual(fakeFetch.args[0][1], {
              method: 'put',
              credentials: 'same-origin',
              body: {
                id: 10,
                a: 1,
                b: 2,
                c: 3
              },
              headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json'
              }
            });
          });

          it('rejects if the response is not ok', done => {
            let saving = oldModelNoCollection.save();

            fetchDeferred.resolve({ok: false, status: 123});

            saving
              .catch(err => {
                assert.ok(err instanceof Error);
                assert.equal(err.message, 'Unexpected response code from server: 123');
                done();
              });
          });

          it('Sets the previous attributes to the model attributes when the save began', () => {
            let saving = oldModelNoCollection.save();

            oldModelNoCollection.setAttributes({'a': 3});

            fetchDeferred.resolve({ok: true, json: sandbox.stub()});

            return saving
              .then(() => {
                assert.deepEqual(oldModelNoCollection.previous(), {id: 10, a: 1, b: 2, c: 3});
              });
          });

          it('emits "sync"', () => {
            let saving = oldModelNoCollection.save();
            let syncHandlerStub = sandbox.stub();

            oldModelNoCollection.on('sync', syncHandlerStub);

            assert.equal(syncHandlerStub.callCount, 0);

            fetchDeferred.resolve({ok: true, json: sandbox.stub()});

            return saving
              .then(() => {
                assert.equal(syncHandlerStub.callCount, 1);
                assert.ok(syncHandlerStub.calledWithExactly());
              });
          });
        });

        describe('old model with collection', () => {
          let oldModelWithCollection;

          beforeEach(() => {
            oldModelWithCollection = new Model({id: 10, a: 1, b: 2}, {collection: new TestCollection()});
            oldModelWithCollection.setAttributes({c: 3});
          });

          it('resolves when there are no changes', () => {
            return new Model({id: 10, a: 1, b: 2}, {collection: new TestCollection()}).save();
          });

          it('calls fetch when there are no changes and option "force" is true', () => {
            () => {
              return new TestModel({id: 10, a: 1, b: 2}, {collection: new TestCollection()}).save({force: true});
            }();

            assert.equal(fakeFetch.callCount, 1);
          });

          it('makes a put request with the collection URL', () => {
            oldModelWithCollection.save();

            assert.equal(fakeFetch.callCount, 1);
            assert.equal(fakeFetch.args[0][0], '/d/e/f/10');
            assert.deepEqual(fakeFetch.args[0][1], {
              method: 'put',
              credentials: 'same-origin',
              body: {
                id: 10,
                a: 1,
                b: 2,
                c: 3
              },
              headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json'
              }
            });
          });

          it('rejects if the response is not ok', done => {
            let saving = oldModelWithCollection.save();

            fetchDeferred.resolve({ok: false, status: 123});

            saving
              .catch(err => {
                assert.ok(err instanceof Error);
                assert.equal(err.message, 'Unexpected response code from server: 123');
                done();
              });
          });

          it('Sets the previous attributes to the model attributes when the save began', () => {
            let saving = oldModelWithCollection.save();

            oldModelWithCollection.setAttributes({'a': 3});

            fetchDeferred.resolve({ok: true, json: sandbox.stub()});

            return saving
              .then(() => {
                assert.deepEqual(oldModelWithCollection.previous(), {id: 10, a: 1, b: 2, c: 3});
              });
          });

          it('emits "sync"', () => {
            let saving = oldModelWithCollection.save();
            let syncHandlerStub = sandbox.stub();

            oldModelWithCollection.on('sync', syncHandlerStub);

            assert.equal(syncHandlerStub.callCount, 0);

            fetchDeferred.resolve({ok: true, json: sandbox.stub()});

            return saving
              .then(() => {
                assert.equal(syncHandlerStub.callCount, 1);
                assert.ok(syncHandlerStub.calledWithExactly());
              });
          });
        });
      });

      describe('destroy', () => {
        let TestModel;
        let model;

        beforeEach(() => {
          TestModel = class extends Model {
            urlRoot() {
              return '/a/b/c';
            }
          };
        });

        describe('old models', () => {
          let destroyListener;

          beforeEach(() => {
            destroyListener = sandbox.stub();

            model = new TestModel({id: 10, a: 1});
            model.setAttributes({'b': 2});

            model.on('destroy', destroyListener);
          });

          afterEach(() => {
            model.removeListener('destroy', destroyListener);
          });

          describe('with a collection', () => {
            let collection;

            beforeEach(() => {
              collection = {
                remove: sandbox.stub(),
                url() {
                  return '/x/y/z';
                }
              };

              model.collection = collection;
            });

            describe('silent option is falsy', () => {
              describe('wait option is truthy', () => {
                let destroying;

                beforeEach(() => {
                  destroying = model.destroy({wait: true});
                });

                it('does not immediately remove itself from the collection', () => {
                  assert.equal(collection.remove.callCount, 0);
                  assert.equal(model.collection, collection);
                });

                it('calls fetch with the model URL and delete method', () => {
                  assert.equal(fakeFetch.callCount, 1);
                  assert.equal(fakeFetch.args[0][0], '/x/y/z/10');
                  assert.deepEqual(fakeFetch.args[0][1], {
                    method: 'delete',
                    credentials: 'same-origin'
                  });
                });

                it('rejects if the fetch response is not ok', done => {
                  fetchDeferred.resolve({ok: false, status: 123});

                  destroying
                    .catch(err => {
                      assert.ok(err instanceof Error);
                      assert.equal(err.message, 'Unexpected response code from server: 123');
                      done();
                    });
                });

                it('empties the previous attributes of the model (all attributes considered new)', () => {
                  fetchDeferred.resolve({ok: true});

                  return destroying
                    .then(() => {
                      assert.deepEqual(model.previous(), {});
                    });
                });

                it('removes itself from the collection after the server responds', () => {
                  fetchDeferred.resolve({ok: true});

                  return destroying
                    .then(() => {
                      assert.equal(collection.remove.callCount, 1);
                      assert.ok(collection.remove.calledWithExactly(model));
                    });
                });

                it('emits "destroy" after the server responds', () => {
                  fetchDeferred.resolve({ok: true});

                  return destroying
                    .then(() => {
                      assert.equal(destroyListener.callCount, 1);
                      assert.ok(destroyListener.calledWithExactly());
                    });
                });
              });

              describe('wait option is falsy', () => {
                let destroying;

                beforeEach(() => {
                  destroying = model.destroy({wait: false});
                });

                it('immediately removes itself from the collection', () => {
                  assert.equal(collection.remove.callCount, 1);
                  assert.ok(collection.remove.calledWithExactly(model));
                  assert.equal(model.collection, undefined);
                });

                it('calls fetch with the model URL and delete method', () => {
                  assert.equal(fakeFetch.callCount, 1);
                  assert.equal(fakeFetch.args[0][0], '/x/y/z/10');
                  assert.deepEqual(fakeFetch.args[0][1], {
                    method: 'delete',
                    credentials: 'same-origin'
                  });
                });

                it('rejects if the fetch response is not ok', done => {
                  fetchDeferred.resolve({ok: false, status: 123});

                  destroying
                    .catch(err => {
                      assert.ok(err instanceof Error);
                      assert.equal(err.message, 'Unexpected response code from server: 123');
                      done();
                    });
                });

                it('empties the previous attributes of the model (all attributes considered new)', () => {
                  fetchDeferred.resolve({ok: true});

                  return destroying
                    .then(() => {
                      assert.deepEqual(model.previous(), {});
                    });
                });

                it('does not remove itself from the collection again after server responds', () => {
                  fetchDeferred.resolve({ok: true});

                  return destroying
                    .then(() => {
                      assert.equal(collection.remove.callCount, 1);
                    });
                });

                it('emits "destroy" after the server responds', () => {
                  fetchDeferred.resolve({ok: true});

                  return destroying
                    .then(() => {
                      assert.equal(destroyListener.callCount, 1);
                      assert.ok(destroyListener.calledWithExactly());
                    });
                });
              });

            });
          });

          describe('without a collection', () => {
            describe('wait option is truthy', () => {
              let destroying;

              beforeEach(() => {
                destroying = model.destroy({wait: true});
              });

              it('calls fetch with the model URL and delete method', () => {
                assert.equal(fakeFetch.callCount, 1);
                assert.equal(fakeFetch.args[0][0], '/a/b/c/10');
                assert.deepEqual(fakeFetch.args[0][1], {
                  method: 'delete',
                  credentials: 'same-origin'
                });
              });

              it('rejects if the fetch response is not ok', done => {
                fetchDeferred.resolve({ok: false, status: 123});

                destroying
                  .catch(err => {
                    assert.ok(err instanceof Error);
                    assert.equal(err.message, 'Unexpected response code from server: 123');
                    done();
                  });
              });

              it('empties the previous attributes of the model (all attributes considered new)', () => {
                fetchDeferred.resolve({ok: true});

                return destroying
                  .then(() => {
                    assert.deepEqual(model.previous(), {});
                  });
              });

              it('emits "destroy" after the server responds', () => {
                fetchDeferred.resolve({ok: true});

                let destroyListener = sandbox.stub();

                model.on('destroy', destroyListener);

                return destroying
                  .then(() => {
                    model.removeListener('destroy', destroyListener);
                    assert.equal(destroyListener.callCount, 1);
                    assert.ok(destroyListener.calledWithExactly());
                  });
              });
            });

            describe('wait option is falsy', () => {
              let destroying;

              beforeEach(() => {
                destroying = model.destroy({wait: false});
              });

              it('calls fetch with the model URL and delete method', () => {
                assert.equal(fakeFetch.callCount, 1);
                assert.equal(fakeFetch.args[0][0], '/a/b/c/10');
                assert.deepEqual(fakeFetch.args[0][1], {
                  method: 'delete',
                  credentials: 'same-origin'
                });
              });

              it('rejects if the fetch response is not ok', done => {
                fetchDeferred.resolve({ok: false, status: 123});

                destroying
                  .catch(err => {
                    assert.ok(err instanceof Error);
                    assert.equal(err.message, 'Unexpected response code from server: 123');
                    done();
                  });
              });

              it('empties the previous attributes of the model (all attributes considered new)', () => {
                fetchDeferred.resolve({ok: true});

                return destroying
                  .then(() => {
                    assert.deepEqual(model.previous(), {});
                  });
              });

              it('emits "destroy" after the server responds', () => {
                fetchDeferred.resolve({ok: true});

                let destroyListener = sandbox.stub();

                model.on('destroy', destroyListener);

                return destroying
                  .then(() => {
                    model.removeListener('destroy', destroyListener);
                    assert.equal(destroyListener.callCount, 1);
                    assert.ok(destroyListener.calledWithExactly());
                  });
              });
            });
          });
        });

        describe('new models', () => {
          let destroyListener;

          beforeEach(() => {
            destroyListener = sandbox.stub();

            model = new TestModel({a: 1});
            model.setAttributes({'b': 2});

            model.on('destroy', destroyListener);
          });

          afterEach(() => {
            model.removeListener('destroy', destroyListener);
          });

          describe('with a collection', () => {
            let collection;

            beforeEach(() => {
              collection = {
                remove: sandbox.stub(),
                url() {
                  return '/x/y/z';
                }
              };

              model.collection = collection;
            });

            describe('wait option is truthy', () => {
              let destroying;

              beforeEach(() => {
                destroying = model.destroy({wait: true});
              });

              it('immediately removes itself from the collection', () => {
                assert.equal(collection.remove.callCount, 1);
                assert.equal(model.collection, undefined);
                assert.ok(collection.remove.calledWithExactly(model));
              });

              it('empties the previous attributes of the model (all attributes considered new)', () => {
                return destroying
                  .then(() => {
                    assert.deepEqual(model.previous(), {});
                  });
              });

              it('removes itself from the collection', () => {
                return destroying
                  .then(() => {
                    assert.equal(collection.remove.callCount, 1);
                    assert.ok(collection.remove.calledWithExactly(model));
                  });
              });

              it('emits "destroy"', () => {
                return destroying
                  .then(() => {
                    model.removeListener('destroy', destroyListener);
                    assert.equal(destroyListener.callCount, 1);
                    assert.ok(destroyListener.calledWithExactly());
                  });
              });

              it('does not call fetch', () => {
                assert.equal(fakeFetch.callCount, 0);
              });
            });

            describe('wait option is falsy', () => {
              let destroying;

              beforeEach(() => {
                destroying = model.destroy({wait: false});
              });

              it('immediately removes itself from the collection', () => {
                assert.equal(collection.remove.callCount, 1);
                assert.ok(collection.remove.calledWithExactly(model));
                assert.equal(model.collection, undefined);
              });

              it('empties the previous attributes of the model (all attributes considered new)', () => {
                return destroying
                  .then(() => {
                    assert.deepEqual(model.previous(), {});
                  });
              });

              it('emits "destroy"', () => {
                return destroying
                  .then(() => {
                    model.removeListener('destroy', destroyListener);
                    assert.equal(destroyListener.callCount, 1);
                    assert.ok(destroyListener.calledWithExactly());
                  });
              });

              it('does not call fetch', () => {
                assert.equal(fakeFetch.callCount, 0);
              });
            });
          });

          describe('without a collection', () => {
            describe('wait option is truthy', () => {
              let destroying;

              beforeEach(() => {
                destroying = model.destroy({wait: true});
              });

              it('empties the previous attributes of the model (all attributes considered new)', () => {
                return destroying
                  .then(() => {
                    assert.deepEqual(model.previous(), {});
                  });
              });

              it('emits "destroy"', () => {
                return destroying
                  .then(() => {
                    model.removeListener('destroy', destroyListener);
                    assert.equal(destroyListener.callCount, 1);
                    assert.ok(destroyListener.calledWithExactly());
                  });
              });

              it('does not call fetch', () => {
                assert.equal(fakeFetch.callCount, 0);
              });
            });

            describe('wait option is falsy', () => {
              let destroying;

              beforeEach(() => {
                destroying = model.destroy({wait: false});
              });

              it('empties the previous attributes of the model (all attributes considered new)', () => {
                return destroying
                  .then(() => {
                    assert.deepEqual(model.previous(), {});
                  });
              });

              it('emits "destroy"', () => {
                return destroying
                  .then(() => {
                    model.removeListener('destroy', destroyListener);
                    assert.equal(destroyListener.callCount, 1);
                    assert.ok(destroyListener.calledWithExactly());
                  });
              });

              it('does not call fetch', () => {
                assert.equal(fakeFetch.callCount, 0);
              });
            });
          });
        });
      });
    });
  });
});
