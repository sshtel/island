import { cls } from 'island-loggers';

import * as amqp from 'amqplib';
import * as Bluebird from 'bluebird';
import * as fs from 'fs';
import * as _ from 'lodash';
import * as uuid from 'uuid';

import { Environments } from '../utils/environments';
import { DEFAULT_SUBSCRIPTIONS, Events } from '../utils/event';
import { logger } from '../utils/logger';
import reviver from '../utils/reviver';
import { RouteLogger } from '../utils/route-logger';
import { collector } from '../utils/status-collector';
import { AmqpChannelPoolService } from './amqp-channel-pool-service';
import {
  BaseEvent,
  Event,
  EventHandler,
  EventSubscriber,
  Message,
  PatternSubscriber,
  Subscriber,
  SubscriptionOptions
} from './event-subscriber';

export type EventHook = (obj) => Promise<any>;
export enum EventHookType {
  EVENT,
  ERROR
}

export interface IEventConsumerInfo {
  channel: amqp.Channel;
  consumerTag: string;
  queue: string;
}

function enterScope(properties: any, func): Promise<any> {
  return new Promise((resolve, reject) => {
    const ns = cls.getNamespace('app');
    ns.run(() => {
      _.each(properties, (value, key: string) => {
        ns.set(key, value);
      });
      Bluebird.try(func).then(resolve).catch(reject);
    });
  });
}

class StatusExport extends BaseEvent<any> {
  constructor(args: any) {
    super('island.status.export', args);
  }
}

