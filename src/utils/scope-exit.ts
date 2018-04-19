import * as Bluebird from 'bluebird';

import { logger } from './logger';

export interface DeferredTask {
  (): any;
}

export interface ErrorHook {
  (e: Error): any;
}

export class ScopeExit {
  static hooks: ErrorHook[] = [];

  static registerErrorHook(hook: ErrorHook) {
    ScopeExit.hooks.push(hook);
  }

  static clearErrorHooks() {
    ScopeExit.hooks = [];
  }

  private tasksOnFulfilled: DeferredTask[] = [];
  private tasksOnRejected: DeferredTask[] = [];

  defer(task: DeferredTask): ScopeExit {
    return this.onFulfilled(task);
  }

  onFulfilled(task: DeferredTask): ScopeExit {
    this.tasksOnFulfilled.push(task);
    return this;
  }

  onRejected(task: DeferredTask): ScopeExit {
    this.tasksOnRejected.push(task);
    return this;
  }

  disposer(): Bluebird.Disposer<ScopeExit> {
    return Bluebird.resolve(this).disposer(async (result, promise) => {
      let tasks: DeferredTask[];
      if (promise.isFulfilled()) {
        tasks = this.tasksOnFulfilled;
      } else {
        tasks = this.tasksOnRejected;
      }
      for (const task of tasks) {
        try {
          await task();
        } catch (errorForTask) {
          for (const hook of ScopeExit.hooks) {
            try {
              await hook(errorForTask);
            } catch (errorForHook) {
              logger.error('Error in a hook in a disaposer', errorForHook.stack);
            }
          }
        }
      }
    });
  }
}
