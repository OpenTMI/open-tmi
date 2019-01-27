const {expect} = require('chai');

const {
  calcStatistics,
  calcUtilization
} = require('../../../app/tools/utilization');

describe('tools/utilization.js', () => {
  // Run this before tests
  describe('statistics', () => {
    it('allocations', () => {
      const events = [
        {cre: {time: new Date('1995-12-17T00:00:00Z')}, msgid: 'ALLOCATED'},
        {cre: {time: new Date('1995-12-17T00:00:01Z')}, msgid: 'RELEASED'},
        {cre: {time: new Date('1995-12-18T00:00:00Z')}, msgid: 'ALLOCATED'},
        {cre: {time: new Date('1995-12-18T00:00:02Z')}, msgid: 'RELEASED'}
      ];
      return calcStatistics(events)
        .then((stats) => {
          expect(stats.summary.allocations.count).to.be.equal(2);
          expect(stats.summary.allocations.time).to.be.equal(3);
          expect(stats.dates['1995-12-17'].allocations.count).to.be.equal(1);
          expect(stats.dates['1995-12-17'].allocations.time).to.be.equal(1);
          expect(stats.dates['1995-12-18'].allocations.count).to.be.equal(1);
          expect(stats.dates['1995-12-18'].allocations.time).to.be.equal(2);
        });
    });
    it('allocations middle', () => {
      const events = [
        {cre: {time: new Date('1995-12-17T00:00:01Z')}, msgid: 'RELEASED'},
        {cre: {time: new Date('1995-12-18T00:00:00Z')}, msgid: 'ALLOCATED'},
        {cre: {time: new Date('1995-12-18T00:00:02Z')}, msgid: 'RELEASED'}
      ];
      return calcStatistics(events)
        .then((stats) => {
          expect(stats.summary.allocations.count).to.be.equal(1);
          expect(stats.summary.allocations.time).to.be.equal(2);
          expect(stats.dates['1995-12-17'].allocations.count).to.be.equal(0);
          expect(stats.dates['1995-12-17'].allocations.time).to.be.equal(0);
          expect(stats.dates['1995-12-18'].allocations.count).to.be.equal(1);
          expect(stats.dates['1995-12-18'].allocations.time).to.be.equal(2);
        });
    });
    it('allocations overday', () => {
      // / @todo this is not handled properly!
      // it calculate allocation time now for 18's day even it slips to 19's.
      const events = [
        {cre: {time: new Date('1995-12-18T23:59:00Z')}, msgid: 'ALLOCATED'},
        {cre: {time: new Date('1995-12-19T00:01:00Z')}, msgid: 'RELEASED'}
      ];
      return calcStatistics(events)
        .then((stats) => {
          expect(stats.summary.allocations.count).to.be.equal(1);
          expect(stats.summary.allocations.time).to.be.equal(120);
          expect(stats.dates['1995-12-18'].allocations.count).to.be.equal(1);
          expect(stats.dates['1995-12-18'].allocations.time).to.be.equal(120);
        });
    });
    it('maintenances', () => {
      const events = [
        {cre: {time: new Date('1995-12-17T00:00:00Z')}, msgid: 'ENTER_MAINTENANCE'},
        {cre: {time: new Date('1995-12-17T00:00:01Z')}, msgid: 'EXIT_MAINTENANCE'},
        {cre: {time: new Date('1995-12-18T00:00:00Z')}, msgid: 'ENTER_MAINTENANCE'},
        {cre: {time: new Date('1995-12-18T00:00:02Z')}, msgid: 'EXIT_MAINTENANCE'}
      ];
      return calcStatistics(events)
        .then((stats) => {
          expect(stats.summary.maintenance.count).to.be.equal(2);
          expect(stats.summary.maintenance.time).to.be.equal(3);
          expect(stats.dates['1995-12-17'].maintenance.count).to.be.equal(1);
          expect(stats.dates['1995-12-17'].maintenance.time).to.be.equal(1);
          expect(stats.dates['1995-12-18'].maintenance.count).to.be.equal(1);
          expect(stats.dates['1995-12-18'].maintenance.time).to.be.equal(2);
        });
    });
    it('flashes', () => {
      const events = [
        {cre: {time: new Date('1995-12-17T00:00:00Z')}, msgid: 'FLASHED'},
        {cre: {time: new Date('1995-12-18T00:00:00Z')}, msgid: 'FLASHED', priority: {level: 'err'}}
      ];
      return calcStatistics(events)
        .then((stats) => {
          expect(stats.summary.flashed.count).to.be.equal(2);
          expect(stats.dates['1995-12-17'].flashed.count).to.be.equal(1);
          expect(stats.dates['1995-12-18'].flashed.count).to.be.equal(1);
          expect(stats.dates['1995-12-18'].flashed.failCount).to.be.equal(1);
        });
    });
  });
  describe('utilization', () => {
    it('usage utilization', () => {
      const events = [
        {cre: {time: new Date('1995-12-17T00:00:00Z')}, msgid: 'ALLOCATED'},
        {cre: {time: new Date('1995-12-17T23:00:00Z')}, msgid: 'RELEASED'},
        {cre: {time: new Date('1995-12-18T00:00:00Z')}, msgid: 'FLASHED'}
      ];
      return calcUtilization(events)
        .then((stats) => {
          const utilization = 96;
          expect(Math.round(stats.summary.allocations.utilization)).to.be.equal(utilization);
          expect(Math.round(stats.dates['1995-12-17'].allocations.utilization)).to.be.equal(utilization);
        });
    });
  });
});
