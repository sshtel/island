import io = require('socket.io');

import { FatalError, ISLAND } from '../../utils/error';
import ListenableAdapter from '../listenable-adapter';

export interface SocketIOAdapterOptions {
  port: number;
}

export default class SocketIOAdapter extends ListenableAdapter<io.Server, SocketIOAdapterOptions> {
  /**
   * @returns {Promise<void>}
   * @override
   */
  public initialize() {
    this._adaptee = io({ transports: ['websocket', 'polling', 'flashsocket'] });
    return Promise.resolve();
  }

  /**
   * @override
   * @returns {Promise<void>}
   */
  public listen() {
    if (!this.options) throw new FatalError(ISLAND.FATAL.F0025_MISSING_ADAPTER_OPTIONS);
    this.adaptee.listen(this.options.port);
    return Promise.resolve();
  }

  public destroy() {
    return super.destroy();
  }
}
