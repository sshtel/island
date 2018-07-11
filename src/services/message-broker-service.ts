import * as amqp from 'amqplib';
import * as Bluebird from 'bluebird';
import deprecated from 'deprecated-decorator';
import * as _ from 'lodash';
import * as uuid from 'uuid';

import { FatalError, ISLAND, LogicError } from '../utils/error';
import { logger } from '../utils/logger';
import reviver from '../utils/reviver';
import AbstractBrokerService, { IConsumerInfo } from './abstract-broker-service';

@deprecated()
export default class MessageBrokerService extends AbstractBrokerService {
  private static EXCHANGE_NAME: string = 'MESSAGE_BROKER_EXCHANGE';
  private roundRobinEventQ: string;
  private fanoutEventQ: string;
  private consumerInfos: IConsumerInfo[] = [];
  private handlers: { [pattern: string]: Handler } = {};

  constructor(connection: amqp.Connection, serviceName: string) {
    super(connection);
    this.roundRobinEventQ = serviceName;
    this.fanoutEventQ = `event.${serviceName}.${uuid.v4()}`;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (!this.roundRobinEventQ) {
      throw new FatalError(ISLAND.FATAL.F0012_ROUND_ROBIN_EVENT_Q_IS_NOT_DEFINED, 'roundRobinEventQ is not defined');
    }

    await this.declareExchange(MessageBrokerService.EXCHANGE_NAME, 'topic', { durable: true });
    await this.declareQueue(this.roundRobinEventQ, { durable: true, exclusive: false });
    await this.declareQueue(this.fanoutEventQ, { exclusive: true, autoDelete: true });

    this.initialized = true;
  }

  async startConsume(): Promise<void> {
    const consumerInfos = await this.consumeQueues((msg, routingKey) => this.onMessage(msg, routingKey));
    this.consumerInfos = consumerInfos;
  }

  async purge(): Promise<void> {
    await this.cancelConsumes(this.consumerInfos);
    this.consumerInfos = [];
    this.initialized = false;
  }

  async subscribe(pattern: string, handler?: Handler): Promise<void> {
    await this.checkInitialized();
    await this.bindQueue(this.roundRobinEventQ, MessageBrokerService.EXCHANGE_NAME, pattern);

    if (handler) this.handlers[pattern] = handler;
  }

  async unsubscribe(pattern: string): Promise<void> {
    await this.checkInitialized();
    await this.unbindQueue(this.roundRobinEventQ, MessageBrokerService.EXCHANGE_NAME, pattern);

    this.handlers = _.omit(this.handlers, pattern);
  }

  async subscribeFanout(pattern: string, handler?: Handler): Promise<void> {
    await this.checkInitialized();
    await this.bindQueue(this.fanoutEventQ, MessageBrokerService.EXCHANGE_NAME, pattern);

    if (handler) this.handlers[pattern] = handler;
  }

  async unsubscribeFanout(pattern: string): Promise<void> {
    await this.checkInitialized();
    await this.unbindQueue(this.fanoutEventQ, MessageBrokerService.EXCHANGE_NAME, pattern);

    this.handlers = _.omit(this.handlers, pattern);
  }

  async publish<T>(key: string, msg: T): Promise<void> {
    await this.checkInitialized();
    await this._publish(
      MessageBrokerService.EXCHANGE_NAME,
      key,
      new Buffer(JSON.stringify(msg), 'utf8'),
      { timestamp: +new Date() }
    );
  }

  private async checkInitialized(): Promise<void> {

    if (!this.initialized) throw new FatalError(ISLAND.FATAL.F0013_NOT_INITIALIZED, 'not initialized');

  }

  private onMessage(msg: any, routingKey: string) {
    _.keys(this.handlers).forEach(pattern => {
      const matcher = this.matcher(pattern);
      Bluebird.try(() => {
        if (matcher.test(routingKey)) this.handlers[pattern](msg, routingKey);
      }).catch(e => {
        logger.debug('[handle msg error]', e);
        const error: any = new LogicError(ISLAND.LOGIC.L0006_HANDLE_MESSAGE_ERROR, e.message);
        logger.debug(error.stack);
        throw e;
      });
    });
  }

  private matcher(pattern: string) {
    const splits = pattern.split('.');
    return new RegExp(splits.map(s => {
      return s === '*' ? '[a-zA-Z0-9]*' : (s === '#' ? '[a-zA-Z0-9.]' : s);
    }).join('.'));
  }

  private consumeQueues(handler: Handler, options?: any): Promise<IConsumerInfo[]> {
    if (!this.initialized) return Promise.reject(new FatalError(ISLAND.FATAL.F0013_NOT_INITIALIZED, 'Not initialized'));
    return Promise.resolve(Bluebird.map([this.roundRobinEventQ, this.fanoutEventQ], queue => {
      return this._consume(queue, msg => {
        let decodedParams;
        try {
          decodedParams = JSON.parse(msg.content.toString('utf8'), reviver);
          handler(decodedParams, msg.fields.routingKey);
        } catch (e) {
          this.publish('log.eventError', {
            error: e,
            event: msg.fields.routingKey,
            params: decodedParams || null
          });
        }
        return Promise.resolve(0);
      }, 'MSG-BROKER', options);
    }));
  }

  private async cancelConsumes(consumeInfos: IConsumerInfo[]): Promise<void> {
    await this.checkInitialized();
    if (!consumeInfos) throw new FatalError(ISLAND.FATAL.F0015_TAG_IS_UNDEFINED, 'Tag is undefined');
    await Bluebird.map(consumeInfos, consumeInfo => this._cancel(consumeInfo));
  }
}

export interface Handler {
  (msg: any, routingKey: string): void;
}
