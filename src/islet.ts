import * as _ from 'lodash';

import { IAbstractAdapter } from './adapters/abstract-adapter';
import { AmqpChannelPoolAdapter } from './adapters/impl/amqp-channel-pool-adapter';
import ListenableAdapter, { IListenableAdapter } from './adapters/listenable-adapter';
import { bindImpliedServices } from './utils/di-bind';
import { Environments } from './utils/environments';
import { FatalError, ISLAND } from './utils/error';
import { logger } from './utils/logger';
import { collector, STATUS_EXPORT, STATUS_EXPORT_TIME_MS } from './utils/status-collector';

import { IntervalHelper } from './utils/interval-helper';

/**
 * Create a new Islet.
 * @abstract
 * @class
 */
export default class Islet {
  /**
   * Retrieves a registered micro-service.
   * @returns {Microservice}
   * @static
   */
  static getIslet(): Islet {
    return Islet.islet;
  }

  /**
   * Instantiate and run a microservice.
   * @param {Microservice} Class
   * @static
   */
  public static run(subClass: typeof Islet, opts?: { SIGTERM?: boolean, SIGUSR2?: boolean }) {
    if (this.islet) return;

    // Create such a micro-service instance.
    const islet = new subClass();
    this.registerIslet(islet);

    islet.main();
    return islet.initialize(opts);
  }

  private static islet: Islet;

  /**
   * Register the islet which is the suite of micro-service
   * @param {Islet} islet
   * @static
   */
  private static registerIslet(islet: Islet) {
    if (Islet.islet) {
      throw new FatalError(ISLAND.ERROR.E0001_ISLET_ALREADY_HAS_BEEN_REGISTERED,
                           'The islet already has been registered.');
    }
    Islet.islet = islet;
  }

  /** @type {Object.<string, IAbstractAdapter>} [adapters={}] */
  private adapters: { [name: string]: IAbstractAdapter; } = {};
  private listenAdapters: { [name: string]: IListenableAdapter; } = {};
  private baseAdapters: { [name: string]: IAbstractAdapter; } = {};
  private onGoingStatus: boolean = true;

  /**
   * Register the adapter.
   * @param {string} name
   * @param {IAbstractAdapter} adapter
   */
  public registerAdapter(name: string, adapter: IAbstractAdapter) {
    if (this.adapters[name]) throw new FatalError(ISLAND.ERROR.E0002_DUPLICATED_ADAPTER, 'duplicated adapter');
    this.adapters[name] = adapter;
    if (adapter instanceof ListenableAdapter) {
      this.listenAdapters[name] = adapter;
    } else {
      this.baseAdapters[name] = adapter;
    }
  }

  /**
   * Register Message Queue Adapter And Controllers
   * @param {string} name
   * @param {string} url
   * @param {string} serviceName
   * @param {typeof Adapter} typeOfAdapter
   * @param {AbstractController} controllers
   */
  public registerMq(name: string, url: string, serviceName: string,
                    typeOfAdapter: { new (...args: any[]): IAbstractAdapter }, ...controllers): void {
    url = this.ensureSampledHost(url);
    const poolSize = Environments.ISLAND_RABBITMQ_POOLSIZE;
    const useReviver = Environments.ISLAND_USE_REVIVER;
    const amqpChannelPoolAdapter = new AmqpChannelPoolAdapter({ url, poolSize, name });
    this.registerAdapter(`amqp${_.capitalize(name)}ChannelPool`, amqpChannelPoolAdapter);
    const consumerAmqpChannelPoolAdapter = new AmqpChannelPoolAdapter({
       url, poolSize, name: `consumer${_.capitalize(name)}`
    });
    this.registerAdapter(`consumeAmqp${_.capitalize(name)}ChannelPool`, consumerAmqpChannelPoolAdapter);
    const adapter = new typeOfAdapter({
      amqpChannelPoolAdapter, consumerAmqpChannelPoolAdapter, serviceName, useReviver
    });
    this.registerAdapterAndControllers(name, adapter, ...controllers);
  }

  /**
   * @param {string} name
   * @returns {typeof Adapter}
   */
  public getAdaptee<T>(name: string): T {
    if (!this.adapters[name]) throw new FatalError(ISLAND.ERROR.E0003_MISSING_ADAPTER, 'Missing adapter');
    return this.adapters[name].adaptee as T;
  }

  /**
   * @abstract
   */
  public main() {
    throw new FatalError(ISLAND.ERROR.E0004_NOT_IMPLEMENTED_ERROR, 'Not implemented exception.');
  }

  public isDestroyed() {
    return !this.onGoingStatus;
  }

  public isDestroyed() {
    return !this.onGoingStatus;
  }

  protected onPrepare() {}
  protected onInitialized() {}
  protected onDestroy() {
    this.onGoingStatus = false;
    logger.warning(`island service shut down`);
  }
  protected onStarted() {}

  /**
   * Get Random Sampled Host name from given comma-seperated string
   */
  protected ensureSampledHost(first: string): string {
    const urls = (first || Environments.ISLAND_RABBITMQ_HOST).split(',').map(u => u.trim());
    return _.sample<string>(urls.filter(Boolean))!;
  }

  protected registerAdapterAndControllers(adapterName: string, adapter: any, ...controllers) {
    controllers.forEach(c => adapter.registerController(c));
    this.registerAdapter(adapterName, adapter);
  }

  /**
   * @returns {Promise<void>}
   */
  private async initialize(opts: {SIGTERM?: boolean, SIGUSR2?: boolean} = { SIGTERM : true, SIGUSR2 : true }) {
    try {
      await this.onPrepare();
      await Promise.all(_.values<IAbstractAdapter>(this.adapters).map(adapter => adapter.initialize()));
      if (opts.SIGTERM) process.once('SIGTERM', this.destroy.bind(this));
      if (opts.SIGUSR2) process.on('SIGUSR2', this.sigInfo.bind(this));
      bindImpliedServices(this.adapters);
      await this.onInitialized();
      const adapters = _.values<IAbstractAdapter>(this.adapters)
                        .filter(adapter => adapter instanceof ListenableAdapter) as IListenableAdapter[];

      await Promise.all(adapters.map(adapter => adapter.postInitialize()));
      await Promise.all(adapters.map(adapter => adapter.listen()));

      if (STATUS_EXPORT) {
        logger.notice('INSTANCE STATUS SAVE START');
        IntervalHelper.setIslandInterval(collector.saveStatus.bind(collector), STATUS_EXPORT_TIME_MS);
      }

      logger.info('started');
      await this.onStarted();
    } catch (e) {
      console.log('failed to initialize', e);
      process.exit(1);
    }
  }

  private async destroy() {
    logger.info('Waiting for process to end');
    await Promise.all(_.map(this.listenAdapters, async (adapter: IListenableAdapter, key) => {
      logger.debug('destroy : ', key);
      await adapter.destroy();
    }));
    await IntervalHelper.purge();
    await Promise.all(_.map(this.baseAdapters, async (adapter: IAbstractAdapter, key) => {
      logger.debug('destroy : ', key);
      await adapter.destroy();
    }));
    await this.onDestroy();
  }

  private async sigInfo() {
    logger.info('Waiting for a check to process status');
    await Promise.all(_.map(this.listenAdapters, async (adapter: IListenableAdapter, key) => {
      logger.debug('sigInfo : ', key);
      await adapter.sigInfo();
    }));
  }
}
