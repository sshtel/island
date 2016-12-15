import * as amqp from 'amqplib';
import * as Promise from 'bluebird';
import * as _  from 'lodash';
import * as uuid from 'node-uuid';
import AbstractBrokerService, { IConsumerInfo } from './abstract-broker-service';
import reviver from '../utils/reviver';
import { LogicError, FatalError, ISLAND } from '../utils/error';
import { logger } from '../utils/logger';

export default class MessageBrokerService extends AbstractBrokerService {
  private static EXCHANGE_NAME: string = 'MESSAGE_BROKER_EXCHANGE';
  private roundRobinEventQ: string;
  private fanoutEventQ: string;
  private consumerInfos: IConsumerInfo[] = [];
  private handlers: {[pattern: string]: Handler} = {};

  constructor(connection: amqp.Connection, serviceName: string) {
    super(connection);
    this.roundRobinEventQ = serviceName;
    this.fanoutEventQ = `event.${serviceName}.${uuid.v4()}`;
  }

  initialize(): Promise<void> {
    if (this.initialized) return Promise.resolve();
    return Promise.try(() => {
        if (!this.roundRobinEventQ) throw new FatalError(ISLAND.FATAL.F0012_ROUND_ROBIN_EVENT_Q_IS_NOT_DEFINED, 'roundRobinEventQ is not defined');
      })
      .then(() => this.declareExchange(MessageBrokerService.EXCHANGE_NAME, 'topic', {durable: true}))
      .then(() => this.declareQueue(this.roundRobinEventQ, {durable: true, exclusive: false}))
      .then(() => this.declareQueue(this.fanoutEventQ, {exclusive: true, autoDelete: true}))
      .then(() => {
        this.initialized = true;
      });
  }

  startConsume(): Promise<void> {
    return this.consumeQueues((msg, routingKey) => this.onMessage(msg, routingKey))
      .then(consumerInfos => {
        this.consumerInfos = consumerInfos;
      });
  }

  purge(): Promise<void> {
    return this.cancelConsumes(this.consumerInfos).then(() => {
      this.consumerInfos = [];
      this.initialized = false;
    });
  }

  subscribe(pattern: string, handler?: Handler): Promise<void> {
    return this.checkInitialized()
      .then(() => this.bindQueue(this.roundRobinEventQ, MessageBrokerService.EXCHANGE_NAME, pattern))
      .then(() => {
        if (handler) this.handlers[pattern] = handler;
      });
  }

  unsubscribe(pattern: string): Promise<void> {
    return this.checkInitialized()
      .then(() => this.unbindQueue(this.roundRobinEventQ, MessageBrokerService.EXCHANGE_NAME, pattern))
      .then(() => {
        delete this.handlers[pattern];
      });
  }

  subscribeFanout(pattern: string, handler?: Handler): Promise<void> {
    return this.checkInitialized()
      .then(() => this.bindQueue(this.fanoutEventQ, MessageBrokerService.EXCHANGE_NAME, pattern))
      .then(() => {
        if (handler) this.handlers[pattern] = handler;
      });
  }

  unsubscribeFanout(pattern: string): Promise<void> {
    return this.checkInitialized()
      .then(() => this.unbindQueue(this.fanoutEventQ, MessageBrokerService.EXCHANGE_NAME, pattern))
      .then(() => {
        delete this.handlers[pattern];
      });
  }

  publish<T>(key: string, msg: T): Promise<void> {
    return this.checkInitialized().then(() => {
      return this._publish(
        MessageBrokerService.EXCHANGE_NAME,
        key,
        new Buffer(JSON.stringify(msg), 'utf8'),
        { timestamp: +new Date() });
    });
  }
  
  private checkInitialized(): Promise<void> {
    return Promise.try(() => {
      if (!this.initialized) throw new FatalError(ISLAND.FATAL.F0013_NOT_INITIALIZED, 'not initialized');
    });
  }

  private onMessage(msg: any, routingKey: string) {
    _.keys(this.handlers).forEach(pattern => {
      var matcher = this.matcher(pattern);
      Promise.try(()=>{
        if (matcher.test(routingKey)) this.handlers[pattern](msg, routingKey);
      }).catch(e => {
        logger.debug('[handle msg error]', e);
        let error:any = new LogicError(ISLAND.LOGIC.L0006_HANDLE_MESSAGE_ERROR, e.message);
        logger.debug(error.stack);
        throw e;
      })
    });
  }

  private matcher(pattern: string) {
    var splits = pattern.split('.');
    return new RegExp(splits.map(s => {
      return s === '*' ? '[a-zA-Z0-9]*' : (s === '#' ? '[a-zA-Z0-9.]' : s);
    }).join('.'));
  }

  private consumeQueues(handler: Handler, options?: any): Promise<IConsumerInfo[]> {
    if (!this.initialized) return Promise.reject(new FatalError(ISLAND.FATAL.F0014_NOT_INITIALIZED, 'Not initialized'));
    return Promise.map([this.roundRobinEventQ, this.fanoutEventQ], queue => {
      return this._consume(queue, msg => {
        let decodedParams;
        try {
          decodedParams = JSON.parse(msg.content.toString('utf8'), reviver);
          handler(decodedParams, msg.fields.routingKey);
        } catch (e) {
          this.publish('log.eventError', {
            event: msg.fields.routingKey,
            params: decodedParams || null,
            error: e
          });
        }
        return Promise.resolve(0);
      }, 'MSG-BROKER', options);
    });
  }

  private cancelConsumes(consumeInfos: IConsumerInfo[]): Promise<void> {
    return this.checkInitialized()
      .then(() => {
        if (!consumeInfos) throw new FatalError(ISLAND.FATAL.F0015_TAG_IS_UNDEFINED, 'Tag is undefined');
      })
      .then(() => Promise.map(consumeInfos, consumeInfo => this._cancel(consumeInfo)))
      .then(() => {});
  }
}

export interface Handler {
  (msg: any, routingKey: string): void;
}
