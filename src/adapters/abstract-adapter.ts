import { logger } from '../utils/logger';

/**
 * IAbstractAdapter
 * @abstract class
 */
export abstract class IAbstractAdapter {
  adaptee: any;
  abstract initialize(): any | Promise<any>;
  abstract destroy(): any | Promise<any>;
  abstract sigInfo(): any | Promise<void>;
}

/**
 * Abstract adapter class for back-end service.
 * @abstract
 * @class
 * @implements IAbstractAdapter
 */
export default abstract class AbstractAdapter<T, U> extends IAbstractAdapter {
  protected _adaptee: T;
  protected _options: U | undefined;

  public get adaptee(): T { return this._adaptee; }
  protected get options(): U | undefined { return this._options; }

  constructor(options?: U) {
    super();
    this._options = options;
  }

  sigInfo() {
    logger.warning(`Not implemented warning, for AbstractAdapter.sigInfo.`);
  }
}
