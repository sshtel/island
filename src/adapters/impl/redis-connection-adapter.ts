import Promise = require('bluebird');
import redis = require('redis-bluebird');
import * as util from 'util';

import { FatalError, ISLAND } from '../../utils/error';
import { logger } from '../../utils/logger';
import AbstractAdapter from '../abstract-adapter';

export interface RedisAdapterOptions {
  port: number;
  host: string;
  clientOpts?: redis.ClientOpts;
}

/**
 * RedisConnectionAdapter
 * @class
 * @extends AbstractAdapter
 */
export default class RedisConnectionAdapter extends AbstractAdapter<redis.RedisClient, RedisAdapterOptions> {
  /**
   * Initialize the redis connection.
   * @returns {Promise<void>}
   * @override
   */
  public initialize() {
    if (!this.options) throw new FatalError(ISLAND.FATAL.F0025_MISSING_ADAPTER_OPTIONS);
    const options = this.options;

    return new Promise<void>((resolve, reject) => {
      logger.info(`connecting to redis ${util.inspect(options, { colors: true })}`);
      const client = redis.createClient(options.port, options.host, options.clientOpts);

      // Although all commands before the connection are accumulated in the queue,
      // Make sure for the case of using a external redis connector.
      client.once('ready', () => {
        logger.info(`connected to redis ${options.host}:${options.port}`);
        this._adaptee = client;
        client.removeAllListeners();
        resolve();
      });
      client.once('error', err => {
        logger.info(`connection error on redis ${options.host}:${options.port}`);
        reject(err);
      });
    });
  }

  public destroy() {
    return this._adaptee.quit();
  }
}
