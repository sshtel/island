import * as amqp from 'amqplib';
import * as Bluebird from 'bluebird';
import * as _ from 'lodash';
import * as util from 'util';

import { logger } from '../utils/logger';

export interface AmqpOptions {
  // `url` will be passed through into `amqp.connect()`
  url: string;
  // `socketOptions` will be passed through into `amqp.connect()`
  socketOptions?: { noDelay?: boolean, heartbeat?: number };
  // max length of channel pool to allow.
  poolSize?: number;
  name?: string;
  prefetchCount?: number;
}

export class AmqpChannelPoolService {
  static DEFAULT_POOL_SIZE: number = 16;

  private connection: amqp.Connection;
  private options: AmqpOptions;
  private idleChannelLength: number = 0;
  private idleChannels: amqp.Channel[] = [];
  private initResolver: Bluebird.Resolver<void>;

  constructor() {
    this.initResolver = Bluebird.defer<void>();
  }

  async initialize(options: AmqpOptions): Promise<void> {
    options.poolSize = options.poolSize || AmqpChannelPoolService.DEFAULT_POOL_SIZE;
    this.options = options;
    logger.info(`connecting to broker ${util.inspect(options, { colors: true })}`);
    try {
      const connection = await amqp.connect(options.url, options.socketOptions);

      logger.info(`connected to ${options.url} for ${options.name}`);
      this.connection = connection;
      this.initResolver.resolve();
    } catch (e) { this.initResolver.reject(e); }

    return Promise.resolve(this.initResolver.promise);
  }

  getPrefetchCount(): (number | undefined) {
    return this.options.prefetchCount;
  }

  async waitForInit(): Promise<void> {
    return this.initResolver.promise;
  }

  async purge(): Promise<void> {
    this.idleChannelLength = 0;
    this.idleChannels = [];
    return this.connection && this.connection.close();
  }

  async acquireChannel(): Promise<amqp.Channel> {
    if (this.idleChannelLength < this.options.poolSize!) {
      ++this.idleChannelLength;
      try {
        this.idleChannels.push(await this.createChannel());
      } catch (e) {
        --this.idleChannelLength;
        throw e;
      }
    }
    return _.sample(this.idleChannels)!;
  }

  async releaseChannel(channel: amqp.Channel, reusable: boolean = false): Promise<void> {
    // the channels will never be released unless caused by MQ itself
  }

  async usingChannel<T>(task: (channel: amqp.Channel) => PromiseLike<T>) {
    return Bluebird.using(this.getChannelDisposer(), task);
  }

  getChannelDisposer(): Bluebird.Disposer<amqp.Channel> {
    return Bluebird.resolve(this.acquireChannel())
      .disposer((channel: amqp.Channel) => {
        this.releaseChannel(channel, true);
      });
  }

  private async createChannel(): Promise<amqp.Channel> {
    const channel = await this.connection.createChannel();

    this.setChannelEventHandler(channel);
    return channel;
  }

  private setChannelEventHandler(channel: amqp.Channel) {
    channel
      .on('error', err => {
        logger.notice('amqp channel error:', err);
        if (err.stack) {
          logger.debug(err.stack);
        }
        _.remove(this.idleChannels, channel);
      })
      .on('close', () => {
        _.remove(this.idleChannels, channel);
      });
  }
}
