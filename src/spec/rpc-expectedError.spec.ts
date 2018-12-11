import * as Bluebird from 'bluebird';

import { AmqpChannelPoolService } from '../services/amqp-channel-pool-service';
import { RPCService } from '../services/rpc-service';
import { Environments } from '../utils/environments';
import { AbstractError, ExpectedError, FatalError, ISLAND } from '../utils/error';
import { jasmineAsyncAdapter as spec } from '../utils/jasmine-async-support';

// tslint:disable-next-line no-var-requires
const stdMocks = require('std-mocks');
async function mock(func): Promise<{ output?: any, errorObj?: AbstractError}> {
  let result: { output: string, errorObj: AbstractError };
  stdMocks.use();
  try {
    await func();
    return {};
  } catch (e) {
    result = {
      output: stdMocks.flush(),
      errorObj: e
    };
    stdMocks.restore();
  }
  return result;
}

Environments.refreshEnvForDebug();

describe('RPC(ExpectedError)', () => {
  const rpcService = new RPCService('hehe');
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

  it('rpc logs AbstractError', spec(async () => {
    await rpcService.register('testMethod', async msg => {
      expect(msg).toBe('hello');
      throw new FatalError(ISLAND.ERROR.E0035_PUSH_ENCODE_ERROR, 'FatalError');
    }, 'rpc');
    await rpcService.listen();
    const result = await mock(async () => {
      await rpcService.invoke<string, string>('testMethod', 'hello', { timeout: 1500 } );
    });
    await rpcService.unregisterAll();
    expect(result.errorObj).toBeDefined();
    expect(result.errorObj instanceof AbstractError).toBeTruthy();
    if (result.errorObj) {
      expect(result.errorObj.code).toEqual(10010035);
      expect(result.errorObj.name).toEqual('FatalError');
      expect(result.errorObj.extra.island).toBe('hehe');
      expect(result.errorObj.extra.rpcName).toBe('testMethod');
    }
    expect(result.output.stderr[0]).toBeDefined();
  }));

  it('rpc does not log ExpectedError', spec(async () => {
    await rpcService.register('testMethod', async msg => {
      expect(msg).toBe('hello');
      throw new ExpectedError(ISLAND.ERROR.E0035_PUSH_ENCODE_ERROR, 'ExpectedError');
    }, 'rpc');
    await rpcService.listen();
    const result = await mock(async () => {
      await rpcService.invoke<string, string>('testMethod', 'hello', { timeout: 1500 } );
    });
    await rpcService.unregisterAll();
    expect(result.errorObj instanceof AbstractError).toBeTruthy();
    expect(result.errorObj).toBeDefined();
    if (result.errorObj) {
      expect(result.errorObj.code).toEqual(10010035);
      expect(result.errorObj.name).toEqual('ExpectedError');
      expect(result.errorObj.extra.island).toBe('hehe');
      expect(result.errorObj.extra.rpcName).toBe('testMethod');
    }
    expect(result.output.stderr).toEqual([]);
  }));

});
