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
  private idleChannels: Promise<amqp.Channel>[] = [];
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
    this.idleChannels = [];
    return this.connection && this.connection.close();
  }

  async acquireChannel(): Promise<amqp.Channel> {
    if (this.idleChannels.length < this.options.poolSize!) {
      try {
        this.idleChannels.push(this.createChannel());
      } catch (e) {
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
    const channel = Promise.resolve(this.connection.createChannel());

    this.setChannelEventHandler(await channel);
    return channel;
  }

  private async setChannelEventHandler(channel: amqp.Channel) {
    channel
      .on('error', err => {
        logger.notice('amqp channel error:', err);
        if (err.stack) {
          logger.debug(err.stack);
        }
      })
      .on('close', async () => {
        await Promise.all(_.map(this.idleChannels, async obj => {
          obj.then( value => {
            if ( (value as any).ch === (channel as any).ch) {
              (obj as any).terminate = true;
            }
          });
        }));
        _.remove(this.idleChannels, obj => {
          return (obj as any).terminate;
        });
      });
  }
}
