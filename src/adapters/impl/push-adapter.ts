import PushService from '../../services/push-service';
import { FatalError, ISLAND } from '../../utils/error';
import ListenableAdapter from '../listenable-adapter';
import { AmqpChannelPoolAdapter } from './amqp-channel-pool-adapter';

export interface PushAdapterOptions {
  amqpChannelPoolAdapter: AmqpChannelPoolAdapter;
}

export default class PushAdapter extends ListenableAdapter<PushService, PushAdapterOptions> {
  async initialize(): Promise<void> {
    if (!this.options) throw new FatalError(ISLAND.ERROR.E0025_MISSING_ADAPTER_OPTIONS);
    this._adaptee = new PushService();
    const amqpChannelPoolService = this.options.amqpChannelPoolAdapter.adaptee;
    if (!amqpChannelPoolService) {
      throw new FatalError(ISLAND.ERROR.E0008_AMQP_CHANNEL_POOL_REQUIRED, 'AmqpChannelPoolService required');
    }
    await amqpChannelPoolService.waitForInit();
    return this._adaptee.initialize(amqpChannelPoolService);
  }

  listen(): Promise<void> {
    return Promise.resolve();
  }

  async destroy(): Promise<any> {
    await super.destroy();
    return this.adaptee.purge();
  }
}
