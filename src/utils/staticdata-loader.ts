import { FatalError, ISLAND } from '../utils/error';

export default class StaticDataLoader<T> {
  protected object: T;

  public get Object() {
    if (!this.object) {
      throw new FatalError(ISLAND.ERROR.E0022_NOT_INITIALIZED_EXCEPTION, 'Exception :: This object is not initialized');
    }
    return this.object;
  }

  public initialize(): Promise<any> {
    throw new FatalError(ISLAND.ERROR.E0021_NOT_IMPLEMENTED_ERROR, 'Exception :: This object is not implemented.');
  }
}
