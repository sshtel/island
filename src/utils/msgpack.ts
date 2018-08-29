import * as msgpack5 from 'msgpack5';

import { FatalError, ISLAND, LogicError } from '../utils/error';
import { logger } from '../utils/logger';

export default class MessagePack {
  public static getInst(): MessagePack {
    if (!MessagePack.instance) {
      MessagePack.instance = new MessagePack();
    }
    return MessagePack.instance;
  }

  private static instance: MessagePack;
  private packer = msgpack5();

  constructor() {
    if (MessagePack.instance) {
      throw new FatalError(ISLAND.ERROR.E0022_NOT_INITIALIZED_EXCEPTION,
                          'Error: Instantiation failed: Use getInst() instead of new.');
    }
    MessagePack.instance = this;

    // NOTE: timestamp를 직접 buffer에 쓰면 더 압축할 수 있다.
    this.packer.register(0x01, Date,
      (date: Date) => {
        return new Buffer(date.toISOString());
      }, (buf: Buffer) => {
        return new Date(buf.toString());
      });
    this.packer.register(0x03, Error,
      (error: Error & {stack: string, statusCode: number, extra?}) => {
        return new Buffer(JSON.stringify({
          extra: error.extra,
          message: error.message,
          name: error.name,
          stack: error.stack,
          statusCode: error.statusCode
        }));
      }, (buf: Buffer) => {
        const errorObject = JSON.parse(buf.toString());
        const err: any = new LogicError(ISLAND.ERROR.E0032_MSG_PACK_ERROR, errorObject.message);
        err.name = errorObject.name;
        err.stack = errorObject.stack;
        err.statusCode = errorObject.statusCode;
        err.extra = errorObject.extra;
        return err;
      }
    );
  }

  public encode(obj: any): Buffer {
    try {
      // msgpack.encode는 BufferList를 반환하지만, Buffer와 읽기 호환 인터페이스를 제공한다.
      // https://www.npmjs.com/package/bl
      // @kson //2016-08-23
      return this.packer.encode(obj) as any as Buffer;
    } catch (e) {
      logger.debug('[MSG ENCODE ERROR]', e);
      const error: any = new LogicError(ISLAND.ERROR.E0033_MSG_PACK_ENCODE_ERROR, e.message);
      logger.debug(error.stack);
      throw e;
    }
  }

  public decode<T>(buf: Buffer | any): T {
    return this.packer.decode(buf);
  }
}
