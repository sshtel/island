import * as restify from 'restify';

import { FatalError, ISLAND } from '../../utils/error';
import ListenableAdapter from '../listenable-adapter';
import queryParser from './middlewares/restify-query-parser';

export interface RestifyAdapterOptions {
  serverOptions?: restify.ServerOptions;
  port: number;
}

/**
 * RestifyAdapter
 * @class
 * @extends ListenableAdapter
 */
export default class RestifyAdapter extends ListenableAdapter<restify.Server, RestifyAdapterOptions> {
  /**
   * Initialize the restify server.
   * @override
   * @returns {Promise<void>}
   */
  public initialize() {
    if (!this.options) throw new FatalError(ISLAND.ERROR.E0025_MISSING_ADAPTER_OPTIONS);
    const options = this.options;
    const server = restify.createServer(options.serverOptions || {});

    // Cleans up sloppy URLs on the request object, like /foo////bar/// to /foo/bar.
    // ex) /v2/a/b/ => /v2/a/b
    server.pre(restify.pre.sanitizePath());

    server.use(restify.dateParser());
    server.use(queryParser());
    server.use(restify.bodyParser({
      // https://github.com/restify/node-restify/issues/789 <-
      mapParams: false,
      // TODO: export below params to external configuation file
      maxBodySize: 0
    }));

    this._adaptee = server;
  }

  /**
   * Listen the restify server.
   * @override
   * @returns {Promise<void>}
   */
  public listen() {
    return new Promise<void>((resolve, reject) => {
      if (!this.options) throw new FatalError(ISLAND.ERROR.E0025_MISSING_ADAPTER_OPTIONS);
      this.adaptee.listen(this.options.port, err => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  public async destroy() {
    await super.destroy();
    return await this.adaptee.close();
  }
}
