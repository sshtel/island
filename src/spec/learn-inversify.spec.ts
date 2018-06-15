import 'reflect-metadata';
import 'source-map-support/register';
import { logger } from '../utils/logger';

import * as inversify from 'inversify';

const inject = (target: any, key: string, index: number) => {
  if (!Reflect.hasOwnMetadata('design:paramtypes', target)) {
    logger.error('metadata required');
    return;
  }
  const paramTypes = Reflect.getMetadata('design:paramtypes', target);
  return inversify.inject(paramTypes[index])(target, key, index);
};

const injectable = (target: any) => {
  if (Reflect.hasOwnMetadata('inversify:paramtypes', target) === true) {
    return;
  }
  return inversify.injectable()(target);
};

class KernelWrapper {
  private kernel = new inversify.Container();

  bindClass(aClass: any) {
    inversify.decorate(injectable, aClass);
    this.kernel.bind(aClass).to(aClass).when(request => !request.target.isNamed());
  }

  bindClassNamed(id, aClass, name) {
    inversify.decorate(injectable, aClass);
    this.kernel.bind(id).to(aClass).whenTargetNamed(name);
  }

  bindValue(name: string, value) {
    this.kernel.bind(name).toConstantValue(value);
  }

  get<T>(identifier: (string | inversify.interfaces.Newable<T>)): T {
    return this.kernel.get(identifier);
  }
}

class Foo {
  say() { return 'foo'; }
}

class Fooo {
  say() { return 'fooo'; }
}

class Baz {
  say() { return 'value'; }
}

class Bar {
  constructor( @inject private foo: Foo) {
  }

  letFooSay() { return this.foo.say(); }
}

describe('inversify', () => {
  const kernelWrapper = new KernelWrapper();
  beforeAll(() => {
    kernelWrapper.bindClass(Foo);
    kernelWrapper.bindClassNamed(Foo, Foo, 'foo');
    kernelWrapper.bindClassNamed(Foo, Fooo, 'fooo');
    kernelWrapper.bindClass(Bar);
    kernelWrapper.bindValue('Baz', new Baz());
  });

  it(`should inject Foo into Bar`, () => {
    const bar: Bar = kernelWrapper.get(Bar);
    expect(bar.letFooSay()).toBe('foo');
  });

  it(`should inject Value`, () => {
    expect(kernelWrapper.get<Baz>('Baz')).toEqual(jasmine.any(Baz));
  });
});
