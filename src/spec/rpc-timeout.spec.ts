import * as Bluebird from 'bluebird';

import { AmqpChannelPoolService } from '../services/amqp-channel-pool-service';
import { RpcResponse, RPCService } from '../services/rpc-service';
import { Environments } from '../utils/environments';
import { AbstractError, AbstractFatalError, FatalError, ISLAND } from '../utils/error';
import { jasmineAsyncAdapter as spec } from '../utils/jasmine-async-support';

Environments.refreshEnvForDebug();

describe('RpcResponse', () => {
  it('should handle malformed response', () => {
    const malformedJson = '{"result": true, "body": 1';
    expect(RpcResponse.decode(new Buffer(malformedJson))).toEqual({version: 0, result: false});
  });

  it('should understand an AbstractError object', () => {
    const error = new FatalError(ISLAND.ERROR.E0001_ISLET_ALREADY_HAS_BEEN_REGISTERED);
    const json = JSON.stringify({result: false, body: error});
    expect(RpcResponse.decode(new Buffer(json)).body).toEqual(jasmine.any(AbstractFatalError));
  });
});

describe('RPC(RPC timeout)', () => {
  const rpcService = new RPCService('haha');
  const amqpChannelPool = new AmqpChannelPoolService();
  const ISLAND_RPC_EXEC_TIMEOUT_MS = Environments.ISLAND_RPC_EXEC_TIMEOUT_MS;
  const ISLAND_RPC_MESSAGE_TTL_MS = Environments.ISLAND_RPC_MESSAGE_TTL_MS;
  const ISLAND_STATUS_EXPORT = Environments.ISLAND_STATUS_EXPORT;
  const ISLAND_STATUS_EXPORT_TIME_MS = Environments.ISLAND_STATUS_EXPORT_TIME_MS;
  const ISLAND_RPC_REPLY_MARGIN_TIME_MS = Environments.ISLAND_RPC_REPLY_MARGIN_TIME_MS;

  beforeAll(spec(async () => {
    Environments.ISLAND_RPC_EXEC_TIMEOUT_MS = 25000;
    Environments.ISLAND_RPC_MESSAGE_TTL_MS = 3000;
    Environments.ISLAND_STATUS_EXPORT = true;
    Environments.ISLAND_STATUS_EXPORT_TIME_MS = 3000;
    Environments.ISLAND_RPC_REPLY_MARGIN_TIME_MS = 1000;
  }));

  afterAll(spec(async () => {
    Environments.ISLAND_RPC_EXEC_TIMEOUT_MS = ISLAND_RPC_EXEC_TIMEOUT_MS;
    Environments.ISLAND_RPC_MESSAGE_TTL_MS = ISLAND_RPC_MESSAGE_TTL_MS;
    Environments.ISLAND_STATUS_EXPORT = ISLAND_STATUS_EXPORT;
    Environments.ISLAND_STATUS_EXPORT_TIME_MS = ISLAND_STATUS_EXPORT_TIME_MS;
    Environments.ISLAND_RPC_REPLY_MARGIN_TIME_MS = ISLAND_RPC_REPLY_MARGIN_TIME_MS;
  }));

  beforeEach(spec(async () => {
    const url = process.env.RABBITMQ_HOST || 'amqp://rabbitmq:5672';
    await amqpChannelPool.initialize({ url });
    await rpcService.initialize(amqpChannelPool);
  }));

  afterEach(spec(async () => {
    await rpcService.purge();
    await Bluebird.delay(100); // to have time to send ack
    await amqpChannelPool.purge();
  }));

  it('rpc timeout After ISLAND_RPC_EXEC_TIMEOUT_MS', spec(async () => {
    await rpcService.register('testMethod', async msg => {
      expect(msg).toBe('hello');
      await Bluebird.resolve().delay(1000);
      return Promise.resolve('world');
    }, 'rpc');
    await rpcService.listen();
    try {
      await rpcService.invoke<string, string>('testMethod', 'hello', { timeout: 1500 } );
      fail();
    } catch (e) {
      await rpcService.unregisterAll();
      expect(e instanceof AbstractError).toBeTruthy();
      expect(e.code).toEqual(10010023);
      expect(e.name).toEqual('FatalError');
      expect(e.extra.island).toBe('haha');
      expect(e.extra.rpcName).toBe('testMethod');
      expect(e.extra.parent).toBe('testMethod');
      expect(e.extra.location).toEqual('consume');
    }
  }));

  it('rpc timeout After ISLAND_RPC_EXEC_TIMEOUT_MS - ISLAND_RPC_REPLY_MARGIN_TIME_MS', spec(async () => {
    await rpcService.register('testMethod', async msg => {
      expect(msg).toBe('hello');
      await Bluebird.resolve().delay(600);
      return Promise.resolve('world');
    }, 'rpc');
    await rpcService.listen();
    try {
      await rpcService.invoke<string, string>('testMethod', 'hello', { timeout: 1500 } );
      fail();
    } catch (e) {
      await rpcService.unregisterAll();
      expect(e instanceof AbstractError).toBeTruthy();
      expect(e.code).toEqual(10010023);
      expect(e.name).toEqual('FatalError');
      expect(e.extra.island).toBe('haha');
      expect(e.extra.rpcName).toBe('testMethod');
      expect(e.extra.parent).toBe('testMethod');
      expect(e.extra.location).toEqual('consume');
    }
  }));

  it('rpc timeout before ISLAND_RPC_EXEC_TIMEOUT_MS - ISLAND_RPC_REPLY_MARGIN_TIME_MS', spec(async () => {
    await rpcService.register('testMethod', async msg => {
      expect(msg).toBe('hello');
      await Bluebird.resolve().delay(400);
      return Promise.resolve('world');
    }, 'rpc');
    await rpcService.listen();
    try {
      const res = await rpcService.invoke<string, string>('testMethod', 'hello', { timeout: 1500 } );
      expect(res).toEqual('world');
      await rpcService.unregisterAll();
    } catch (e) {
      fail();
    }
  }));

  it ('rpc timeout occurs in the place where it occurred (invoke) - 3 depth', spec(async () => {
    await rpcService.register('test', async msg => {
      expect(msg).toBe('hello');
      return Promise.resolve(rpcService.invoke<string, string>('depth0', msg));
    }, 'rpc');
    await rpcService.register('depth0', msg => {
      expect(msg).toBe('hello');
      return Promise.resolve(rpcService.invoke<string, string>('depth1', msg));
    }, 'rpc');
    await rpcService.register('depth1', msg => {
      expect(msg).toBe('hello');
      // throw error in invoke
      return Promise.resolve(rpcService.invoke<string, string>('depth2', msg));
    }, 'rpc');
    await rpcService.register('depth2', msg => {
      expect(msg).toBe('hello');
      return Promise.resolve(rpcService.invoke<string, string>('depth3', msg));
    }, 'rpc');
    await rpcService.register('depth3', msg => {
      expect(msg).toBe('hello');
      return Promise.resolve('world');
    }, 'rpc');
    await rpcService.listen();
    try {
      await rpcService.invoke<string, string>('test', 'hello', { timeout: 3900 } );
      fail();
    } catch (e) {
      await rpcService.unregisterAll();
      expect(e instanceof AbstractError).toBeTruthy();
      expect(e.code).toEqual(10010023);
      expect(e.name).toEqual('FatalError');
      expect(e.extra.island).toBe('haha');
      expect(e.extra.rpcName).toBe('depth2');
      expect(e.extra.parent).toBe('test');
      expect(e.extra.location).toEqual('invoke');
    }
  }));

  it ('rpc timeout occurs in the place where it occurred (invoke) - 4 depth', spec(async () => {
    await rpcService.register('test', async msg => {
      expect(msg).toBe('hello');
      return Promise.resolve(rpcService.invoke<string, string>('depth0', msg));
    }, 'rpc');
    await rpcService.register('depth0', msg => {
      expect(msg).toBe('hello');
      return Promise.resolve(rpcService.invoke<string, string>('depth1', msg));
    }, 'rpc');
    await rpcService.register('depth1', msg => {
      expect(msg).toBe('hello');
      return Promise.resolve(rpcService.invoke<string, string>('depth2', msg));
    }, 'rpc');
    await rpcService.register('depth2', msg => {
      expect(msg).toBe('hello');
      // throw error in invoke
      return Promise.resolve(rpcService.invoke<string, string>('depth3', msg));
    }, 'rpc');
    await rpcService.register('depth3', msg => {
      expect(msg).toBe('hello');
      return Promise.resolve('world');
    }, 'rpc');
    await rpcService.listen();
    try {
      await rpcService.invoke<string, string>('test', 'hello', { timeout: 4900 } );
      fail();
    } catch (e) {
      await rpcService.unregisterAll();
      expect(e instanceof AbstractError).toBeTruthy();
      expect(e.code).toEqual(10010023);
      expect(e.name).toEqual('FatalError');
      expect(e.extra.island).toBe('haha');
      expect(e.extra.rpcName).toBe('depth3');
      expect(e.extra.parent).toBe('test');
      expect(e.extra.location).toEqual('invoke');
    }
  }));

  it ('rpc timeout occurs in the place where it occurred (invoke) - 5 depth', spec(async () => {
    await rpcService.register('test', async msg => {
      expect(msg).toBe('hello');
      return Promise.resolve(rpcService.invoke<string, string>('depth0', msg));
    }, 'rpc');
    await rpcService.register('depth0', msg => {
      expect(msg).toBe('hello');
      return Promise.resolve(rpcService.invoke<string, string>('depth1', msg));
    }, 'rpc');
    await rpcService.register('depth1', msg => {
      expect(msg).toBe('hello');
      return Promise.resolve(rpcService.invoke<string, string>('depth2', msg));
    }, 'rpc');
    await rpcService.register('depth2', async msg => {
      expect(msg).toBe('hello');
      // throw error this
      return Promise.resolve(rpcService.invoke<string, string>('depth3', msg));
    }, 'rpc');
    await rpcService.register('depth3', msg => {
      expect(msg).toBe('hello');
      return Promise.resolve('world');
    }, 'rpc');
    await rpcService.listen();
    try {
      await rpcService.invoke<string, string>('test', 'hello', { timeout: 4900 } );
      fail();
    } catch (e) {
      await rpcService.unregisterAll();
      expect(e instanceof AbstractError).toBeTruthy();
      expect(e.code).toEqual(10010023);
      expect(e.name).toEqual('FatalError');
      expect(e.extra.island).toBe('haha');
      expect(e.extra.rpcName).toBe('depth3');
      expect(e.extra.parent).toBe('test');
      expect(e.extra.location).toBe('invoke');
    }
  }));

  it ('rpc timeout occurs in the place where it occurred (consume) - 3 depth', spec(async () => {
    await rpcService.register('test', async msg => {
      expect(msg).toBe('hello');
      return Promise.resolve(rpcService.invoke<string, string>('depth0', msg));
    }, 'rpc');
    await rpcService.register('depth0', msg => {
      expect(msg).toBe('hello');
      return Promise.resolve(rpcService.invoke<string, string>('depth1', msg));
    }, 'rpc');
    await rpcService.register('depth1', async msg => {
      expect(msg).toBe('hello');
      // throw error in this
      await Bluebird.resolve().delay(900);
      return Promise.resolve(rpcService.invoke<string, string>('depth2', msg));
    }, 'rpc');
    await rpcService.register('depth2', msg => {
      expect(msg).toBe('hello');
      return Promise.resolve(rpcService.invoke<string, string>('depth3', msg));
    }, 'rpc');
    await rpcService.register('depth3', msg => {
      expect(msg).toBe('hello');
      return Promise.resolve('world');
    }, 'rpc');
    await rpcService.listen();
    try {
      await rpcService.invoke<string, string>('test', 'hello', { timeout: 3900 } );
      fail();
    } catch (e) {
      await rpcService.unregisterAll();
      expect(e instanceof AbstractError).toBeTruthy();
      expect(e.code).toEqual(10010023);
      expect(e.name).toEqual('FatalError');
      expect(e.extra.island).toBe('haha');
      expect(e.extra.rpcName).toBe('depth1');
      expect(e.extra.parent).toBe('test');
      expect(e.extra.location).toEqual('consume');
    }
  }));

  it ('rpc timeout occurs in the place where it occurred (consume) - 4 depth', spec(async () => {
    await rpcService.register('test', msg => {
      expect(msg).toBe('hello');
      return Promise.resolve(rpcService.invoke<string, string>('depth0', msg));
    }, 'rpc');
    await rpcService.register('depth0', msg => {
      expect(msg).toBe('hello');
      return Promise.resolve(rpcService.invoke<string, string>('depth1', msg));
    }, 'rpc');
    await rpcService.register('depth1', msg => {
      expect(msg).toBe('hello');
      return Promise.resolve(rpcService.invoke<string, string>('depth2', msg));
    }, 'rpc');
    await rpcService.register('depth2', async msg => {
      expect(msg).toBe('hello');
      // throw error in this
      await Bluebird.resolve().delay(900);
      return Promise.resolve(rpcService.invoke<string, string>('depth3', msg));
    }, 'rpc');
    await rpcService.register('depth3', msg => {
      expect(msg).toBe('hello');
      return Promise.resolve('world');
    }, 'rpc');
    await rpcService.listen();
    try {
      await rpcService.invoke<string, string>('test', 'hello', { timeout: 4900 } );
      fail();
    } catch (e) {
      await rpcService.unregisterAll();
      expect(e instanceof AbstractError).toBeTruthy();
      expect(e.code).toEqual(10010023);
      expect(e.name).toEqual('FatalError');
      expect(e.extra.island).toBe('haha');
      expect(e.extra.rpcName).toBe('depth2');
      expect(e.extra.parent).toBe('test');
      expect(e.extra.location).toEqual('consume');
    }
  }));

  it ('replay wait time is recovered, when invoke is complete.', spec(async () => {
    await rpcService.register('test', async msg => {
      expect(msg).toBe('hello');
      await Promise.resolve(rpcService.invoke<string, string>('rpc1', msg));
      await Promise.resolve(rpcService.invoke<string, string>('rpc2', msg));
      return Promise.resolve(rpcService.invoke<string, string>('rpc3', msg));
    }, 'rpc');
    await rpcService.register('rpc1', msg => {
      expect(msg).toBe('hello');
      return Promise.resolve(rpcService.invoke<string, string>('rpc1-1', msg));
    }, 'rpc');
    await rpcService.register('rpc1-1', msg => {
      expect(msg).toBe('hello');
      return Promise.resolve('rpc1 hello');
    }, 'rpc');
    await rpcService.register('rpc2', msg => {
      expect(msg).toBe('hello');
      return Promise.resolve(rpcService.invoke<string, string>('rpc2-1', msg));
    }, 'rpc');
    await rpcService.register('rpc2-1', msg => {
      expect(msg).toBe('hello');
      return Promise.resolve('rpc2 hello');
    }, 'rpc');
    await rpcService.register('rpc3', msg => {
      expect(msg).toBe('hello');
      return Promise.resolve('world');
    }, 'rpc');
    await rpcService.listen();
    try {
      const res = await rpcService.invoke<string, string>('test', 'hello', { timeout: 3900 } );
      expect(res).toEqual('world');
      await rpcService.unregisterAll();
    } catch (e) {
      fail();
    }
  }));

  it ('reply wait time is recovered, when invoke is complete. - timeout case', spec(async () => {
    await rpcService.register('test', async msg => {
      expect(msg).toBe('hello');
      const res1 = await Promise.resolve(rpcService.invoke<string, string>('rpc1', msg));
      expect(res1).toBe('rpc1 hello');
      await Promise.resolve(rpcService.invoke<string, string>('rpc2', msg));
      return Promise.resolve(rpcService.invoke<string, string>('rpc3', msg));
    }, 'rpc');
    await rpcService.register('rpc1', msg => {
      expect(msg).toBe('hello');
      return Promise.resolve('rpc1 hello');
    }, 'rpc');
    await rpcService.register('rpc2', async msg => {
      return Promise.resolve(rpcService.invoke<string, string>('rpc2-1', msg));
    }, 'rpc');
    await rpcService.register('rpc2-1', async msg => {
      return Promise.resolve(rpcService.invoke<string, string>('rpc2-2', msg));
    }, 'rpc');
    await rpcService.register('rpc2-2', async msg => {
      expect(msg).toBe('hello');
      await Bluebird.resolve().delay(900);
      return Promise.resolve('rpc2 hello');
    }, 'rpc');
    await rpcService.register('rpc3', msg => {
      expect(msg).toBe('hello');
      return Promise.resolve('world');
    }, 'rpc');
    await rpcService.listen();
    try {
      await rpcService.invoke<string, string>('test', 'hello', { timeout: 4900 } );
      fail();
    } catch (e) {
      await rpcService.unregisterAll();
      expect(e instanceof AbstractError).toBeTruthy();
      expect(e.code).toEqual(10010023);
      expect(e.name).toEqual('FatalError');
      expect(e.extra.island).toBe('haha');
      expect(e.extra.rpcName).toBe('rpc2-2');
      expect(e.extra.parent).toBe('test');
      expect(e.extra.location).toEqual('consume');
    }
  }));

  it ('Small values ​​are used - child', spec(async () => {
    await rpcService.register('test', async msg => {
      expect(msg).toBe('hello');
      const res1 = await Promise.resolve(rpcService.invoke<string, string>('rpc1', msg));
      expect(res1).toBe('rpc1 hello');
      await Promise.resolve(rpcService.invoke<string, string>('rpc2', msg, {timeout: 1500}));
      return Promise.resolve(rpcService.invoke<string, string>('rpc3', msg));
    }, 'rpc');
    await rpcService.register('rpc1', msg => {
      expect(msg).toBe('hello');
      return Promise.resolve('rpc1 hello');
    }, 'rpc');
    await rpcService.register('rpc2', async msg => {
      await Bluebird.resolve().delay(900);
      return Promise.resolve('rpc2 hello');
    }, 'rpc');
    await rpcService.register('rpc3', msg => {
      expect(msg).toBe('hello');
      return Promise.resolve('world');
    }, 'rpc');
    await rpcService.listen();
    try {
      await rpcService.invoke<string, string>('test', 'hello', { timeout: 10000 } );
      fail();
    } catch (e) {
      await rpcService.unregisterAll();
      expect(e instanceof AbstractError).toBeTruthy();
      expect(e.code).toEqual(10010023);
      expect(e.name).toEqual('FatalError');
      expect(e.extra.island).toBe('haha');
      expect(e.extra.rpcName).toBe('rpc2');
      expect(e.extra.parent).toBe('test');
      expect(e.extra.location).toEqual('consume');
    }
  }));

  it ('Small values ​​are used - parent', spec(async () => {
    await rpcService.register('test', async msg => {
      expect(msg).toBe('hello');
      const res1 = await Promise.resolve(rpcService.invoke<string, string>('rpc1', msg));
      expect(res1).toBe('rpc1 hello');
      await Promise.resolve(rpcService.invoke<string, string>('rpc2', msg, {timeout: 10000}));
      return Promise.resolve(rpcService.invoke<string, string>('rpc3', msg));
    }, 'rpc');
    await rpcService.register('rpc1', msg => {
      expect(msg).toBe('hello');
      return Promise.resolve('rpc1 hello');
    }, 'rpc');
    await rpcService.register('rpc2', async msg => {
      await Bluebird.resolve().delay(1000);
      return Promise.resolve('rpc2 hello');
    }, 'rpc');
    await rpcService.register('rpc3', msg => {
      expect(msg).toBe('hello');
      return Promise.resolve('world');
    }, 'rpc');
    await rpcService.listen();
    try {
      await rpcService.invoke<string, string>('test', 'hello', { timeout: 3000 } );
      fail();
    } catch (e) {
      await rpcService.unregisterAll();
      expect(e instanceof AbstractError).toBeTruthy();
      expect(e.code).toEqual(10010023);
      expect(e.name).toEqual('FatalError');
      expect(e.extra.island).toBe('haha');
      expect(e.extra.rpcName).toBe('rpc2');
      expect(e.extra.parent).toBe('test');
      expect(e.extra.location).toEqual('consume');
    }
  }));
});
