import * as uuid from 'uuid';
import {
  AbstractError,
  AbstractFatalError,
  AbstractLogicError,
  FatalError,
  ISLAND,
  IslandLevel,
  LogicError,
  setIslandCode
} from '../utils/error';
import { RpcResponse } from '../utils/rpc-response';

describe('Error', () => {
  afterEach(() => {
    setIslandCode(100);
  });

  it('should identify island code', () => {
    setIslandCode(101);
    const logic = new LogicError(ISLAND.ERROR.E0031_WRONG_PARAMETER_SCHEMA);
    expect(logic.code).toEqual(10110031);

    setIslandCode(111);
    const fatal = new FatalError(ISLAND.ERROR.E0001_ISLET_ALREADY_HAS_BEEN_REGISTERED);
    expect(fatal.code).toEqual(11110001);
  });
  it('should identify island level', () => {
    class IslandLogicError extends AbstractLogicError {
      constructor(errorCode: ISLAND.ERROR) {
        super(100, 0, errorCode, '');
      }
    }
    const logic = new IslandLogicError(1);
    expect(logic.code).toEqual(10000001);
  });
  it('should have an unique id', () => {
    const e = new LogicError(ISLAND.ERROR.E0031_WRONG_PARAMETER_SCHEMA);
    expect(e.extra.uuid.split('-').length).toEqual(5);
  });
  it('should split code of an AbstractError', () => {
    setIslandCode(101);
    const e = new LogicError(ISLAND.ERROR.E0031_WRONG_PARAMETER_SCHEMA);
    const raw = e.split();
    expect(raw.islandCode).toEqual(101);
    expect(raw.islandLevel).toEqual(IslandLevel.ISLANDJS);
    expect(raw.islandLevelName).toEqual('ISLANDJS');
    expect(raw.errorCode).toEqual(ISLAND.ERROR.E0031_WRONG_PARAMETER_SCHEMA);
    /* {
      islandCode:  101,
      islandLevel: 1, islandLevelName: 'ISLANDJS',
      errorCode:   1
    } */
  });
  it('should merge numbers into a code', () => {
    const code = AbstractError.mergeCode(
      101,
      IslandLevel.ISLANDJS,
      ISLAND.ERROR.E0031_WRONG_PARAMETER_SCHEMA);
    expect(code).toEqual(10110031);
  });

  it('should added extra & statusCode via error options', () => {
    setIslandCode(101);
    const extra = { uuid: uuid.v4(), code: 1000003 };
    const statusCode = 999;
    const logic = new LogicError(ISLAND.ERROR.E0031_WRONG_PARAMETER_SCHEMA, '', { statusCode, extra });
    expect(logic.code).toEqual(10110031);
    expect(logic.extra).toEqual(extra);
    expect(logic.statusCode).toEqual(statusCode);

    setIslandCode(111);
    const fatal = new FatalError(ISLAND.ERROR.E0001_ISLET_ALREADY_HAS_BEEN_REGISTERED, '', { statusCode, extra });
    expect(fatal.code).toEqual(11110001);
    expect(fatal.extra).toEqual(extra);
    expect(fatal.statusCode).toEqual(statusCode);
  });
});

describe('Error decode', () => {
  afterEach(() => {
    setIslandCode(100);
  });

  it('encode-decode', () => {
    {
      const error = new LogicError(ISLAND.ERROR.E0031_WRONG_PARAMETER_SCHEMA);
      const decoded = RpcResponse.decode(RpcResponse.encode(error));
      expect(decoded.body instanceof AbstractLogicError).toBeTruthy();
      expect(decoded.body.code).toEqual(error.code);
    }

    {
      setIslandCode(101);
      const error = new FatalError(ISLAND.ERROR.E0001_ISLET_ALREADY_HAS_BEEN_REGISTERED);
      const encoded = RpcResponse.encode(error);
      setIslandCode(100);
      const decoded = RpcResponse.decode(encoded);
      expect(decoded.body instanceof AbstractFatalError).toBeTruthy();
      expect(decoded.body.code).toEqual(error.code);
    }
  });
});
