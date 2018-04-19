import { Di } from 'island-di';

import { jasmineAsyncAdapter as spec } from '../utils/jasmine-async-support';
import { ScopeExit } from '../utils/scope-exit';

describe('ScopeExit', () => {
  const container = new Di.Container();

  beforeAll(spec (async () => {
    container
      .bindScopeResource(ScopeExit, service => service.disposer());
    ScopeExit.clearErrorHooks();
  }));

  afterEach(spec(async () => {
  }));

  it('should run when after the scope has finished', spec(async () => {
    let called = 0;
    let calledScopeTask = -1;
    let calledDeferredTask = -1;
    await container.scope().inject(ScopeExit).run((scopeExit: ScopeExit) => {
      scopeExit.defer(() => {
        calledDeferredTask = called++;
      });
      calledScopeTask = called++;
    });
    expect(calledScopeTask).toBe(0);
    expect(calledDeferredTask).toBe(1);
  }));

  it('could have multiple deferred tasks', spec(async () => {
    const called: string[] = [];
    await container.scope().inject(ScopeExit).run((scopeExit: ScopeExit) => {
      scopeExit.defer(() => called.push('defer1'));
      scopeExit.defer(() => called.push('defer2'));
      called.push('main');
    });
    expect(called).toEqual(['main', 'defer1', 'defer2']);
  }));

  it('could throw an error in a deferred task', spec(async () => {
    let called = false;
    let throwed = false;
    ScopeExit.registerErrorHook(e => { throwed = true; });
    await container.scope().inject(ScopeExit).run(async (scopeExit: ScopeExit) => {
      scopeExit.defer(() => { throw Error('haha'); });
      called = true;
    });
    expect(called).toBeTruthy();
    expect(throwed).toBeTruthy();
  }));

  it('should call error hooks only a deferred task throws', spec(async () => {
    let called = false;
    let throwed = false;
    ScopeExit.registerErrorHook(e => { throwed = true; });
    await container.scope().inject(ScopeExit).run(async (scopeExit: ScopeExit) => {
      called = true;
    });
    expect(called).toBeTruthy();
    expect(throwed).toBeFalsy();
  }));

  it('could have multiple error hooks', spec(async () => {
    let called = false;
    let throwed = 0;
    ScopeExit.registerErrorHook(e => throwed++);
    ScopeExit.registerErrorHook(e => throwed++);
    await container.scope().inject(ScopeExit).run(async (scopeExit: ScopeExit) => {
      scopeExit.defer(() => { throw Error('haha'); });
      called = true;
    });
    expect(called).toBeTruthy();
    expect(throwed).toBe(2);
  }));

  it('should call every hooks even any hook throws', spec(async () => {
    let throwed = 0;
    ScopeExit.registerErrorHook(e => throwed++);
    ScopeExit.registerErrorHook(e => { throw new Error('hoho'); });
    ScopeExit.registerErrorHook(e => throwed++);
    await container.scope().inject(ScopeExit).run(async (scopeExit: ScopeExit) => {
      scopeExit.defer(() => { throw Error('haha'); });
    });
    expect(throwed).toBe(2);
  }));
});
