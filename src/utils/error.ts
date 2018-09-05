import * as assert from 'assert';
import * as _ from 'lodash';
import * as uuid from 'uuid';

export type ErrorLevelName = 'EXPECTED' | 'LOGIC' | 'FATAL' | 'ETC';
export enum ErrorLevel {
  EXPECTED  = 1,
  LOGIC     = 2,
  FATAL     = 3,
  RESERVED4 = 4,
  RESERVED5 = 5,
  RESERVED6 = 6,
  RESERVED7 = 7,
  RESERVED8 = 8,
  ETC       = 9
}
export interface ErrorOptions  {
  extra?: any;
  statusCode?: number;
}

export enum IslandLevel {
  ISLAND    = 0,
  ISLANDJS  = 1,
  UNKNOWN   = 2,
  RESERVED3 = 3,
  RESERVED4 = 4,
  RESERVED5 = 5,
  RESERVED6 = 6,
  RESERVED7 = 7,
  RESERVED8 = 8,
  RESERVED9 = 9
}

function mergeCode(islandCode: number, islandLevel: IslandLevel, errorCode: number) {
  return islandCode * 100000 +
         islandLevel * 10000 +
         errorCode;
}

let islandCode = 100; // UNKNOWN_ISLAND by convention

export function setIslandCode(code: number) {
  assert(100 <= code);
  assert(code < 1000);
  islandCode = code;
}

export function getIslandCode() {
  return islandCode;
}

export function toCode(errorCode: number) {
  return mergeCode(islandCode, IslandLevel.ISLAND, errorCode);
}

export function mergeIslandJsError(errorCode: number) {
  return mergeCode(islandCode, IslandLevel.ISLANDJS, errorCode);
}

/*
  1 0 1 0 0 0 0 1
  _____ _ _______
  |     | \_ errorCode
  |     \_ islandLevel
  \_ islandCode
*/
export class AbstractError extends Error {
  static splitCode(code) {
    const islandCode = Math.floor(code / 100000) % 1000;
    const islandLevel = Math.floor(code / 10000) % 10 as IslandLevel;
    const errorCode = code % 10000;
    return {
      islandCode,
      islandLevel,
      islandLevelName: IslandLevel[islandLevel],
      errorCode
    };
  }

  static mergeCode(islandCode: number, islandLevel: IslandLevel, errorCode: number) {
    return mergeCode(islandCode, islandLevel, errorCode);
  }

  static ensureUuid(extra: {[key: string]: any; uuid: string}) {
    if (extra.uuid) return extra;
    return _.merge({}, extra, {uuid: uuid.v4()});
  }

  public code: number;
  public reason: string;

  public statusCode: number;
  public stack: any;
  public extra: any;
  public tattoo: any;

  constructor(islandCode: number,
              islandLevel: IslandLevel,
              errorCode: number,
              reason: string,
              opts?: ErrorOptions) {
    const code = mergeCode(islandCode, islandLevel, errorCode);
    super(`${code}-${reason}`);
    this.code = code;
    this.reason = reason;
    this.extra = { uuid: uuid.v4() };
    if (opts && opts.extra) this.extra = _.merge(opts.extra, this.extra);
    if (opts && !_.isUndefined(opts.statusCode)) this.statusCode = opts.statusCode;
  }

  split() {
    return AbstractError.splitCode(this.code);
  }
}

export class AbstractExpectedError extends AbstractError {
  constructor(islandCode: number,
              islandLevel: IslandLevel,
              errorCode: number,
              reason: string,
              opts?: ErrorOptions) {
    super(islandCode, islandLevel, errorCode, reason, opts);
    this.name = 'ExpectedError';
  }
}

export class AbstractLogicError extends AbstractError {
constructor(islandCode: number,
            islandLevel: IslandLevel,
            errorCode: number,
            reason: string,
            opts?: ErrorOptions) {
    super(islandCode, islandLevel, errorCode, reason, opts);
    this.name = 'LogicError';
  }
}

export class AbstractFatalError extends AbstractError {
  constructor(islandCode: number,
              islandLevel: IslandLevel,
              errorCode: number,
              reason: string,
              opts?: ErrorOptions) {
    super(islandCode, islandLevel, errorCode, reason, opts);
    this.name = 'FatalError';
  }
}

export class AbstractEtcError extends AbstractError {
  constructor(islandCode: number,
              islandLevel: IslandLevel,
              errorCode: number,
              reason: string,
              opts?: ErrorOptions) {
    super(islandCode, islandLevel, errorCode, reason, opts);
    this.name = 'EtcError';
  }
}

export class LogicError extends AbstractLogicError {
  constructor(errorCode: ISLAND.ERROR, reason?: string, opts?: ErrorOptions) {
    super(islandCode, IslandLevel.ISLANDJS, errorCode, reason || '', opts);
  }
}

export class FatalError extends AbstractFatalError {
  constructor(errorCode: ISLAND.ERROR, reason?: string, opts?: ErrorOptions) {
    super(islandCode, IslandLevel.ISLANDJS, errorCode, reason || '', opts);
  }
}

export class ExpectedError extends AbstractExpectedError {
  constructor(errorCode: ISLAND.ERROR, reason?: string, opts?: ErrorOptions) {
    super(islandCode, IslandLevel.ISLANDJS, errorCode, reason || '', opts);
  }
}

export namespace ISLAND {
  export enum ERROR {
    E0001_ISLET_ALREADY_HAS_BEEN_REGISTERED   = 1,
    E0002_DUPLICATED_ADAPTER                  = 2,
    E0003_MISSING_ADAPTER                     = 3,
    E0004_NOT_IMPLEMENTED_ERROR               = 4,
    E0008_AMQP_CHANNEL_POOL_REQUIRED          = 8,
    E0011_NOT_INITIALIZED_EXCEPTION           = 11,
    E0012_ROUND_ROBIN_EVENT_Q_IS_NOT_DEFINED  = 12,
    E0013_NOT_INITIALIZED                     = 13,
    E0015_TAG_IS_UNDEFINED                    = 15,
    E0021_NOT_IMPLEMENTED_ERROR               = 21,
    E0022_NOT_INITIALIZED_EXCEPTION           = 22,
    E0023_RPC_TIMEOUT                         = 23,
    E0024_ENDPOINT_METHOD_REDECLARED          = 24,
    E0025_MISSING_ADAPTER_OPTIONS             = 25,
    E0026_MISSING_REPLYTO_IN_RPC              = 26,
    E0027_CONSUMER_IS_CANCELED                = 27,
    E0028_CONSUL_ERROR                        = 28,
    E0031_WRONG_PARAMETER_SCHEMA              = 31,
    E0032_MSG_PACK_ERROR                      = 32,
    E0033_MSG_PACK_ENCODE_ERROR               = 33,
    E0034_HANDLE_MESSAGE_ERROR                = 34,
    E0035_PUSH_ENCODE_ERROR                   = 35
  }
}
