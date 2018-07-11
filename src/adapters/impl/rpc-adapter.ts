import { RpcHook, RpcHookType, RPCService } from '../../services/rpc-service';
import { FatalError, ISLAND } from '../../utils/error';
import ListenableAdapter from '../listenable-adapter';
import { AmqpChannelPoolAdapter } from './amqp-channel-pool-adapter';

export interface RPCAdapterOptions {
  amqpChannelPoolAdapter: AmqpChannelPoolAdapter;
  consumerAmqpChannelPoolAdapter?: AmqpChannelPoolAdapter;
  serviceName: string;
  useReviver?: boolean;
}

export default class RPCAdapter extends ListenableAdapter<RPCService, RPCAdapterOptions> {
  hooks: {type: RpcHookType, hook: RpcHook}[];
  constructor(options) {
    super(options);
    this.hooks = [];
  }
  async initialize(): Promise<void> {
    if (!this.options) throw new FatalError(ISLAND.FATAL.F0025_MISSING_ADAPTER_OPTIONS);
    this._adaptee = new RPCService(this.options.serviceName || 'unknownService');
    const amqpChannelPoolService = this.options.amqpChannelPoolAdapter.adaptee;
    if (!amqpChannelPoolService) {
      throw new FatalError(ISLAND.FATAL.F0008_AMQP_CHANNEL_POOL_REQUIRED, 'AmqpChannelPoolService required');
    }
    const { consumerAmqpChannelPoolAdapter } = this.options;
    const consumerChannelPool = consumerAmqpChannelPoolAdapter && consumerAmqpChannelPoolAdapter.adaptee;
    await amqpChannelPoolService.waitForInit();
    if (consumerChannelPool) {
      await consumerChannelPool.waitForInit();
    }
    this.hooks.forEach(hook => {
      this._adaptee.registerHook(hook.type, hook.hook);
    });
    return this._adaptee.initialize(amqpChannelPoolService, {
      useReviver: this.options.useReviver,
      consumerAmqpChannelPool: consumerChannelPool
    });
  }

  listen(): Promise<void> {
    return this._adaptee.listen();
  }

  async destroy(): Promise<any> {
    await super.destroy();
    return this.adaptee.purge();
  }

  registerHook(type: RpcHookType, hook: RpcHook) {
    this.hooks.push({type, hook});
  }

  async sigInfo(): Promise<void> {
    await this.adaptee.sigInfo();
  }
}
