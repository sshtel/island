import MessageBrokerService from '../../services/message-broker-service';
import { FatalError, ISLAND } from '../../utils/error';
import RabbitMqAdapter from './rabbitmq-adapter';

export default class MessageBrokerAdapter extends RabbitMqAdapter<MessageBrokerService> {
  /**
   * @returns {Promise<void>}
   * @override
   */
  public async initialize() {
    await super.initialize();
    if (!this.options) throw new FatalError(ISLAND.ERROR.E0025_MISSING_ADAPTER_OPTIONS);
    this._adaptee = new MessageBrokerService(this.connection, this.options.serviceName || 'unknownService');
    return this._adaptee.initialize();
  }

  public listen(): Promise<void> {
    return this._adaptee.startConsume();
  }

  public async destroy() {
    await super.destroy();
    return this._adaptee.purge();
  }
}
