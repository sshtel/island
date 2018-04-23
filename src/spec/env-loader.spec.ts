import { env, LoadEnv } from '../index';

describe('Environment Loader', () => {
  it('should sanitize number types', done => {
    class ProcessEnv {
      @env({ required: false })
      public NUMBER_WITH_NO_DEFAULT: number;
      @env({ default: 5 })
      public NUMBER_WITH_DEFAULT: number;
      @env({ default: '5' })
      public NUMBER_WITH_WRONG_DEFAULT: number;
      @env({ default: '5A' })
      public NUMBER_WITH_WRONG_DEFAULT2: number;
      @env({ default: '011' })
      public NUMBER_DEFAULT_IGNORE_8: number;
      @env({ default: '0x11', required: true })
      public NUMBER_DEFAULT_IGNORE_16: number;

      constructor() {
        LoadEnv(this);
      }
    }

    const pe = new ProcessEnv();
    expect(pe.NUMBER_WITH_NO_DEFAULT).toBeUndefined();
    expect(pe.NUMBER_WITH_DEFAULT).toEqual(5);
    expect(pe.NUMBER_WITH_WRONG_DEFAULT).toEqual(5);
    expect(pe.NUMBER_WITH_WRONG_DEFAULT2).toEqual(5);
    expect(pe.NUMBER_DEFAULT_IGNORE_8).toEqual(11);
    expect(pe.NUMBER_DEFAULT_IGNORE_16).toEqual(0);
    done();
  });

  it('should sanitize string types', done => {
    class ProcessEnv {
      @env({ default: 'string' })
      public STRING_WITH_DEFAULT: string;
      @env({ default: 5722 })
      public STRING_WITH_WRONG_DEFAULT: string;
      @env({ default: new Date('2018-07-22') })
      public STRING_WITH_WRONG_DEFAULT2: string;

      constructor() {
        LoadEnv(this);
      }
    }

    const pe = new ProcessEnv();
    expect(pe.STRING_WITH_DEFAULT).toEqual('string');
    expect(pe.STRING_WITH_WRONG_DEFAULT).toEqual('5722');
    expect(typeof pe.STRING_WITH_WRONG_DEFAULT2).toEqual('string');
    done();
  });

  it('should sanitize boolean types', done => {
    class ProcessEnv {
      @env({ default: true })
      public BOOLEAN_WITH_DEFAULT_TRUE: boolean;
      @env({ default: false })
      public BOOLEAN_WITH_DEFAULT_FALSE: boolean;
      @env({ default: 'true' })
      public BOOLEAN_WITH_DEFAULT_TRUE_STRING: boolean;
      @env({ default: 'false' })
      public BOOLEAN_WITH_DEFAULT_FALSE_STRING: boolean;
      @env({ default: 'ture' })
      public BOOLEAN_WITH_DEFAULT_WRONG_ANY_STRING: boolean;
      @env({ default: 2 })
      public BOOLEAN_WITH_DEFAULT_2: boolean;
      @env({ default: 1 })
      public BOOLEAN_WITH_DEFAULT_1: boolean;
      @env({ default: 0 })
      public BOOLEAN_WITH_DEFAULT_0: boolean;

      constructor() {
        LoadEnv(this);
      }
    }

    const pe = new ProcessEnv();
    expect(pe.BOOLEAN_WITH_DEFAULT_TRUE).toEqual(true);
    expect(pe.BOOLEAN_WITH_DEFAULT_FALSE).toEqual(false);
    expect(pe.BOOLEAN_WITH_DEFAULT_TRUE_STRING).toEqual(true);
    expect(pe.BOOLEAN_WITH_DEFAULT_FALSE_STRING).toEqual(false);
    expect(pe.BOOLEAN_WITH_DEFAULT_WRONG_ANY_STRING).toEqual(true);
    expect(pe.BOOLEAN_WITH_DEFAULT_2).toEqual(true);
    expect(pe.BOOLEAN_WITH_DEFAULT_1).toEqual(true);
    expect(pe.BOOLEAN_WITH_DEFAULT_0).toEqual(false);
    done();
  });

  it(`should load values from first legacy key`, done => {
    process.env.SERVICE_NAME = 'SERVICE_NAME';
    process.env.DUMMY_NAME = 'DUMMY_NAME';
    class ProcessEnv {
      @env({ legacyKeys: ['SERVICE_NAME', 'DUMMY_NAME'] })
      public ISLAND_SERVICE_NAME: string;

      constructor() {
        LoadEnv(this);
      }
    }

    const pe = new ProcessEnv();
    expect(pe.ISLAND_SERVICE_NAME).toEqual('SERVICE_NAME');
    done();
  });

  it(`should load values from same name environment first`, done => {
    process.env.SERVICE_NAME = 'SERVICE_NAME';
    process.env.ISLAND_SERVICE_NAME = 'ISLAND_SERVICE_NAME';
    class ProcessEnv {
      @env({ legacyKeys: ['SERVICE_NAME', 'DUMMY_NAME'] })
      public ISLAND_SERVICE_NAME: string;

      constructor() {
        LoadEnv(this);
      }
    }

    const pe = new ProcessEnv();
    expect(pe.ISLAND_SERVICE_NAME).toEqual('ISLAND_SERVICE_NAME');
    done();
  });

  it(`should throw error eq test`, done => {
    process.env.ISLAND_LOGGER_TYPE = 'shrt';
    class ProcessEnv {
      @env({ eq: ['short', 'long', 'json'] })
      public ISLAND_LOGGER_TYPE: string;

      constructor() {
        LoadEnv(this);
      }
    }

    expect(() => new ProcessEnv()).toThrowError(/ISLAND_LOGGER_TYPE/);
    done();
  });

  it(`should throw error pattern test`, done => {
    process.env.ISLAND_LOGGER_TYPE = 'shrt';
    class ProcessEnv {
      @env({ pattern: /(^short$|^json$|^long$)/ })
      public ISLAND_LOGGER_TYPE: string;

      constructor() {
        LoadEnv(this);
      }
    }

    expect(() => new ProcessEnv()).toThrowError(/ISLAND_LOGGER_TYPE/);
    done();
  });

  it(`should not throw error pattern test`, done => {
    process.env.ISLAND_LOGGER_TYPE = 'short';
    class ProcessEnv {
      @env({ pattern: /(^short$|^json$|^long$)/ })
      public ISLAND_LOGGER_TYPE: string;

      constructor() {
        LoadEnv(this);
      }
    }

    expect(() => new ProcessEnv()).not.toThrow();
    done();
  });

  it(`should throw error required field`, done => {
    delete process.env.ISLAND_LOGGER_TYPE;
    class ProcessEnv {
      @env({ required: true })
      public ISLAND_LOGGER_TYPE: string;

      constructor() {
        LoadEnv(this);
      }
    }

    expect(() => new ProcessEnv()).toThrowError();
    done();
  });

  afterAll(async done => {
    done();
  });
});