export class EventService {
  private static EXCHANGE_NAME: string = 'MESSAGE_BROKER_EXCHANGE';
  private channelPool: AmqpChannelPoolService;
  private consumerChannelPool: AmqpChannelPoolService;
  private roundRobinQ: string;
  private fanoutQ: string;
  private subscribers: Subscriber[] = [];
  private serviceName: string;
  private hooks: { [key: string]: EventHook[] } = {};
  private purging: Function | null = null;
  private consumerInfosMap: { [name: string]: IEventConsumerInfo } = {};
  private ignoreEventLogRegexp: RegExp | null = null;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
    this.roundRobinQ = `event.${serviceName}`;
    this.fanoutQ = `event.${serviceName}.node.${uuid.v4()}`;
    fs.writeFileSync('./event.proc', JSON.stringify({ status: 'initializing', queue: this.fanoutQ }));
  }

  async initialize(channelPool: AmqpChannelPoolService, consumerChannelPool?: AmqpChannelPoolService): Promise<any> {
    this.ignoreEventLogRegexp = (Environments.getIgnoreEventLogRegexp() &&
      new RegExp(Environments.getIgnoreEventLogRegexp(), 'g')) as RegExp;

    this.channelPool = channelPool;
    this.consumerChannelPool = consumerChannelPool || channelPool;
    await this.consumerChannelPool.usingChannel(async channel => {
      await channel.assertExchange(EventService.EXCHANGE_NAME, 'topic', { durable: true });
      await channel.assertQueue(this.roundRobinQ, { durable: true, exclusive: false });
      await channel.assertQueue(this.fanoutQ, { exclusive: true, autoDelete: true });
    });

    await Bluebird.map(DEFAULT_SUBSCRIPTIONS, ({ eventClass, handler, options }) => {
      return this.subscribeEvent(eventClass, handler.bind(this), options);
    });
    fs.writeFileSync('./event.proc', JSON.stringify({ status: 'initialized', queue: this.fanoutQ }));
    collector.registerExporter('EVENT', o => this.sendStatusJsonEvent(o));
  }

  async startConsume(): Promise<any> {
    const channel = await this.consumerChannelPool.acquireChannel();

    await Bluebird.map([this.roundRobinQ, this.fanoutQ], queue => {
      this.registerConsumer(channel, queue);
    });
    this.publishEvent(new Events.SystemNodeStarted({ name: this.fanoutQ, island: this.serviceName }));
    fs.writeFileSync('./event.proc', JSON.stringify({ status: 'started', queue: this.fanoutQ }));
  }

  async purge(): Promise<any> {
    fs.unlinkSync('./event.proc');
    this.hooks = {};
    if (!this.consumerInfosMap) return Promise.resolve();
    await Promise.all(_.map(this.consumerInfosMap, (consumerInfo: IEventConsumerInfo) => {
      logger.info(`stop consuming : ${consumerInfo.queue}`);
      return consumerInfo.channel.cancel(consumerInfo.consumerTag);
    }));
    this.subscribers = [];
    if (collector.getOnGoingRequestCount('event') > 0) {
      return new Promise((res, rej) => { this.purging = res; });
    }
  }

  public async sigInfo() {
    return await collector.sigInfo('event');
  }

  subscribeEvent<T extends Event<U>, U>(eventClass: new (args: U) => T,
                                        handler: EventHandler<T>,
                                        options?: SubscriptionOptions): Promise<void> {
    return Promise.resolve(Bluebird.try(() => new EventSubscriber(handler, eventClass))
      .then(subscriber => this.subscribe(subscriber, options)));
  }

  subscribePattern(pattern: string,
                   handler: EventHandler<Event<any>>,
                   options?: SubscriptionOptions): Promise<void> {
    return Promise.resolve(Bluebird.try(() => new PatternSubscriber(handler, pattern))
      .then(subscriber => this.subscribe(subscriber, options)));
  }

  publishEvent<T extends Event<U>, U>(exchange: string, event: T): Promise<any>;
  publishEvent<T extends Event<U>, U>(event: T): Promise<any>;
  publishEvent(...args): Promise<any> {
    let exchange = EventService.EXCHANGE_NAME;
    let event: Event<{}>;
    if (args.length === 1) {
      event = args[0];
    } else {
      exchange = args[0];
      event = args[1];
    }

    const options = this.getOptions(event);
    RouteLogger.tryToSaveLog(
      { clsNameSpace: 'app',
        type: 'req',
        context: `${event.constructor.name}`,
        protocol: 'EVENT',
        correlationId: uuid.v4()
      });
    logger.debug(`publish ${event.key}`, JSON.stringify(event.args, null, 2), options.headers.tattoo);
    return Promise.resolve(Bluebird.try(() => new Buffer(JSON.stringify(event.args), 'utf8'))
      .then(content => {
        return this._publish(exchange, event.key, content, options);
      }));
  }

  registerHook(type: EventHookType, hook: EventHook) {
    this.hooks[type] = this.hooks[type] || [];
    this.hooks[type].push(hook);
  }

  private getOptions(event: Event<{}>): any {
    const ns = cls.getNamespace('app');
    return {
      headers: {
        tattoo: ns.get('tattoo'),
        from: {
          node: Environments.getHostName(),
          context: ns.get('Context'),
          island: this.serviceName,
          type: ns.get('Type')
        },
        extra: {
          sessionType: ns.get('sessionType')
        }
      },
      timestamp: +event.publishedAt! || +new Date()
    };
  }

  private registerConsumer(channel: amqp.Channel, queue: string): Promise<any> {
    const prefetchCount = this.consumerChannelPool.getPrefetchCount();
    return Promise.resolve(channel.prefetch(prefetchCount || Environments.getEventPrefetch()))
      .then(() => channel.consume(queue, msg => {
        if (!msg) {
          logger.crit(`The event queue is canceled unexpectedly`);
          // TODO: handle unexpected cancel
          return this.shutdown();
        }

        if (msg.fields.routingKey === this.fanoutQ) {
          msg.fields.routingKey = 'system.diagnosis';
        }

        let routingKey = msg.fields.routingKey;
        if (/^cron(\.s)*[\.0-9]*/.test(routingKey)) {
          routingKey = routingKey.replace(/[\.0-9]*$/, '');
        }

        const requestId = collector.collectRequestAndReceivedTime('event', routingKey, { msg });
        Bluebird.resolve(this.handleMessage(msg))
          .catch(err => {
            this.sendErrorLog(err, msg);
            collector.collectExecutedCountAndExecutedTime('event', routingKey, { requestId, err } );
          })
          .finally(() => {
            channel.ack(msg);
            collector.collectExecutedCountAndExecutedTime('event', routingKey, { requestId });
            if (this.purging && collector.getOnGoingRequestCount('event') < 1 ) {
              this.purging();
            }
            // todo: fix me. we're doing ACK always even if promise rejected.
            // todo: how can we handle the case subscribers succeeds or fails partially
          });
      }))
      .then((consumerInfo: IEventConsumerInfo) => {
        consumerInfo.channel = channel;
        consumerInfo.queue = queue;
        this.consumerInfosMap[queue] = consumerInfo;
      });
  }

  private async sendErrorLog(err: Error, msg: Message): Promise<any> {
    logger.error(`error on handling event`, err);
    if ('ExpectedError' === err.name) return;
    if ('log.error' === msg.fields.routingKey) return; // preventing loop

    const errorLog = {
      message: err.message,
      params: (() => {
        try {
          return JSON.parse(msg.content.toString('utf8'), reviver);
        } catch (e) {
          return msg.content;
        }
      })(),
      stack: err.stack
    };
    _.assign(errorLog, err);
    return this.publishEvent(new BaseEvent('log.error', errorLog));
  }

  private async dohook(type: EventHookType, value) {
    if (!this.hooks[type]) return value;
    return Bluebird.reduce(this.hooks[type], async (value, hook) => await hook(value), value);
  }

  private async handleMessage(msg: Message): Promise<any> {
    const headers = msg.properties.headers;
    const tattoo = headers && headers.tattoo;
    const extra = headers && headers.extra || {};
    const content = await this.dohook(EventHookType.EVENT, JSON.parse(msg.content.toString('utf8'), reviver));
    const subscribers = this.subscribers.filter(subscriber => subscriber.isRoutingKeyMatched(msg.fields.routingKey));
    const promise = Bluebird.map(subscribers, subscriber => {
      const clsProperties = _.merge({ tattoo, Context: msg.fields.routingKey, Type: 'event' },
                                    extra);
      return enterScope(clsProperties, () => {
        if (!this.ignoreEventLogRegexp || !msg.fields.routingKey.match(this.ignoreEventLogRegexp)) {
          logger.debug(`subscribe event : ${msg.fields.routingKey}`, content, msg.properties.headers);
        }
        return Bluebird.resolve(subscriber.handleEvent(content, msg))
          .catch(async e => {
            if (!e.extra || typeof e.extra === 'object') {
              e.extra = _.assign({
                args: content,
                event: msg.fields.routingKey,
                island: this.serviceName
              }, e.extra);
            }
            throw await this.dohook(EventHookType.ERROR, e);
          });
      });
    });
    return Promise.resolve(promise);
  }

  private subscribe(subscriber: Subscriber, options?: SubscriptionOptions): Promise<void> {
    options = options || {};
    subscriber.setQueue(options.everyNodeListen && this.fanoutQ || this.roundRobinQ);
    return this.consumerChannelPool.usingChannel(channel => {
      return channel.bindQueue(subscriber.getQueue(), EventService.EXCHANGE_NAME, subscriber.getRoutingPattern());
    })
      .then(() => {
        this.subscribers.push(subscriber);
      });
  }

  private _publish(exchange: string, routingKey: string, content, options): Promise<any> {
    return this.channelPool.usingChannel(channel => {
      return Promise.resolve(channel.publish(exchange, routingKey, content, options));
    });
  }

  private sendStatusJsonEvent(data: any) {
    return this.publishEvent(new StatusExport(data));
  }

  private shutdown() {
    process.emit('SIGTERM');
  }
}
