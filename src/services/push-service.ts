import * as _ from 'lodash';
import { Environments } from '../utils/environments';
import { ISLAND, LogicError } from '../utils/error';
import { logger } from '../utils/logger';
import MessagePack from '../utils/msgpack';
import { AmqpChannelPoolService } from './amqp-channel-pool-service';

const SERIALIZE_FORMAT_PUSH = Environments.getSerializeFormatPush();
export type BroadcastTarget = 'all' | 'pc' | 'mobile';
export const BroadcastTargets = ['all', 'pc', 'mobile'];

export default class PushService {
  // Exchange to broadcast to the entire users.
  public static broadcastExchange = {
    name: {
      all: 'PUSH_FANOUT_EXCHANGE',
      pc: 'PUSH_PC_FANOUT_EXCHANGE',
      mobile: 'PUSH_MOBILE_FANOUT_EXCHANGE'
    },
    options: {
      durable: true
    },
    type: 'fanout'
  };

  // Exchange to push to a specific user.
  public static playerPushExchange = {
    name: 'push.player',
    options: {
      durable: true
    },
    type: 'direct'
  };
  public static msgpack = MessagePack.getInst();

  public static encode(obj): Buffer {
    try {
      let buf;
      switch (SERIALIZE_FORMAT_PUSH) {
        case 'json':
          buf = Buffer.concat([new Buffer('JSON'), new Buffer(JSON.stringify(obj))]);
          break;
        default:
          buf = Buffer.concat([new Buffer('MSGP'), PushService.msgpack.encode(obj)]);
          break;
      }
      return buf;
    } catch (e) {
      e.formatType = SERIALIZE_FORMAT_PUSH;
      logger.debug('[JSON ENCODE ERROR]', e);
      const error = new LogicError(ISLAND.LOGIC.L0007_PUSH_ENCODE_ERROR, e.message);
      logger.debug(error.stack);
      throw e;
    }
  }

  public static decode(buf) {
    let obj;
    let magic;
    try {
      magic = buf.readUInt32LE(0, 4);
    } catch (e) {
      // FIXME: backward compatibility
      // we can just throw in here after all services changed.
      magic = 0;
    }
    switch (magic) {
      // JSON
      case 0x4E4F534A:
        obj = JSON.parse(buf.slice(4).toString());
        break;
      // MSGP
      case 0x5047534D:
        obj = PushService.msgpack.decode(buf.slice(4));
        break;
      default:
        // FIXME: backward compatibility
        // we can just throw in here after all services changed.
        switch (SERIALIZE_FORMAT_PUSH) {
          case 'json':
            obj = JSON.parse(buf.toString());
            break;
          default:
            obj = PushService.msgpack.decode(buf);
            break;
        }
    }
    return obj;
  }

  private static DEFAULT_EXCHANGE_OPTIONS: any = {
    autoDelete: true,
    durable: true
  };

  private static autoDeleteTriggerQueue = {
    name: 'auto-delete.trigger',
    options: {
      messageTtl: 0
    }
  };

  private channelPool: AmqpChannelPoolService;

  constructor() {
  }

  public async initialize(channelPool: AmqpChannelPoolService): Promise<any> {
    this.channelPool = channelPool;

    await this.channelPool.usingChannel(async channel => {
      const playerPushX = PushService.playerPushExchange;
      const broadcastExchange = PushService.broadcastExchange;
      _.forEach(broadcastExchange.name, async name => {
        await channel.assertExchange(name,
          broadcastExchange.type, PushService.broadcastExchange.options);
      });
      await channel.assertExchange(playerPushX.name, playerPushX.type, playerPushX.options);
      await channel.assertQueue(PushService.autoDeleteTriggerQueue.name, PushService.autoDeleteTriggerQueue.options);
      await channel.bindExchange(PushService.broadcastExchange.name.pc, PushService.broadcastExchange.name.all, '');
      await channel.bindExchange(PushService.broadcastExchange.name.mobile, PushService.broadcastExchange.name.all, '');
    });
  }

  async purge(): Promise<any> {}

  async deleteExchange(exchange: string, options?: any): Promise<any> {
    return this.channelPool.usingChannel(channel => {
      logger.debug(`[INFO] delete exchange's name ${exchange}`);
      return channel.deleteExchange(exchange, options);
    });
  }

  /**
   * bind specific exchange wrapper
   * @param destination
   * @param source
   * @param pattern
   * @param sourceType
   * @param sourceOpts
   * @returns {Promise<any>}
   */
  async bindExchange(destination: string,
                     source: string,
                     pattern: string = '',
                     sourceType: string = 'fanout',
                     sourceOpts: any = PushService.DEFAULT_EXCHANGE_OPTIONS
  ): Promise<any> {
    logger.debug(`bind exchange. ${source} ==${pattern}==> ${destination}`);
    let sourceDeclared = false;
    try {
      await this.channelPool.usingChannel(async channel => {
        await channel.assertExchange(source, sourceType, sourceOpts);
        sourceDeclared = true;
        await channel.bindExchange(destination, source, pattern);
      });
    } catch (e) {
      // Auto-delete is triggered only when target exchange(or queue) is unbound or deleted.
      // If previous bind fails, we can't ensure auto-delete triggered or not.
      // Below workaround prevents this from happening.
      // caution: Binding x-recent-history exchange to unroutable target causes connection loss.
      // target should be a queue and routable.
      if (sourceDeclared && sourceOpts.autoDelete) {
        await this.channelPool.usingChannel(async channel => {
          await channel.bindQueue(PushService.autoDeleteTriggerQueue.name, source, '');
          await channel.unbindQueue(PushService.autoDeleteTriggerQueue.name, source, '');
        });
      }
      throw e;
    }
  }

  /**
   * unbind exchange wrapper
   * @param destination
   * @param source
   * @param pattern
   * @returns {Promise<any>}
   */
  async unbindExchange(destination: string, source: string, pattern: string = ''): Promise<any> {
    logger.debug(`unbind exchange; ${source} --${pattern}--X ${destination}`);
    return this.channelPool.usingChannel(channel => {
      return channel.unbindExchange(destination, source, pattern, {});
    });
  }

  /**
   * publish message to a player
   * @param pid
   * @param msg
   * @param options
   * @returns {Promise<any>}
   */
  async unicast(pid: string, msg: any, options?: any): Promise<any> {
    return this.channelPool.usingChannel(async channel => {
      return channel.publish(PushService.playerPushExchange.name, pid, PushService.encode(msg), options);
    });
  }

  /**
   * publish message to specific exchange
   * @param exchange
   * @param msg
   * @param routingKey
   * @param options
   * @returns {Promise<any>}
   */
  async multicast(exchange: string, msg: any, routingKey: string = '', options?: any): Promise<any> {
    return this.channelPool.usingChannel(async channel => {
      return channel.publish(exchange, routingKey, PushService.encode(msg), options);
    });
  }

  /**
   * publish message to global fanout exchange
   * @param msg message to broadcast. message should be MessagePack encodable.
   * @param options publish options
   * @returns {Promise<any>}
   */
  async broadcast(msg: any, options?: any): Promise<any> {
    return this.channelPool.usingChannel(async channel => {
      const target: BroadcastTarget = options && options.broadcastTarget || 'all';
      const fanout = PushService.broadcastExchange.name[target];
      return channel.publish(fanout, '', PushService.encode(msg), options);
    });
  }
}
