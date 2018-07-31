import { env, LoadEnv } from '../index';

describe('Environment Loader', () => {
  it('should sanitize number types', done => {
    process.env.NUMBER_WITH_DEFAULT_ENV = '10';
    process.env.NUMBER_WITH_INVALID_ENV = 'OH MY GOD';
    process.env.NUMBER_WITH_INVALID_ENV_WITH_DEFAULT = 'OH MY GOD';

    class ProcessEnv {
      @env({ required: false })
      public NUMBER_WITH_NO_DEFAULT: number;
      @env()
      public NUMBER_WITH_DEFAULT: number = 5;
      @env()
      public NUMBER_WITH_DEFAULT_ENV: number = 5;
      @env({ required: false })
      public NUMBER_WITH_INVALID_ENV: number;
      @env()
      public NUMBER_WITH_INVALID_ENV_WITH_DEFAULT: number = 5;

      constructor() {
        LoadEnv(this);
      }
    }

    const pe = new ProcessEnv();
    expect(pe.NUMBER_WITH_NO_DEFAULT).toBeUndefined();
    expect(pe.NUMBER_WITH_DEFAULT).toEqual(5);
    expect(pe.NUMBER_WITH_DEFAULT_ENV).toEqual(10);
    expect(pe.NUMBER_WITH_INVALID_ENV).toBeUndefined();
    expect(pe.NUMBER_WITH_INVALID_ENV_WITH_DEFAULT).toEqual(5);
    done();
  });

  it('should sanitize string types', done => {
    class ProcessEnv {
      @env()
      public STRING_WITH_DEFAULT: string = 'string';

      constructor() {
        LoadEnv(this);
      }
    }

    const pe = new ProcessEnv();
    expect(pe.STRING_WITH_DEFAULT).toEqual('string');
    done();
  });

  it('should sanitize boolean types', done => {
    process.env.BOOLEAN_1 = '1';
    process.env.BOOLEAN_0 = '0';
    process.env.NO_BOOLEAN = '';
    class ProcessEnv {
      @env()
      public BOOLEAN_WITH_DEFAULT_TRUE: boolean = true;
      @env()
      public BOOLEAN_WITH_DEFAULT_FALSE: boolean = false;
      @env()
      public BOOLEAN_1: boolean;
      @env()
      public BOOLEAN_0: boolean;
      @env({ required: false })
      public NO_BOOLEAN: boolean;

      constructor() {
        LoadEnv(this);
      }
    }

    const pe = new ProcessEnv();
    expect(pe.BOOLEAN_WITH_DEFAULT_TRUE).toEqual(true);
    expect(pe.BOOLEAN_WITH_DEFAULT_FALSE).toEqual(false);
    expect(pe.BOOLEAN_1).toEqual(true);
    expect(pe.BOOLEAN_0).toEqual(false);
    expect(pe.NO_BOOLEAN).toBeUndefined();
    done();
  });

  it(`should load values from first legacy key`, done => {
    process.env.ISLAND_SERVICE_NAME = '';
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
    expect(pe.ISLAND_SERVICE_NAME).toEqual(process.env.SERVICE_NAME);
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

    expect(() => new ProcessEnv()).toThrowError(/Environments/);
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

    expect(() => new ProcessEnv()).toThrowError(/Environments/);
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
