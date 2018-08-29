import { AmqpChannelPoolService, AmqpOptions } from '../../services/amqp-channel-pool-service';
import { FatalError, ISLAND } from '../../utils/error';
import AbstractAdapter from '../abstract-adapter';

export class AmqpChannelPoolAdapter extends AbstractAdapter<AmqpChannelPoolService, AmqpOptions> {
  initialize(): Promise<void> {
    if (!this.options) throw new FatalError(ISLAND.ERROR.E0025_MISSING_ADAPTER_OPTIONS);
    this._adaptee = new AmqpChannelPoolService();
    return this._adaptee.initialize(this.options);
  }

  async destroy(): Promise<void> {
    // TODO: should wait until other services stops using AmqpChannelPoolService
    return this._adaptee.purge();
  }
}
