import {EventEmitter, Model, Collection} from '../vertebrate.js';
import Deferred from './Deferred';
import assert from 'assert';
import sinon from 'sinon';

describe('Collection', () => {
  let sandbox = sinon.sandbox.create();
  let fetchDeferred;
  let fakeFetch;

  beforeEach(() => {
    fetchDeferred = new Deferred();

    fakeFetch = sandbox.stub().returns(fetchDeferred.promise);

    global.fetch = fakeFetch;
  });

  afterEach(() => sandbox.restore());

  describe('class', () => {
    it('is a function', () => {
        assert.equal(typeof Collection, 'function');
    });

    it('throws when called without new', () => {
        assert.throws(Collection);
    });

    it('returns an object when called with new', () => {
        assert.doesNotThrow(() => new Collection());
    });

    it('uses Model as its default collection item class', () => {
      assert.equal(new Collection().Model, Model);
    });

    describe('instance', () => {
      it('is an instance of Collection', () => {
        assert.ok(new Collection() instanceof Collection);
      });

      it('is an instance of EventEmitter', () => {
        assert.ok(new Collection() instanceof EventEmitter);
      });

      it('has a string tag of "VertebrateCollection"', () => {
        assert.equal(Object.prototype.toString.call(new Collection()), '[object VertebrateCollection]');
      });

      it('iterates over models', () => {
        let collection = new Collection();
        let models = [new Model(), new Model(), new Model()];

        collection.add(models);

        let retrieved = [];

        for (let model of models) {
          retrieved.push(model);
        }

        for (let [index, model] of models.entries()) {
          assert.equal(model, retrieved[index]);
        }
      });

      describe('length property', () => {
        let collection;

        beforeEach(() => {
          collection = new Collection();
        });

        it('returns the number of models in the collection', () => {
          assert.equal(collection.length, 0);

          collection.add(new Model());

          assert.equal(collection.length, 1);

          collection.add(new Model());

          assert.equal(collection.length, 2);
        });
      });

      describe('models', () => {
        let models;
        let collection;

        beforeEach(() => {
          models = [new Model({id: 1}), new Model({id: 2})];
          collection = new Collection();
          collection.add(models);
        });

        it('returns an array of models in the collection', () => {
          assert.deepEqual(collection.models(), models);
        });

        it('returns shallow copies', () => {
          assert.notEqual(collection.models(), collection.models());
        });
      });

      describe('add', () => {
        let TestModel;
        let collection;
        let addListener;
        let updateListener;
        let sortListener;

        beforeEach(() => {
          TestModel = class extends Model {};

          collection = new class extends Collection {
            constructor() {
              super();

              this.Model = TestModel;
            }
          }();

          addListener = sandbox.stub();
          updateListener = sandbox.stub();
          sortListener = sandbox.stub();

          collection.on('add', addListener);
          collection.on('update', updateListener);
          collection.on('sort', sortListener);
        });

        afterEach(() => {
          collection.removeListener('add', addListener);
          collection.removeListener('remove', updateListener);
        });

        describe('adding models which do not inherit from collection.Model', () => {
          it('throws an error', () => {
            assert.throws(
              () => collection.add(new Model()),
              err => err instanceof Error,
              'Models added must be non-model objects or instances of collection.Model'
            );
          });
        });

        describe('adding models which do inherit from collection.Model', () => {
          it('does not throw an error', () => {
            let model = new class extends TestModel {}();

            assert.doesNotThrow(() => collection.add(model));
          });
        });

        describe('adding objects which are not models', () => {
          it('vivifies the object as an instance of model.Collection before adding it', () => {
            collection.add({id: 123});

            assert.equal(collection.length, 1);
            assert.ok(collection.get(123) instanceof collection.Model);
          });
        });

        describe('objects representing old models not in collection', () => {
          let objects;

          beforeEach(() => {
            objects = [{id: 10}, {id: 20}];
          });

          it('vivifies and adds models in an array to the collection', () => {
            collection.add(objects);

            assert.equal(collection.length, 2);
            assert.equal(collection.models()[0].id, 10);
            assert.equal(collection.models()[1].id, 20);
          });

          it('emits "add" with the model for each model added', () => {
            collection.add(objects);

            assert.equal(addListener.callCount, 2);
            assert.ok(addListener.args[0][0] instanceof collection.Model);
            assert.equal(addListener.args[0][0].id, 10);
            assert.ok(addListener.args[1][0] instanceof collection.Model);
            assert.equal(addListener.args[1][0].id, 20);
          });

          it('sorts the collection after each addition', () => {
            objects.push({id: 1}, {id: 11});

            let sortingStub = sandbox.stub();

            function addListener() {
              sortingStub(collection.models().map(model => model.id));
            }

            collection.on('add', addListener);
            collection.add(objects);
            collection.removeListener('add', addListener);

            assert.deepEqual(sortingStub.args[0][0], [10]);
            assert.deepEqual(sortingStub.args[1][0], [10, 20]);
            assert.deepEqual(sortingStub.args[2][0], [1, 10, 20]);
            assert.deepEqual(sortingStub.args[3][0], [1, 10, 11, 20]);
          });

          it('emits "update" after all "add" events', () => {
            collection.add(objects);

            assert.equal(updateListener.callCount, 1);
            assert.ok(!updateListener.calledBefore(addListener));
          });

          it('does not emit a "sort" event when models are naturally sorted', () => {
            collection.add(objects);

            assert.equal(sortListener.callCount, 0);
          });

          it('emits a "sort" event when models are not naturally sorted', () => {
            objects.reverse();
            collection.add(objects);

            assert.equal(sortListener.callCount, 1);
          });
        });

        describe('old models not represented in collection', () => {
          let models;

          beforeEach(() => {
            models = [new TestModel({id: 10}), new TestModel({id: 20})];
          });

          it('emits "add" with the model for each model added', () => {
            collection.add(models);

            assert.equal(addListener.callCount, 2);
            assert.equal(addListener.args[0][0], models[0]);
            assert.equal(addListener.args[1][0], models[1]);
          });

          it('sorts the collection after each addition', () => {
            models.push(new TestModel({id: 1}), new TestModel({id: 11}));

            let sortingStub = sandbox.stub();

            function addListener() {
              sortingStub(collection.models().map(model => model.id));
            }

            collection.on('add', addListener);
            collection.add(models);
            collection.removeListener('add', addListener);

            assert.deepEqual(sortingStub.args[0][0], [10]);
            assert.deepEqual(sortingStub.args[1][0], [10, 20]);
            assert.deepEqual(sortingStub.args[2][0], [1, 10, 20]);
            assert.deepEqual(sortingStub.args[3][0], [1, 10, 11, 20]);
          });

          it('emits "update" after all "add" events', () => {
            collection.add(models);

            assert.equal(updateListener.callCount, 1);
            assert.ok(!updateListener.calledBefore(addListener));
          });

          it('does not emit a "sort" event when models are naturally sorted', () => {
            collection.add(models);

            assert.equal(sortListener.callCount, 0);
          });

          it('emits a "sort" event when models are not naturally sorted', () => {
            models.reverse();
            collection.add(models);

            assert.equal(sortListener.callCount, 1);
          });
        });

        describe('new models', () => {
          let TestCollection;
          let models;
          let collection;

          beforeEach(() => {
            TestCollection = class extends Collection {
              constructor() {
                super();

                this.Model = TestModel;
              }

              comparator(a, b) {
                return a.getAttribute('someField') - b.getAttribute('someField');
              }
            };

            collection = new TestCollection();

            collection.on('add', addListener);
            collection.on('update', updateListener);
            collection.on('sort', sortListener);

            models = [new TestModel({someField: 10}), new TestModel({someField: 20})];
          });

          afterEach(() => {
            collection.removeListener('add', addListener);
            collection.removeListener('update', updateListener);
            collection.removeListener('sort', sortListener);
          });

          it('emits "add" with the model for each model added', () => {
            collection.add(models);

            assert.equal(addListener.callCount, 2);
            assert.equal(addListener.args[0][0], models[0]);
            assert.equal(addListener.args[1][0], models[1]);
          });

          it('sorts the collection after each addition', () => {
            models.push(new TestModel({someField: 1}), new TestModel({someField: 11}));

            let sortingStub = sandbox.stub();

            function addListener() {
              sortingStub(collection.models().map(model => model.getAttribute('someField')));
            }

            collection.on('add', addListener);
            collection.add(models);
            collection.removeListener('add', addListener);

            assert.deepEqual(sortingStub.args[0][0], [10]);
            assert.deepEqual(sortingStub.args[1][0], [10, 20]);
            assert.deepEqual(sortingStub.args[2][0], [1, 10, 20]);
            assert.deepEqual(sortingStub.args[3][0], [1, 10, 11, 20]);
          });

          it('emits "update" after all "add" events', () => {
            collection.add(models);

            assert.equal(updateListener.callCount, 1);
            assert.ok(!updateListener.calledBefore(addListener));
          });

          it('does not emit a "sort" event when models are naturally sorted', () => {
            collection.add(models);

            assert.equal(sortListener.callCount, 0);
          });

          it('emits a "sort" event when models are not naturally sorted', () => {
            models.reverse();
            collection.add(models);

            assert.equal(sortListener.callCount, 1);
          });
        });

        describe('duplicates', () => {
          let oldModels;
          let newModels;
          let replaceListener;

          beforeEach(() => {
            replaceListener = sandbox.stub();

            oldModels = [
              new TestModel({id: 10, something: 'before10', x: true}),
              new TestModel({id: 20, something: 'before20', x: true})
            ];

            newModels = [
              new TestModel({id: 10, something: 'after10', y: true}),
              new TestModel({id: 20, something: 'after20', y: true})
            ];

            collection.add(oldModels);

            addListener.reset();
            updateListener.reset();

            collection.on('replace', replaceListener);
          });

          afterEach(() => {
            collection.removeListener('replace', replaceListener);
          });

          describe('ignore, (default)', () => {
            beforeEach(() => {
              collection.add(newModels);
            });

            it('does not replace or modify existing models', () => {
              let models = collection.models();

              assert.equal(models.length, 2);
              assert.equal(models[0], oldModels[0]);
              assert.equal(models[1], oldModels[1]);

              assert.deepEqual(models[0].getAttributes(), {
                id: 10,
                something: 'before10',
                x: true
              });

              assert.deepEqual(models[1].getAttributes(), {
                id: 20,
                something: 'before20',
                x: true
              });
            });
          });

          describe('replace', () => {
            beforeEach(() => {
              collection.add(newModels, {handleDuplicates: 'replace'});
            });

            it('replaces old models with new models', () => {
              let models = collection.models();

              assert.equal(models.length, 2);
              assert.equal(models[0], newModels[0]);
              assert.equal(models[1], newModels[1]);

              assert.deepEqual(models[0].getAttributes(), {
                id: 10,
                something: 'after10',
                y: true
              });

              assert.deepEqual(models[1].getAttributes(), {
                id: 20,
                something: 'after20',
                y: true
              });
            });

            it('does not fire an "add" events', () => {
              assert.equal(addListener.callCount, 0);
            });

            it('fires replace events with old and new models as arguments', () => {
              assert.equal(replaceListener.callCount, 2);
              assert.equal(replaceListener.args[0][0], oldModels[0]);
              assert.equal(replaceListener.args[0][1], newModels[0]);
              assert.equal(replaceListener.args[1][0], oldModels[1]);
              assert.equal(replaceListener.args[1][1], newModels[1]);
            });
          });

          describe('mergeNewIntoOld', () => {
            beforeEach(() => {
              collection.add(newModels, {handleDuplicates: 'mergeNewIntoOld'});
            });

            it('updates the old model with properties of the new model', () => {
              let models = collection.models();

              assert.equal(models.length, 2);
              assert.equal(models[0], oldModels[0]);
              assert.equal(models[1], oldModels[1]);

              assert.deepEqual(models[0].getAttributes(), {
                id: 10,
                something: 'after10',
                x: true,
                y: true
              });

              assert.deepEqual(models[1].getAttributes(), {
                id: 20,
                something: 'after20',
                x: true,
                y: true
              });
            });

            it('does not fire "add" events', () => {
              assert.equal(addListener.callCount, 0);
            });

            it('does not fire "replace" events', () => {
              assert.equal(replaceListener.callCount, 0);
            });
          });

          describe('mergeOldIntoNew', () => {
            beforeEach(() => {
              collection.add(newModels, {handleDuplicates: 'mergeOldIntoNew'});
            });

            it('updates the new models with the old model properties, and replaces the old models', () => {
              let models = collection.models();

              assert.equal(models.length, 2);
              assert.equal(models[0], newModels[0]);
              assert.equal(models[0], newModels[0]);

              assert.deepEqual(models[0].getAttributes(), {
                id: 10,
                something: 'before10',
                x: true,
                y: true
              });

              assert.deepEqual(models[1].getAttributes(), {
                id: 20,
                something: 'before20',
                x: true,
                y: true
              });
            });

            it('does not fire "add" events', () => {
              assert.equal(addListener.callCount, 0);
            });

            it('fires replace events with old and new models as arguments', () => {
              assert.equal(replaceListener.callCount, 2);
              assert.equal(replaceListener.args[0][0], oldModels[0]);
              assert.equal(replaceListener.args[0][1], newModels[0]);
              assert.equal(replaceListener.args[1][0], oldModels[1]);
              assert.equal(replaceListener.args[1][1], newModels[1]);
            });
          });
        });
      });

      describe('remove', () => {
        let models;
        let collection;
        let removeListener;
        let updateListener;

        beforeEach(() => {
          models = [new Model({id: 10}), new Model({id: 20})];
          collection = new Collection();

          removeListener = sandbox.stub();
          updateListener = sandbox.stub();

          collection.add(models);

          collection.on('remove', removeListener);
          collection.on('update', updateListener);
        });

        afterEach(() => {
          collection.removeListener('update', updateListener);
          collection.removeListener('remove', removeListener);
        });

        describe('first argument is a model', () => {
          it('removes the element when it is in the collection', () => {
            collection.remove(models[0]);

            assert.equal(collection.length, 1);
            assert.equal(collection.models()[0], models[1]);
          });

          it('returns the element when it is in the collection', () => {
            let results = collection.remove(models[0]);

            assert.equal(results.length, 1);
            assert.equal(results[0], models[0]);
          });

          it('matches the ID of the given model to remove a model from the collection', () => {
            collection.remove(new Model({id: 10}));

            assert.equal(collection.length, 1);
            assert.equal(collection.models()[0], models[1]);
          });

          it('matches the ID of the given object to remove a model from the collection', () => {
            collection.remove({id: 10});

            assert.equal(collection.length, 1);
            assert.equal(collection.models()[0], models[1]);
          });

          it('matches an ID to remove a model from the collection', () => {
            collection.remove(10);

            assert.equal(collection.length, 1);
            assert.equal(collection.models()[0], models[1]);
          });

          it('emits "remove" with the removed model', () => {
            collection.remove(10);

            assert.equal(removeListener.callCount, 1);
            assert.ok(removeListener.calledWithExactly(models[0]));
          });

          it('emits "update" after "remove"', () => {
            collection.remove(10);

            assert.equal(updateListener.callCount, 1);
            assert.ok(updateListener.calledWithExactly());
            assert.ok(updateListener.calledAfter(removeListener));
          });
        });

        describe('first argument is an array', () => {
          it('removes the elements when they are in the collection', () => {
            collection.remove([models[0], models[1]]);

            assert.equal(collection.length, 0);
          });

          it('returns the element when it is in the collection', () => {
            let results = collection.remove([models[0], models[1]]);

            assert.equal(results.length, 2);
            assert.equal(results[0], models[0]);
            assert.equal(results[1], models[1]);
          });

          it('matches the ID of the given model to remove a model from the collection', () => {
            collection.remove([new Model({id: 10})]);

            assert.equal(collection.length, 1);
            assert.equal(collection.models()[0], models[1]);
          });

          it('matches the ID of the given object to remove a model from the collection', () => {
            collection.remove([{id: 10}]);

            assert.equal(collection.length, 1);
            assert.equal(collection.models()[0], models[1]);
          });

          it('matches an ID to remove a model from the collection', () => {
            collection.remove([10]);

            assert.equal(collection.length, 1);
            assert.equal(collection.models()[0], models[1]);
          });

          it('emits "remove" with each removed model', () => {
            collection.remove([10, 20]);

            assert.equal(removeListener.callCount, 2);
            assert.ok(removeListener.args[0][0], models[0]);
            assert.ok(removeListener.args[1][0], models[1]);
          });

          it('emits "update" after all "remove" events', () => {
            collection.remove([10, 20]);

            assert.equal(updateListener.callCount, 1);
            assert.ok(updateListener.calledWithExactly());
            assert.ok(!updateListener.calledBefore(removeListener));
          });
        });
      });

      describe('comparator', () => {
        it('defaults to ID ascending', () => {
          let list = [{id: 1}, {id: 6}, {id: 3}, {id: 2}, {id: 7}].sort(Collection.prototype.comparator);

          assert.deepEqual(list, [{id: 1}, {id: 2}, {id: 3}, {id: 6}, {id: 7}]);
        });

        it('can be replaced through subclassing', () => {
          let collection = new class extends Collection {
            comparator(a, b) {
              return b.id - a.id;
            }
          }();

          collection.add([
            new Model({id: 1}),
            new Model({id: 6}),
            new Model({id: 3}),
            new Model({id: 2}),
            new Model({id: 7})
          ]);

          assert.deepEqual(collection.models().map(model => model.id), [7, 6, 3, 2, 1]);
        });
      });

      describe('toJSON', () => {
        let collection;

        beforeEach(() => {
          sandbox.stub(Collection.prototype, 'models').returns('test');

          collection = new Collection();

          class TestModel extends Model {
            toJSON() {
              return this.id;
            }
          }

          collection.add([
            new TestModel({id: 1}),
            new TestModel({id: 2}),
            new TestModel({id: 3}),
            new TestModel({id: 4})
          ]);
        });

        it('returns a list of return values from a toJSON call on each model member', () => {
          assert.deepEqual(collection.toJSON(), [1, 2, 3, 4]);
        });
      });

      describe('url', () => {
        it('throws an error when url method not overridden', () => {
          assert.throws(
            () => new Collection().url(),
            err => err instanceof Error,
            'Subclass collection to set the URL field.'
          );
        });
      });

      describe('get', () => {
        it('returns the passed model when the model is in the collection', () => {
          let collection = new Collection();
          let model = new Model();

          collection.add(model);

          assert.equal(collection.get(model), model);
        });

        it('returns the passed model corresponding to the ID in an object or model', () => {
          let collection = new Collection();
          let model = new Model({id: 10});

          collection.add(model);

          assert.equal(collection.get({id: 10}), model);
        });

        it('returns the passed model corresponding to a given ID', () => {
          let collection = new Collection();
          let model = new Model({id: 10});

          collection.add(model);

          assert.equal(collection.get(10), model);
        });
      });

      describe('checkResponse', () => {
        let checkResponse = Collection.prototype.checkResponse;

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

      describe('parse', () => {
        let parse = Collection.prototype.parse;

        it('parses the response as JSON', () => {
          let fakeRes = {
            json: sandbox.stub().returns([])
          };

          parse(fakeRes);

          assert.equal(fakeRes.json.callCount, 1);
          assert.ok(fakeRes.json.calledWithExactly());
        });

        it('throws when the parsed response body is not an array', () => {
          let fakeRes = {
            json: sandbox.stub().returns()
          };

          assert.throws(
            () => parse(fakeRes),
            err => err instanceof Error,
            'Parsed server response body was not an array.'
          );
        });

        it('returns parsed response data when it is an array', () => {
          let anArray = [];
          let fakeRes = {
            json: sandbox.stub().returns(anArray)
          };

          assert.equal(parse(fakeRes), anArray);
        });
      });

      describe('fetch', () => {
        let collection;
        let promise;
        let checkResponseStub;
        let parseStub;

        beforeEach(() => {
          checkResponseStub = sandbox.stub();
          parseStub = sandbox.stub();

          collection = new class extends Collection {
            url() {
              return '/some/test/url';
            }

            checkResponse(...args) {
              return checkResponseStub(...args);
            }

            parse(...args) {
              return parseStub(...args);
            }
          }();
        });

        it('makes a request with the collection URL and same-origin cookies', () => {
          promise = collection.fetch();

          assert.equal(fakeFetch.callCount, 1);
          assert.equal(fakeFetch.args[0][0], '/some/test/url');
          assert.deepEqual(fakeFetch.args[0][1], {credentials: 'same-origin'});
        });

        it('checks the response', () => {
          promise = collection.fetch();

          let response = {hello: 'world'};

          fetchDeferred.resolve(response);

          return fetchDeferred.promise.then(() => {
            assert.equal(checkResponseStub.callCount, 1);
            assert.ok(checkResponseStub.calledWithExactly(response));
          });
        });

        it('rejects when checkResponse throws', done => {
          promise = collection.fetch();

          let response = {hello: 'world'};
          let error = new Error('oh noes!');

          checkResponseStub.throws(error);

          fetchDeferred.resolve(response);

          promise.catch((err) => {
            assert.equal(err, error);
            done();
          });
        });

        it('calls parse with the return value of checkResponse', () => {
          promise = collection.fetch();

          let response = {hello: 'world'};

          checkResponseStub.returns('something');

          assert.equal(parseStub.callCount, 0);

          fetchDeferred.resolve(response);

          return fetchDeferred.promise.then(() => {
            return Promise.resolve().then(() => {
              assert.equal(checkResponseStub.callCount, 1);
              assert.equal(parseStub.callCount, 1);
              assert.equal(parseStub.args[0][0], 'something');
            });
          });
        });

        it('rejects when parse throws', done => {
          promise = collection.fetch();

          let response = {hello: 'world'};
          let error = new Error('oh noes!');

          checkResponseStub.throws(error);

          fetchDeferred.resolve(response);

          promise.catch((err) => {
            assert.equal(err, error);
            done();
          });
        });

        it('calls collection.add with the new models data by default', () => {
          promise = collection.fetch();

          let addStub = sandbox.stub(Collection.prototype, 'add');
          let parsedData = [{id: 3}, {id: 5}, {id: 7}];

          parseStub.returns(parsedData);

          fetchDeferred.resolve();

          return promise
            .then(() => {
              assert.equal(addStub.callCount, 1);
              assert.deepEqual(addStub.args[0][0], parsedData);
            });
        });

        it('does not call collection.add when option "add" is set to false', () => {
          promise = collection.fetch({add: false});

          let addStub = sandbox.stub(Collection.prototype, 'add');

          parseStub.returns([{id: 3}, {id: 5}, {id: 7}]);

          fetchDeferred.resolve();

          return promise
            .then(() => {
              assert.equal(addStub.callCount, 0);
            });
        });

        it('calls model.reset with for each updated model with "keepExistingAsChanges" set to true by defualt', () => {
          promise = collection.fetch();

          let modelsResetStub = sandbox.stub(Model.prototype, 'reset');

          collection.add([{id: 3, blah: true}, {id: 5, blah: true}]);

          let parsedData = [{id: 3, extra: true}, {id: 5, extra: true}];

          parseStub.returns(parsedData);

          fetchDeferred.resolve();

          return promise
            .then(() => {
              assert.equal(modelsResetStub.callCount, 2);
              assert.equal(modelsResetStub.thisValues[0], collection.get(3));
              assert.equal(modelsResetStub.args[0][0], parsedData[0]);
              assert.deepEqual(modelsResetStub.args[0][1], {keepExistingAsChanges: true});
              assert.equal(modelsResetStub.thisValues[1], collection.get(5));
              assert.equal(modelsResetStub.args[1][0], parsedData[1]);
              assert.deepEqual(modelsResetStub.args[1][1], {keepExistingAsChanges: true});
            });
        });

        it('calls model.reset with for each updated model with "keepExistingAsChanges" set to false when option "merge" is false', () => {
          promise = collection.fetch({merge: false});

          let modelsResetStub = sandbox.stub(collection.Model.prototype, 'reset');

          collection.add([{id: 3, extra: true}, {id: 5, extra: true}]);

          let parsedData = [{id: 3}, {id: 5}];

          parseStub.returns(parsedData);

          fetchDeferred.resolve();

          return promise
            .then(() => {
              assert.equal(modelsResetStub.callCount, 2);
              assert.equal(modelsResetStub.thisValues[0], collection.get(3));
              assert.equal(modelsResetStub.args[0][0], parsedData[0]);
              assert.deepEqual(modelsResetStub.args[0][1], {keepExistingAsChanges: false});
              assert.equal(modelsResetStub.thisValues[1], collection.get(5));
              assert.equal(modelsResetStub.args[1][0], parsedData[1]);
              assert.deepEqual(modelsResetStub.args[1][1], {keepExistingAsChanges: false});
            });
        });

        it('removes models in the collection and not in the fetched data by default', () => {
          promise = collection.fetch();

          let removeStub = sandbox.stub(Collection.prototype, 'remove');

          collection.add([{id: 3}]);

          parseStub.returns([]);

          fetchDeferred.resolve();

          return promise
            .then(() => {
              assert.equal(removeStub.callCount, 1);
              assert.equal(removeStub.args[0][0].length, 1);
              assert.equal(removeStub.args[0][0][0], collection.get(3));
            });
        });

        it('does not remove models in the collection when option merge is set to false', () => {
          promise = collection.fetch({remove: false});

          let removeStub = sandbox.stub(Collection.prototype, 'remove');

          collection.add([{id: 3}]);

          parseStub.returns([]);

          fetchDeferred.resolve();

          return promise
            .then(() => {
              assert.equal(removeStub.callCount, 0);
            });
        });

        it('emits "sync" after models have been added to the collection', () => {
          promise = collection.fetch();

          let syncListener = sandbox.stub();

          collection.on('sync', syncListener);

          parseStub.returns([{id: 3}, {id: 5}, {id: 7}]);

          fetchDeferred.resolve();

          return promise
            .then(() => {
              collection.removeListener('sync', syncListener);
              assert.equal(syncListener.callCount, 1);
              assert.ok(syncListener.calledWithExactly());
            });
        });
      });

      describe('save', () => {
        let collection;
        let TestModel;
        let saveStub;
        let deferred0;
        let deferred1;
        let deferred2;

        beforeEach(() => {
          saveStub = sandbox.stub();

          deferred0 = new Deferred();
          deferred1 = new Deferred();
          deferred2 = new Deferred();

          saveStub.onCall(0).returns(deferred0.promise);
          saveStub.onCall(1).returns(deferred1.promise);
          saveStub.onCall(2).returns(deferred2.promise);

          TestModel = class extends Model {
            save(...args) {
              return saveStub.apply(this, args);
            }
          };

          collection = new class extends Collection {
            constructor() {
              super();
              this.Model = TestModel;
            }
          }();
        });

        it('calls save on all contained models', () => {
          collection.add([{test: 'a'}, {test: 'b'}, {test: 'c'}]);
          collection.save();

          assert.equal(saveStub.callCount, 3);
          assert.deepEqual(saveStub.thisValues[0].getAttributes(), {test: 'a'});
          assert.deepEqual(saveStub.thisValues[1].getAttributes(), {test: 'b'});
          assert.deepEqual(saveStub.thisValues[2].getAttributes(), {test: 'c'});
        });

        it('resolves when all save promises have resolved', () => {
          collection.add([{test: 'a'}, {test: 'b'}, {test: 'c'}]);

          let promise = collection.save();

          deferred0.resolve('test0');
          deferred1.resolve('test1');
          deferred2.resolve('test2');

          return promise
            .then(results => assert.deepEqual(results, ['test0', 'test1', 'test2']));
        });
      });

      describe('model events', () => {
        let collection;
        let model;
        let eventListener;

        beforeEach(() => {
          collection = new Collection();
          model = new Model();
          eventListener = sandbox.stub();

          collection.add(model);

          collection.on('test-event', eventListener);
        });

        afterEach(() => {
          collection.removeListener('test-event', eventListener);
        });

        it('proxies events from model members', () => {
          assert.equal(eventListener.callCount, 0);

          model.emit('test-event', 123);
          model.emit('test-event', 456);

          assert.equal(eventListener.callCount, 2);
          assert.ok(eventListener.calledWithExactly(model, 123));
          assert.ok(eventListener.calledWithExactly(model, 456));
        });

        it('does not proxy events from removed models', () => {

        });
      });
    });
  });
});
