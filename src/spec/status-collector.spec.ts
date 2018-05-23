process.env.STATUS_EXPORT_TYPE = 'FILE';

import { collector } from '../index';

describe('Status Collector', () => {
  const type = 'test';
  it('collect', done => {
    const requestId = collector.collectRequestAndReceivedTime(type, 'name', { ignoreTimestamp: false });
    expect(collector.getOnGoingRequestCount(type)).toEqual(1);
    const requestId2 = collector.collectRequestAndReceivedTime(type, 'name', { ignoreTimestamp: false });
    expect(collector.getOnGoingRequestCount(type)).toEqual(2);
    expect(collector.hasOngoingRequests()).toEqual(true);
    collector.collectExecutedCountAndExecutedTime(type, 'name', { requestId });
    expect(collector.getOnGoingRequestCount(type)).toEqual(1);
    collector.collectExecutedCountAndExecutedTime(type, 'name', { requestId: requestId2 });
    expect(collector.getOnGoingRequestCount(type)).toEqual(0);
    expect(collector.hasOngoingRequests()).toEqual(false);
    done();
  });

  xit('saveStatus does not affect collect status', done => {
    collector.saveStatus();
    const requestId = collector.collectRequestAndReceivedTime(type, 'name', { ignoreTimestamp: false });
    expect(collector.getOnGoingRequestCount(type)).toEqual(1);
    const requestId2 = collector.collectRequestAndReceivedTime(type, 'name', { ignoreTimestamp: false });
    expect(collector.getOnGoingRequestCount(type)).toEqual(2);
    expect(collector.hasOngoingRequests()).toEqual(true);
    collector.collectExecutedCountAndExecutedTime(type, 'name', { requestId });
    expect(collector.getOnGoingRequestCount(type)).toEqual(1);
    collector.collectExecutedCountAndExecutedTime(type, 'name', { requestId: requestId2 });
    expect(collector.getOnGoingRequestCount(type)).toEqual(0);
    expect(collector.hasOngoingRequests()).toEqual(false);
    done();
  });

  afterAll(async done => {
    done();
  });
});
