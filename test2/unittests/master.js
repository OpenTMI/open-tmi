/* eslint-disable func-names, prefer-arrow-callback, no-unused-expressions */

// Native components
const path = require('path');
const cluster = require('cluster');
const os = require('os');
const EventEmitter = require('events');

// Third party components
const Promise = require('bluebird');
const sinon = require('sinon');

// Local components
const chai = require('../');
const eventBus = require('../../app/tools/eventBus');

// Test variables
const {expect} = chai;
const filePath = path.resolve('app');
let Master;

describe('app/master.js', function () {
  let forkEmitter;
  beforeEach(function () {
    delete require.cache[path.join(filePath, 'master.js')];
    Master = require('../../app/master'); // eslint-disable-line
    forkEmitter = new EventEmitter();
    sinon.stub(cluster, 'fork').returns(forkEmitter);
    sinon.stub(Master, 'listen').callsFake(() => Promise.resolve());

    eventBus.removeAllListeners();
    cluster.removeAllListeners();
  });
  afterEach(function () {
    cluster.fork.restore();
    Master.listen.restore();
  });

  after(function () {
    const modulePath = path.join(filePath, 'tools', 'eventBus', 'index.js');
    delete require.cache[modulePath];
  });

  describe('initialize', function () {
    beforeEach(function () {
      sinon.stub(Master, 'forkWorker');
      sinon.stub(Master, 'createFileListener');
      sinon.stub(Master, 'activateFileListener');
    });
    afterEach(function () {
      Master.forkWorker.restore();
      Master.createFileListener.restore();
      Master.activateFileListener.restore();
    });
    it('should listen for process and cluster events', function () {
      sinon.stub(Master, 'handleSIGINT').callsFake(() => Master.logMasterDeath());
      sinon.stub(Master, 'logMasterDeath').callsFake(() => {
        expect(Master.handleSIGINT.calledOnce).to.equal(true,
          'handleSIGINT should be called before logMasterDeath.');
        cluster.emit('exit');
      });
      let workerExitResolve;
      const workerExit = new Promise((resolve) => { workerExitResolve = resolve; });
      sinon.stub(Master, 'handleWorkerExit').callsFake(() => {
        expect(Master.handleSIGINT.calledOnce).to.equal(true,
          'handleSIGINT should be called before handleWorkerExit.');
        expect(Master.logMasterDeath.calledOnce).to.equal(true,
          'logMasterDeath should be called before handleWorkerExit.');
        workerExitResolve();
      });
      const pending = Master.initialize().then(Master.handleSIGINT);
      return Promise
        .all([pending, workerExit])
        .finally(() => {
          Master.handleSIGINT.restore();
          Master.logMasterDeath.restore();
          Master.handleWorkerExit.restore();
        });
    });

    it('should listen for eventBus events', function () {
      sinon.stub(Master, 'broadcastHandler').callsFake((event, meta, data) => {
        expect(event).to.equal('testEvent');
        expect(data).to.equal('testData');

        eventBus.removeListener('*', Master.broadcastHandler);
        eventBus.emit('masterStatus', {id: 'testId', data: 'testData'});
      });

      sinon.stub(Master, 'statusHandler').callsFake((meta, data) => {
        expect(data).to.deep.equal({id: 'testId', data: 'testData'});
        eventBus.emit('workerRestartNeeded', 'reasons');
      });
      let workerExitResolve;
      const workerExit = new Promise((resolve) => { workerExitResolve = resolve; });
      sinon.stub(Master, 'handleWorkerRestart').callsFake((meta, reason) => {
        expect(reason).to.equal('reasons');
        workerExitResolve();
      });

      const pending = Master.initialize();
      eventBus.emit('testEvent', 'testData');
      return Promise.all([pending, workerExit])
        .finally(() => {
          Master.broadcastHandler.restore();
          Master.statusHandler.restore();
          Master.handleWorkerRestart.restore();
        });
    });

    it('should call createFileListener and activateFileListener when auto-reload is true', function () {
      Master.createFileListener.returns('mockFileWatcher');
      Master.activateFileListener.callsFake((watcher) => {
        expect(watcher).to.equal('mockFileWatcher');
        expect(Master.createFileListener.calledOnce).to.equal(true,
          'should call createFileListener before listener activation');
      });
      return Master.initialize(true)
        .then(() => {
          expect(Master.createFileListener.calledOnce).to.equal(true,
            'listener should be created when auto-reload is true');
          expect(Master.activateFileListener.calledOnce).to.equal(true,
            'listener should be activated when auto-reload is true');
        });
    });

    it('should not call createFileListener and activateFileListener when auto-reload is false', function () {
      return Master.initialize()
        .then(() => {
          expect(Master.createFileListener.calledOnce).to.equal(false,
            'should not create file listener when autoReload is false');
          expect(Master.activateFileListener.calledOnce).to.equal(false,
            'should not activate file listener when autoReload is false');
        });
    });

    it('should call fork os.cpus().length times', function () {
      const cpus = process.env.CI ? 2 : os.cpus().length;
      return Master.initialize().then(() => {
        expect(Master.forkWorker.callCount).to.equal(cpus, 'Should fork worker for each cpu core.');
        expect(Master.listen.callCount).to.equal(1, 'sould call listen once');
      });
    });
  });

  describe('handleWorkerRestart', function () {
    it('should call reloadAllWorkers', function () {
      let done;
      const pending = new Promise((resolve) => { done = resolve; });
      sinon.stub(Master, 'reloadAllWorkers').callsFake(done);
      Master.handleWorkerRestart(undefined, undefined);
      return pending
        .finally(() => {
          Master.reloadAllWorkers.restore();
        });
    });
  });

  describe('getStats', function () {
    it('should return object with valid fields', function () {
      Master.getStats()
        .then((stats) => {
          expect(stats).to.have.property('master');
          expect(stats).to.have.property('os');
          expect(stats).to.have.property('osStats');
          expect(stats).to.have.property('workers');
          expect(stats).to.have.property('hostname');

          expect(stats.master).to.have.property('coresUsed');

          expect(stats.osStats).to.have.property('averageLoad');
          expect(stats.osStats).to.have.property('memoryUsageAtBoot');
          expect(stats.osStats).to.have.property('totalMem');
          expect(stats.osStats).to.have.property('currentMemoryUsage');
          expect(stats.osStats).to.have.property('cpu');
        });
    });
  });

  describe('statusHandler', function () {
    it('should emit event (data.id) with (Master.getStats()) data', function () {
      sinon.stub(Master, 'getStats').callsFake(() => Promise.resolve('handler_testData'));
      let done;
      const pending = new Promise((resolve) => { done = resolve; });
      eventBus.on('handler_testEvent', (meta, data) => {
        expect(data).to.equal('handler_testData');
        done();
      });
      Master.statusHandler({}, {id: 'handler_testEvent'});
      return pending.finally(() => Master.getStats.restore());
    });

    it('should not throw error when no id defined', function () {
      Master.statusHandler({}, 5);
    });
  });

  describe('broadcastHandler', function () {
    it('should not throw errors with valid params', function () {
      Master.broadcastHandler('name', {field1: 'sop', field2: 'sep'}, ['data', 'pata']);
    });
  });

  describe('forkWorker', function () {
    it('should call fork', function () {
      const forkPromise = Master.forkWorker()
        .then(() => {
          expect(cluster.fork.calledOnce).to.equal(true);
          expect(forkEmitter.listenerCount('exit')).to
            .equal(1, 'Should remove rejecting exit event listener before rejecting.');
          expect(forkEmitter.listenerCount('listening')).to
            .equal(1, 'Should still listen to listening events');
          expect(forkEmitter.listenerCount('message')).to
            .equal(1, 'Should listen to message events');
        });
      forkEmitter.emit('listening');
      return forkPromise;
    });

    it('should reject promise on early exit', function () {
      const forkPromise = Master.forkWorker();
      forkEmitter.emit('exit');
      return expect(forkPromise).to.eventually.be.rejectedWith(Error, 'Should not exit before listening event.');
    });

    it('should redirect message from worker to onWorkerMessage', function () {
      sinon.stub(Master, 'onWorkerMessage').callsFake((data) => {
        expect(data).to.equal('data');
        forkEmitter.emit('listening');
      });

      const forkPromise = Master.forkWorker();

      forkEmitter.emit('message', 'data');
      return forkPromise.finally(() => Master.onWorkerMessage.restore());
    });
  });

  describe('onWorkerMessage', function () {
    it('should pass event message to correct handler', function () {
      let done;
      const pending = new Promise((resolve) => { done = resolve; });
      sinon.stub(eventBus, 'clusterEventHandler').callsFake((worker, data) => {
        expect(data).to.have.property('type', 'event');
        expect(data).to.have.deep.property('args', ['arg1', 'arg2', 'arg3']);
        done();
      });

      const data = {type: 'event', args: ['arg1', 'arg2', 'arg3']};
      Master.onWorkerMessage.call({id: 1}, data);
      return pending.finally(() => eventBus.clusterEventHandler.restore());
    });

    it('should throw error with missing message type', function () {
      const data = 'fork_TestData';
      expect(Master.onWorkerMessage.bind({}, data)).not.to.throw();
    });

    it('should throw error with unknown message type', function () {
      const data = {type: 'Desbug', data: 'fork_TestData'};
      expect(Master.onWorkerMessage.bind({}, data)).not.to.throw();
    });
  });

  describe('logMasterDeath', function () {
    it('should return 2 with signal', function () {
      expect(Master.logMasterDeath(undefined, 'SAIGNAL')).to.equal(2);
    });

    it('should return 1 with no signal and a nonzero code', function () {
      expect(Master.logMasterDeath(1235, undefined)).to.equal(1);
    });

    it('should return 0 with success code', function () {
      expect(Master.logMasterDeath(0, undefined)).to.equal(0);
    });
  });

  describe('logWorkerDeath', function () {
    it('should return 2 with signal', function () {
      expect(Master.logWorkerDeath({id: 'ID1'}, undefined, 'SAIGNAL')).to.equal(2);
    });

    it('should return 1 with no signal and a nonzero code', function () {
      expect(Master.logWorkerDeath({id: 'ID2'}, 1235, undefined)).to.equal(1);
    });

    it('should return 0 with success code', function () {
      expect(Master.logWorkerDeath({id: 'ID3'}, 0, undefined)).to.equal(0);
    });
  });

  describe('handleSIGINT', function () {
    beforeEach(function () {
      Master.onExit = sinon.stub();
    });
    afterEach(function () {
      Master.onExit = undefined;
    });
    it('should kill all workers', function () {
      const worker1 = new EventEmitter();
      const worker2 = new EventEmitter();
      const worker3 = new EventEmitter();

      let killCalled1 = false;
      worker1.kill = () => {
        killCalled1 = true;
        worker1.emit('exit');
      };

      let killCalled2 = false;
      worker2.kill = () => {
        killCalled2 = true;
        worker2.emit('exit');
      };

      let killCalled3 = false;
      worker3.kill = () => {
        killCalled3 = true;
        worker3.emit('exit');
      };

      cluster.workers = {1: worker1, 2: worker2, 3: worker3};
      return Master.handleSIGINT()
        .then(() => {
          expect(killCalled1).to.equal(true,
            'Kill function should be called for worker 1.');
          expect(killCalled2).to.equal(true,
            'Kill function should be called for worker 2.');
          expect(killCalled3).to.equal(true,
            'Kill function should be called for worker 3.');

          expect(Master.onExit.calledOnce).to.equal(true,
            'Should call process.exit at some point.');
        });
    });
  });

  describe('handleWorkerExit', function () {
    it('should fork new worker when exit was not voluntary', function (done) {
      const worker = {
        process: {pid: 'PID'},
        exitedAfterDisconnect: false
      };
      Master.forkWorker = () => done();

      Master.handleWorkerExit(worker, 1, undefined);
    });

    it('should not fork new worker when exit is voluntary', function (done) {
      const worker = {
        process: {pid: 'PID'},
        exitedAfterDisconnect: true
      };

      Master.forkWorker = () => {
        done(new Error('Fork is not supposed to be called when exiting voluntarily.'));
      };

      Master.handleWorkerExit(worker, 1, 'SIGMOCK');
      done();
    });
  });

  describe('killWorker', function () {
    beforeEach(function () {
      Master.SIGINT_TIMEOUT = 100;
      Master.GIGTERM_TIMEOUT = 100;
      Master.SIGKILL_TIMEOUT = 100;
      return Promise.resolve();
    });

    const shouldReject = promise => new Promise((resolve, reject) => {
      promise
        .then(reject)
        .catch(resolve);
    });
    it('should kill worker when SIGINT success', function () {
      const worker = new EventEmitter();
      let killCalled = false;
      worker.kill = (signal) => {
        expect(signal).to.equal('SIGINT');
        killCalled = true;
        worker.emit('exit');
      };
      return Master.killWorker(worker)
        .then(() => { expect(killCalled).to.equal(true); });
    });
    it('should give second chance to kill worker with SIGTERM', function () {
      const worker = new EventEmitter();
      let killCalled = false;
      let iteration = 0;
      worker.kill = (signal) => {
        iteration += 1;
        if (iteration === 1) {
          expect(signal).to.equal('SIGINT');
        } else if (iteration === 2) {
          expect(signal).to.equal('SIGTERM');
          killCalled = true;
          worker.emit('exit');
        } else {
          throw new Error('should no go here.');
        }
      };
      return Master.killWorker(worker)
        .then(() => { expect(killCalled).to.equal(true); });
    });
    it('should give third chance to kill worker with SIGKILL', function () {
      const worker = new EventEmitter();
      let killCalled = false;
      let iteration = 0;
      worker.kill = (signal) => {
        iteration += 1;
        if (iteration === 1) {
          expect(signal).to.equal('SIGINT');
        } else if (iteration === 2) {
          expect(signal).to.equal('SIGTERM');
        } else if (iteration === 3) {
          expect(signal).to.equal('SIGKILL');
          killCalled = true;
          worker.emit('exit');
        } else {
          throw new Error('should no go here.');
        }
      };
      return Master.killWorker(worker)
        .then(() => { expect(killCalled).to.equal(true); });
    });
    it('should reject if cannot kill worker', function () {
      const worker = new EventEmitter();
      let killCalled = false;
      let iteration = 0;
      worker.kill = (signal) => {
        iteration += 1;
        if (iteration === 1) {
          expect(signal).to.equal('SIGINT');
        } else if (iteration === 2) {
          expect(signal).to.equal('SIGTERM');
        } else if (iteration === 3) {
          expect(signal).to.equal('SIGKILL');
          killCalled = true;
        } else {
          throw new Error('should no go here.');
        }
      };
      return shouldReject(Master.killWorker(worker)
        .catch((error) => {
          expect(killCalled).to.equal(true);
          throw error;
        }));
    });
    it('should catch kill exception', function () {
      const worker = new EventEmitter();
      worker.kill = () => {
        throw new Error('ohno');
      };
      return shouldReject(Master.killWorker(worker)
        .catch((error) => {
          expect(error.message).to.equal('ohno');
          throw error;
        }));
    });
  });

  describe('killAllWorkers', function () {
    it('should call kill for all workers defined in the cluster', function () {
      const workers = ['worker1', 'worker2', 'worker3'];

      let killCalled = 0;
      Master.killWorker = (worker) => {
        expect(worker).to.equal(workers[killCalled]);
        killCalled += 1;
        return Promise.resolve;
      };

      cluster.workers = workers;

      return Master.killAllWorkers()
        .then(() => { expect(killCalled).to.equal(3); });
    });
  });

  describe('reloadWorker', function () {
    it('should kill worker and fork a new one', function () {
      Master.forkWorker = () => Promise.resolve();

      const worker = new EventEmitter();

      let killCalled = false;
      worker.kill = (signal) => {
        expect(signal).to.equal('SIGINT');

        killCalled = true;
        worker.emit('exit');
      };

      return Master.reloadWorker(worker)
        .then(() => { expect(killCalled).to.equal(true); });
    });
  });

  describe('reloadAllWorkers', function () {
    it('should call reload for all workers defined in the cluster', function () {
      const workers = ['worker1', 'worker2', 'worker3'];

      let reloadCalled = 0;
      Master.reloadWorker = (worker) => {
        expect(worker).to.equal(workers[reloadCalled]);
        reloadCalled += 1;
        return Promise.resolve;
      };

      cluster.workers = workers;

      return Master.reloadAllWorkers()
        .then(() => { expect(reloadCalled).to.equal(3); });
    });
  });

  describe('createFileListener', function () {
    it('should return an object that provides emitter functionality', function (done) {
      const watcher = Master.createFileListener();
      expect(watcher).to.have.property('emit');
      expect(watcher).to.have.property('on');
      done();
    });
  });

  describe('activateFileListener', function () {
    it('should emit systemRestartNeeded when master file changed', function (done) {
      eventBus.on('workerRestartNeeded', () => { done(new Error('Should not restart workers.')); });
      eventBus.on('systemRestartNeeded', (meta, reason) => {
        expect(reason).to.equal(`file changed: ${path.join('app', 'master.js')}`);
        done();
      });

      const watcher = new EventEmitter();
      Master.activateFileListener(watcher);

      // Emit a change event
      watcher.emit('all', 'change', path.join('app', 'master.js'));
    });

    it('should emit workerRestartEvent when a worker file is edited', function (done) {
      eventBus.on('workerRestartNeeded', (meta, reason) => {
        expect(reason).to.equal('file changed: random-file.js');
        done();
      });
      eventBus.on('systemRestartNeeded', () => { done(new Error('Should not restart system')); });

      const watcher = new EventEmitter();
      Master.activateFileListener(watcher);

      // Emit a change event
      watcher.emit('all', 'change', 'random-file.js');
    });

    it('should not trigger restarts with unlistened events', function (done) {
      eventBus.on('workerRestartNeeded', () => { done(new Error('Should not restart workers.')); });
      eventBus.on('systemRestartNeeded', () => { done(new Error('Should not restart system')); });

      const watcher = new EventEmitter();
      Master.activateFileListener(watcher);

      // Emit a change event
      watcher.emit('all', 'chuaange', 'random-file.js');
      done();
    });
  });

  describe('deactivateFileListener', function () {
    it('should call removeAllListeners', function (done) {
      const watcher = {
        close: () => done()
      };

      Master.deactivateFileListener(watcher);
    });
  });
});
