import * as Bluebird from 'bluebird';
import * as fs from 'fs';

import { validate } from '../controllers/endpoint-decorator';
import { AmqpChannelPoolService } from '../services/amqp-channel-pool-service';
import { EventHookType, EventService } from '../services/event-service';
import { RPCService } from '../services/rpc-service';
import { diagRpc, DiagRpcArgs, diagRpcSub, getProc, parseRpcList, readResponse, sendToQueue } from '../utils/diag';
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

describe('Event Diag', () => {
  const amqpChannelPool = new AmqpChannelPoolService();
  const eventService = new EventService('diag-event-diag-spec');

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

describe('RPC Diag', () => {
  let amqpChannelPool;
  let rpcService: RPCService;
  const fileName = 'haha.txt';
  const oldTimeout = Environments.ISLAND_RPC_WAIT_TIMEOUT_MS;

  beforeAll(spec(async () => {
    Environments.ISLAND_RPC_WAIT_TIMEOUT_MS = 600;
  }));

  afterAll(spec(async () => {
    Environments.ISLAND_RPC_WAIT_TIMEOUT_MS = oldTimeout;
  }));

  beforeEach(spec(async () => {
    try {
      amqpChannelPool = new AmqpChannelPoolService();
      rpcService = new RPCService('diag-rpc-diag-spec');
      await amqpChannelPool.initialize({ url: Environments.ISLAND_RABBITMQ_HOST });
      await rpcService.initialize(amqpChannelPool);
    } catch (e) {
      console.error(e);
    }
  }));

  afterEach(spec(async () => {
    try {
      await rpcService.purge();
      await Bluebird.delay(100);
      await amqpChannelPool.purge();
      if (fs.existsSync('./' + fileName)) {
        fs.unlinkSync('./' + fileName);
      }
    } catch (e) {
      console.error(e);
    }
  }));

  async function callRpc(rpcName, args?: DiagRpcArgs) {
    await rpcService.listen();
    fs.writeFileSync(fileName, '');
    await amqpChannelPool.usingChannel(async chan => {
      await diagRpc(chan, getProc('rpc').queue, fileName, rpcName, args);
    });
    return readResponse(fileName);
  }

  function throwError(message: string) {
    throw new Error(message);
  }

  it('could get proc information', spec(async () => {
    await rpcService.listen();
    const proc = getProc('rpc');
    expect(proc.status).toBe('started');
    expect(proc.queue).toBeDefined();
  }));

  function registerRpc(rpcName: string, func?: (req) => Promise<any>, validation?: {[key: string]: any}) {
    return rpcService.register(rpcName.toUpperCase(), func || (async req => 'success'), 'rpc', {
      schema: {
        query: {
          sanitization: {},
          validation: validation || {}
        }
      }
    });
  }

  it('could invoke a RPC', spec(async () => {
    const rpcName = 'testDiag';
    await registerRpc(rpcName);
    expect((await callRpc(rpcName.toUpperCase())).message).toEqual(JSON.stringify('success'));
  }));

  it('could invoke a RPC have validation', spec(async () => {
    const rpcName = 'testWithUnary';
    await registerRpc(rpcName, undefined, validate.validate({ sid: String }));
    const response = await callRpc(rpcName.toUpperCase(), { plainQuery: '{"sid":"asdf"}', opts: { stack: true }});
    expect(response.message).toBe(JSON.stringify('success'));
  }));

  it('should handle an error', spec(async () => {
    const rpcName = 'throwError';
    await registerRpc(rpcName, async req => throwError('error'));
    expect(JSON.parse((await callRpc(rpcName.toUpperCase())).error).message).toEqual('10020001-error');
  }));

  it('should handle an error with a stack', spec(async () => {
    const rpcName = 'throwError2';
    await registerRpc(rpcName, async req => throwError('error'));
    expect(JSON.parse((await callRpc(rpcName.toUpperCase(), {opts: {stack: true}})).error).stack).toBeDefined();
  }));

  it('should validate a RPC query', spec(async () => {
    const rpcName = 'testWithUnary';
    await registerRpc(rpcName, async req => 'a', validate.validate({ sid: String }));
    const response = await callRpc(rpcName.toUpperCase());
    expect(response.error).toMatch(/.*Wrong parameter schema.*/);
  }));

  it('should fetch registered RPCs', spec(async () => {
    const rpcName = 'testWithUnary';
    await registerRpc(rpcName, async req => throwError('error'), validate.validate({ sid: String }));
    await rpcService.listen();
    fs.writeFileSync(fileName, '');
    await amqpChannelPool.usingChannel(async chan => {
      await diagRpcSub(chan, getProc('rpc').queue, fileName, 'list');
    });
    const response = await readResponse(fileName);
    expect(response.message).toBe(JSON.stringify({
      TESTWITHUNARY: {
        type: 'rpc',
        rpcOptions: {
          schema: {
            query: {
              sanitization: {},
              validation: {
                properties: {
                  sid: {optional: false, type: 'string'}},
                type: 'object'
              }
            }
          }
        }
      }
    }));
  }));

  it('should block an unknown RPC', spec(async () => {
    const response = await callRpc('unknownRPC');
    expect(JSON.parse(response.error).message).toEqual('no such RPC - unknownRPC');
  }));

  it('should not block an unknown RPC with remote = true', spec(async () => {
    const response = await callRpc('unknownRPC', {opts: {remote: true}});
    expect(response.error).toMatch(/.*does not return in.*/);
  }));
});

describe('Diag rpc:list', () => {
  let amqpChannelPool;
  let rpcService: RPCService;
  const fileName = 'haha.txt';

  beforeEach(spec(async () => {
    try {
      amqpChannelPool = new AmqpChannelPoolService();
      rpcService = new RPCService('diag-rpc-list-spec');
      await amqpChannelPool.initialize({ url: Environments.ISLAND_RABBITMQ_HOST });
      await rpcService.initialize(amqpChannelPool);
    } catch (e) {
      console.error(e);
    }
  }));

  afterEach(spec(async () => {
    try {
      await rpcService.purge();
      await Bluebird.delay(100);
      await amqpChannelPool.purge();
      if (fs.existsSync('./' + fileName)) {
        fs.unlinkSync('./' + fileName);
      }
    } catch (e) {
      console.error(e);
    }
  }));

  async function listRpc() {
    await rpcService.listen();
    fs.writeFileSync(fileName, '');
    await amqpChannelPool.usingChannel(async chan => {
      await diagRpcSub(chan, getProc('rpc').queue, fileName, 'list');
    });
    return parseRpcList(await readResponse(fileName));
  }

  async function registerRpc(name, validation?) {
    return rpcService.register(name, async req => req.query, 'rpc', {
      schema: { query: { sanitization: {}, validation } }
    });
  }

  it('should summarize them', spec(async () => {
    const rpcName = 'testDiag';
    await registerRpc(rpcName);
    expect(await listRpc()).toEqual([rpcName.toUpperCase()]);
  }));

  it('should summarize them with validate', spec(async () => {
    const rpcName = 'testWithQuery';
    await registerRpc(rpcName, validate.validate(String));
    expect(await listRpc()).toEqual([`${rpcName.toUpperCase()} - string`]);
  }));

  it('should summarize them with object validate', spec(async () => {
    const rpcNameUnary = 'testWithUnary';
    const rpcNameBUnary = 'testWithBUnary';
    await registerRpc(rpcNameUnary, validate.validate({ sid: String }));
    await registerRpc(rpcNameBUnary, validate.validate({ aid: String, sid: String }));
    expect(await listRpc()).toEqual([
      `${rpcNameUnary.toUpperCase()} - sid:string`,
      `${rpcNameBUnary.toUpperCase()} - aid:string, sid:string`
    ]);
  }));
});
