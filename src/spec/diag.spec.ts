import * as Bluebird from 'bluebird';
import * as fs from 'fs';

import { AmqpChannelPoolService } from '../services/amqp-channel-pool-service';
import { EventHookType, EventService } from '../services/event-service';
import { getProc, readResponse, sendToQueue } from '../utils/diag';
import { Environments } from '../utils/environments';
import { jasmineAsyncAdapter as spec } from '../utils/jasmine-async-support';

describe('EventService status', () => {
  it('should be changed by each step', spec(async () => {
    const amqpChannelPool = new AmqpChannelPoolService();
    const eventService = new EventService('diag-status-spec');
    expect(getProc().status).toBe('initializing');

    await amqpChannelPool.initialize({ url: Environments.ISLAND_RABBITMQ_HOST });
    await eventService.initialize(amqpChannelPool);
    expect(getProc().status).toBe('initialized');

    await eventService.startConsume();
    expect(getProc().status).toBe('started');

    await eventService.purge();
    expect(getProc().status).toBe('stopped');

    await Bluebird.delay(100);
    await amqpChannelPool.purge();
  }));
});

describe('Diag', () => {
  const amqpChannelPool = new AmqpChannelPoolService();
  const eventService = new EventService('diag-diag-spec');

  beforeEach(spec(async () => {
    try {
      await amqpChannelPool.initialize({ url: Environments.ISLAND_RABBITMQ_HOST });
      await eventService.initialize(amqpChannelPool);
      await eventService.startConsume();
    } catch (e) {
      console.error(e);
    }
  }));

  afterEach(spec(async () => {
    try {
      await eventService.purge();
      await Bluebird.delay(100);
      await amqpChannelPool.purge();
      if (fs.existsSync('./haha.txt')) {
        fs.unlinkSync('./haha.txt');
      }
    } catch (e) {
      console.error(e);
    }
  }));

  it('could get proc information', spec(async () => {
    const proc = getProc();
    expect(proc.status).toBe('started');
    expect(proc.queue).toBeDefined();
  }));

  it('could get a message from a diag', spec(async () => {
    const proc = getProc();
    const p = new Promise<void>(res => {
      eventService.registerHook(EventHookType.EVENT, async msg => {
        expect(msg.haha).toBe('haha');
        res();
      });
    });
    await amqpChannelPool.usingChannel(async chan => {
      await sendToQueue(chan, proc.queue, { haha: 'haha' });
    });
    return p;
  }));

  it('should pong by ping', spec(async () => {
    const fileName = 'haha.txt';
    fs.writeFileSync(fileName, '');
    const proc = getProc();
    await amqpChannelPool.usingChannel(async chan => {
      await sendToQueue(chan, proc.queue, { fileName, args: ['ping'] });
    });
    const res = await readResponse(fileName);
    expect(res.message).toBe('pong');
  }));

  it('could get current status', spec(async () => {
    const fileName = 'haha.txt';
    fs.writeFileSync(fileName, '');
    const proc = getProc();
    await amqpChannelPool.usingChannel(async chan => {
      await sendToQueue(chan, proc.queue, { fileName, args: ['status'] });
    });
    const res = await readResponse(fileName);
    expect(() => {
      JSON.parse(res.message);
    }).not.toThrow();
    const body = JSON.parse(res.message);
    expect(body.measurements.filter(i => i.type === 'event@system.diagnosis').length).toBe(1);
  }));
});
