import * as Bluebird from 'bluebird';
import * as dns from 'dns';
import * as mongodbUri from 'mongodb-uri';
import * as mongoose from 'mongoose';
import * as util from 'util';

import { FatalError, ISLAND } from '../../utils/error';
import { logger } from '../../utils/logger';
import AbstractAdapter from '../abstract-adapter';

export interface MongooseAdapterOptions {
  uri: string;
  connectionOptions?: mongoose.ConnectionOptions;
}

/**
 * MongooseAdapter
 * @class
 * @extends AbstractAdapter
 */
export default class MongooseAdapter extends AbstractAdapter<mongoose.Connection, MongooseAdapterOptions> {
  /**
   * Initialize the mongoose connection.
   * @returns {Promise<void>}
   * @override
   */
  public initialize() {
    return new Promise<void>((resolve, reject) => {
      if (!this.options) throw new FatalError(ISLAND.FATAL.F0025_MISSING_ADAPTER_OPTIONS);
      // Mongoose buffers all the commands until it's connected to the database.
      // But make sure to the case of using a external mongodb connector
      const uri = this.options.uri;
      const connectionOptions = this.options.connectionOptions;
      this.dnsLookup(uri).then(address => {
        logger.info(`connecting to mongo ${address} with ${util.inspect(connectionOptions, { colors: true })}`);
        const connection = mongoose.createConnection(address, connectionOptions);
        connection.once('open', () => {
          logger.info(`connected to mongo ${address} with ${util.inspect(connectionOptions, { colors: true })}`);
          this._adaptee = connection;
          connection.removeAllListeners();
          resolve();
        });
        connection.once('error', err => {
          logger.info(`connection error on mongo ${address} with ${util.inspect(connectionOptions, { colors: true })}`);
          reject(err);
        });
      });
    });
  }

  public async destroy() {
    return await this._adaptee.close();
  }

  private async dnsLookup(uri) {
    const h = mongodbUri.parse(uri);
    await Bluebird.map(h.hosts, (async (host: {host: string}) => {
      host.host = await this.convert(host.host);
    }));
    return mongodbUri.format(h);
  }

  private async convert(host) {
    return await new Promise<string>((resolve, reject) => {
      dns.lookup(host, (err, ip) => {
        if (err) return reject(err);
        return resolve(ip);
      });
    });
  }
}
