import * as Bluebird from 'bluebird';

import AbstractController from '../controllers/abstract-controller';
import AbstractAdapter, { IAbstractAdapter } from './abstract-adapter';

/**
 * IListenableAdapter
 * @abstract class
 */
export abstract class IListenableAdapter extends IAbstractAdapter {
  // HACK: 모든 abstract adapter의 initialize가 호출 된 다음에 호출된다
  abstract postInitialize(): any | Promise<any>;
  abstract listen(): any | Promise<any>;
}

/**
 * Abstract adapter class for back-end service.
 * @abstract
 * @class
 * @extends AbstractAdapter
 * @implements IListenableAdapter
 */
export default abstract class ListenableAdapter<T, U> extends AbstractAdapter<T, U> implements IListenableAdapter {
  private _controllersClasses: {new(...args: any[]): AbstractController<T>}[] = [];
  private _controllers: AbstractController<T>[] = [];

  /**
   * @param {AbstractController} Class
   */
  public registerController(Class: {new(...args: any[]): AbstractController<T>}) {
    this._controllersClasses.push(Class);
  }

  /**
   * @returns {Promise<void>}
   * @final
   */
  public postInitialize(): Promise<any> {
    return Promise.all(this._controllersClasses.map(ControllerClass => {
      const c = new ControllerClass(this._adaptee);
      this._controllers.push(c);
      return Bluebird.try(() => c.initialize()).then(() => c.onInitialized());
    }));
  }

  public async destroy(): Promise<any> {
    await Promise.all(this._controllers.map(c => Bluebird.try(() => c.destroy())));
    await Promise.all(this._controllers.map(c => Bluebird.try(() => c.onDestroy())));

    this._controllersClasses = [];
    this._controllers = [];
  }

  /**
   * @abstract
   * @returns {Promise<void>}
   */
  abstract listen(): any | Promise<any>;
}
