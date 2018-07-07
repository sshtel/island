import * as _ from 'lodash';
import { Environments } from '../utils/environments';
import { FatalError, ISLAND } from '../utils/error';

export enum EnsureOptions {
  TOKEN = 1,
  SESSION = 2,
  CONNECTION = 3
}

export interface EndpointOptions {
  scope?: {
    resource: number;
    authority: number;
  };
  version?: string;
  schema?: EndpointSchemaOptions;
  developmentOnly?: boolean;
  ignoreSession?: boolean;
  level?: number;
  admin?: boolean;
  ensure?: number;
  quota?: EndpointUserQuotaOptions;
  serviceQuota?: EndpointServiceQuotaOptions;
  extra?: { [key: string]: any };
  sessionGroup?: string;
}

export interface EndpointUserQuotaOptions {
  limit?: number;
  banSecs?: number;
  group?: string[];
}

export interface EndpointServiceQuotaOptions {
  limit?: number;
  group?: string[];
}

export interface EndpointSchemaOptions {
  body?: {
    sanitization?: any;
    validation?: any;
  };
  query?: {
    sanitization?: any;
    validation?: any;
  };
  params?: {
    sanitization?: any;
    validation?: any;
  };
  session?: {
    sanitization?: any;
    validation?: any;
  };
  result?: {
    sanitization?: any;
    validation?: any;
  };
}

type PrimitiveTypeNames = 'string' | 'number' | 'integer' | 'boolean' | 'null';
type ObjectTypeNames = 'date' | 'object' | 'array' | 'any';
type CustomTypeNames = '$oid' | '$cider' | '$numberOrQuery' | '$html';

type SchemaInspectorProperty = {
  optional?: boolean;
  def?: any;
  type?: PrimitiveTypeNames | ObjectTypeNames | CustomTypeNames;
  properties?: any;
  items?: any | [any];
  __langid?: string;
};

function makeDecorator<Property>(func, type, subType) {
  return (obj: Property | { [key: string]: Property } | [Property]) => {
    return (target, key, desc: PropertyDescriptor) => {
      const options = desc.value.options = (desc.value.options || {}) as EndpointOptions;
      _.merge(options, { schema: { [subType]: { [type]: func(obj) } } });
      if (desc.value.endpoints) {
        desc.value.endpoints.forEach(e => _.merge(e.options, options));
      }
    };
  };
}

export namespace sanitize {
  // tslint:disable-next-line class-name
  export interface _ObjectId { $sanitize: Symbol; }
  export const ObjectId: _ObjectId = { $sanitize: Symbol() };
  // tslint:disable-next-line class-name
  export interface _Cider { $sanitize: Symbol; }
  export const Cider: _Cider = { $sanitize: Symbol() };
  // tslint:disable-next-line class-name
  export interface _Any { $sanitize: Symbol; }
  export const Any: _Any = { $sanitize: Symbol() };
  // tslint:disable-next-line class-name
  export interface _NumberOrQuery { $sanitize: Symbol; }
  export const NumberOrQuery: _NumberOrQuery = { $sanitize: Symbol() };

  // tslint:disable-next-line class-name
  export interface __Number {
    def?: number;
    min?: number;
    max?: number;
    strict?: boolean;
  }

  // tslint:disable-next-line class-name
  export class _Number implements __Number {
    def?: number;
    min?: number;
    max?: number;
    strict?: boolean;

    constructor({ def, min, max, strict }: __Number) {
      this.def = def;
      this.min = min;
      this.max = max;
      this.strict = strict;
    }
  }

  export function Number({ def, min, max, strict }: __Number) {
    return new _Number({ def, min, max, strict });
  }

  export type _StringRules = 'upper' | 'lower' | 'title' | 'capitalize' | 'ucfirst' | 'trim';

  // tslint:disable-next-line
  export interface __String {
    def?: string;
    rules?: _StringRules | _StringRules[];
    minLength?: number;
    maxLength?: number;
    strict?: boolean;
  }

  // tslint:disable-next-line
  export class _String implements __String {
    def?: string;
    rules?: _StringRules | _StringRules[];
    minLength?: number;
    maxLength?: number;
    strict?: boolean;

    constructor({ def, rules, minLength, maxLength, strict }: __String) {
      this.def = def;
      this.rules = rules;
      this.minLength = minLength;
      this.maxLength = maxLength;
      this.strict = strict;
    }
  }

  export function String({ def, rules, minLength, maxLength, strict }: __String) {
    return new _String({ def, rules, minLength, maxLength, strict });
  }

  // tslint:disable-next-line
  export interface __Object {
    def?: Object;
  }

  // tslint:disable-next-line
  export class _Object {
    properties: { [key: string]: SanitizePropertyTypes } | undefined;
    def?: Object;

    constructor(obj?: { [key: string]: SanitizePropertyTypes }, opts?: __Object | undefined) {
      opts = opts || {};
      this.properties = obj;
      this.def = opts.def;
    }
  }

  // tslint:disable-next-line
  export function Object(obj: { [key: string]: SanitizePropertyTypes }, opts?: __Object) {
    return new _Object(obj, opts);
  }

  // tslint:disable-next-line
  export class _Array {
    items: SanitizePropertyTypes[];

    constructor(items: SanitizePropertyTypes[]) {
      this.items = items;
    }
  }

  export function Array(items: SanitizePropertyTypes[]) {
    return new _Array(items);
  }

  export type SanitizePropertyTypes =
    typeof global.String | string | _String |
    typeof global.Number | number | _Number |
    typeof Boolean | boolean |
    typeof Date | _Object | _Array | _Any |
    _ObjectId | _Cider | _NumberOrQuery;

  // tslint:disable-next-line cyclomatic-complexity
  function parseSanitization(property: SchemaInspectorProperty, value: SanitizePropertyTypes) {
    if (value === undefined) return;

    if (value === global.String) {
      property.type = 'string';
    } else if (typeof value === 'string') {
      property.type = 'string';
      property.def = value;
    } else if (value instanceof _String) {
      property.type = 'string';
      _.merge(property, value);
    } else if (value === global.Number) {
      property.type = 'number';
    } else if (typeof value === 'number') {
      property.type = 'number';
      property.def = value;
    } else if (value instanceof _Number) {
      property.type = 'number';
      _.merge(property, value);
    } else if (value === Boolean) {
      property.type = 'boolean';
    } else if (value === Date) {
      property.type = 'date';
    } else if (value instanceof _Object) {
      property.type = 'object';
      property.properties = sanitizeAsObject(value.properties);
      _.defaults(property, value);
    } else if (value instanceof _Array) {
      property.type = 'array';
      property.items = sanitizeAsArray(value.items);
    } else if (value === ObjectId) {
      property.type = '$oid';
    } else if (value === Cider) {
      property.type = '$cider';
    } else if (value === NumberOrQuery) {
      property.type = '$numberOrQuery';
    }
    return _.omitBy(property, _.isUndefined);
  }

  // schema-inspector 문법은 array에 들어올 수 있는 타입을 한 개 이상 받을 수 있게 되어있지만
  // 여기서는 가장 첫번째 한 개만 처리하고 있다. 인터페이스 구조상 여러 개도 처리할 수 있지만 단순히 안 한 것 뿐이다.
  // @kson //2016-08-04
  function sanitizeAsArray(items: SanitizePropertyTypes[]) {
    if (!items) return;
    const item = items[0];
    const property: SchemaInspectorProperty = { optional: true };
    return parseSanitization(property, item);
  }

  // sanitization은 optional의 기본값이 true
  // https://github.com/Atinux/schema-inspector#s_optional
  // 헷갈리니까 생략하면 기본값, !는 required, ?는 optional로 양쪽에서 동일한 규칙을 쓰도록 한다
  // [example] validate: { a: 1, 'b?': 1, 'c!': 1 } - required / optional / required
  // [example] sanitize: { a: 1, 'b?': 1, 'c!': 1 } - optional / optional / required
  function sanitizeAsObject(obj: { [key: string]: SanitizePropertyTypes } | undefined) {
    if (!obj) return;

    const properties: { [key: string]: SchemaInspectorProperty | undefined } = {};
    _.each(obj, (value, key: string) => {
      const property: SchemaInspectorProperty = { optional: true };
      if (key.endsWith('?')) {
        property.optional = true;
        key = key.slice(0, -1);
      } else if (key.endsWith('!')) {
        property.optional = false;
        key = key.slice(0, -1);
      }
      if (key.includes('+')) {
        const [a] = key.split('+', 1);
        property.__langid = key;
        key = a;
      }
      properties[key] = parseSanitization(property, value);
    });
    return properties;
  }

  // tslint:disable-next-line cyclomatic-complexity
  function isPlainObject(target: SanitizePropertyTypes | { [key: string]: SanitizePropertyTypes }) {
    if (
      target instanceof _Number ||
      target instanceof _String ||
      target instanceof _Object ||
      target instanceof _Array ||
      target === global.Number ||
      target === global.String ||
      target === Boolean ||
      target === ObjectId ||
      target === Cider ||
      target === NumberOrQuery ||
      target === Any
    ) {
      return false;
    }
    return true;
  }

  export function sanitize(target: SanitizePropertyTypes |
    { [key: string]: SanitizePropertyTypes } |
    [SanitizePropertyTypes]): any {
    if (global.Array.isArray(target)) {
      return {
        items: sanitizeAsArray(target),
        type: 'array'
      };
      // 여기 내려오면 obj는 배열이 아니니까 [xxx]는 타입 추론에서 제외되어야 하는데 잡아주질 못하고 있다
      // 2.x에는 아마 가능할 것 같은 느낌.  @kson //2016-08-03
    } else if (isPlainObject(target)) {
      return {
        properties: sanitizeAsObject(target as { [key: string]: SanitizePropertyTypes }),
        type: 'object'
      };
    }
    return parseSanitization({}, target as SanitizePropertyTypes);
  }

  export const body = makeDecorator<SanitizePropertyTypes>(sanitize, 'sanitization', 'body');
  export const params = makeDecorator<SanitizePropertyTypes>(sanitize, 'sanitization', 'params');
  export const query = makeDecorator<SanitizePropertyTypes>(sanitize, 'sanitization', 'query');
  export const result = makeDecorator<SanitizePropertyTypes>(sanitize, 'sanitization', 'result');
  export const session = makeDecorator<SanitizePropertyTypes>(sanitize, 'sanitization', 'session');
  export const user = makeDecorator<SanitizePropertyTypes>(sanitize, 'sanitization', 'user');
}

export namespace validate {
  // tslint:disable-next-line class-name
  export interface _ObjectId { $validate: Symbol; }
  export const ObjectId: _ObjectId = { $validate: Symbol() };
  // tslint:disable-next-line class-name
  export interface _Cider { $validate: Symbol; }
  export const Cider: _Cider = { $validate: Symbol() };
  // tslint:disable-next-line class-name
  export interface _NumberOrQuery { $validate: Symbol; }
  export const NumberOrQuery: _NumberOrQuery = { $validate: Symbol() };
  // tslint:disable-next-line class-name
  export interface _Any { $validate: Symbol; }
  export const Any: _Any = { $validate: Symbol() };
  // tslint:disable-next-line class-name
  export interface _Html { $validate: Symbol; }
  export const Html: _Html = { $validate: Symbol() };

  // tslint:disable-next-line class-name
  export interface __Number {
    lt?: number;
    lte?: number;
    gt?: number;
    gte?: number;
    eq?: number | number[];
    ne?: number;
  }

  // tslint:disable-next-line class-name
  export class _Number implements __Number {
    lt?: number;
    lte?: number;
    gt?: number;
    gte?: number;
    eq?: number | number[];
    ne?: number;

    constructor({ lt, lte, gt, gte, eq, ne }: __Number) {
      this.lt = lt;
      this.lte = lte;
      this.gt = gt;
      this.gte = gte;
      this.eq = eq;
      this.ne = ne;
    }
  }

  export function Number({ lt, lte, gt, gte, eq, ne }: __Number) {
    return new _Number({ lt, lte, gt, gte, eq, ne });
  }

  // tslint:disable-next-line class-name
  export interface __String {
    minLength?: number;
    maxLength?: number;
    exactLength?: number;
    eq?: Array<string> | string;
    ne?: Array<string> | string;
  }

  // tslint:disable-next-line class-name
  export class _String implements __String {
    minLength?: number;
    maxLength?: number;
    exactLength?: number;
    eq?: Array<string> | string;
    ne?: Array<string> | string;

    constructor({ minLength, maxLength, exactLength, eq, ne }: __String) {
      this.minLength = minLength;
      this.maxLength = maxLength;
      this.exactLength = exactLength;
      this.eq = eq;
      this.ne = ne;
    }
  }

  export function String({ minLength, maxLength, exactLength, eq, ne }: __String) {
    return new _String({ minLength, maxLength, exactLength, eq, ne });
  }

  // tslint:disable-next-line class-name
  export class _Object {
    properties: { [key: string]: ValidatePropertyTypes } | undefined;

    constructor(obj: { [key: string]: ValidatePropertyTypes } | undefined) {
      this.properties = obj;
    }
  }

  export function Object(obj?: { [key: string]: ValidatePropertyTypes }) {
    return new _Object(obj);
  }

  // tslint:disable-next-line class-name
  export interface __Array {
    minLength?: number;
    maxLength?: number;
    exactLength?: number;
  }

  // tslint:disable-next-line class-name
  export class _Array {
    items: [ValidatePropertyTypes] | undefined;
    minLength?: number;
    maxLength?: number;
    exactLength?: number;

    constructor(items: [ValidatePropertyTypes] | undefined, opts: __Array | undefined) {
      opts = opts || {};
      this.items = items;
      this.minLength = opts.minLength;
      this.maxLength = opts.maxLength;
      this.exactLength = opts.exactLength;
    }
  }

  export function Array(items?: [ValidatePropertyTypes], opts?: __Array) {
    return new _Array(items, opts);
  }

  export type ValidatePropertyTypes =
    typeof global.String | string | _String |
    typeof global.Number | number | _Number |
    typeof Boolean | typeof Date | _Object | _Array | _Any |
    _ObjectId | _Cider | _NumberOrQuery | _Html;

  // tslint:disable-next-line cyclomatic-complexity
  function parseValidation(property: SchemaInspectorProperty, value: ValidatePropertyTypes) {
    if (value === global.String) {
      property.type = 'string';
    } else if (value instanceof _String) {
      property.type = 'string';
      _.merge(property, value);
    } else if (value === global.Number) {
      property.type = 'number';
    } else if (value instanceof _Number) {
      property.type = 'number';
      _.merge(property, value);
    } else if (value === Boolean) {
      property.type = 'boolean';
    } else if (value === Date) {
      property.type = 'date';
    } else if (value instanceof _Object) {
      property.type = 'object';
      property.properties = validateAsObject(value.properties);
    } else if (value instanceof _Array) {
      property.type = 'array';
      _.defaults(property, validateAsArrayWithOptions(value));
    } else if (value === Any) {
      property.type = 'any';
    } else if (value === ObjectId) {
      property.type = '$oid';
    } else if (value === Cider) {
      property.type = '$cider';
    } else if (value === NumberOrQuery) {
      property.type = '$numberOrQuery';
    } else if (value === Html) {
      property.type = '$html';
    }
    return _.omitBy(property, _.isUndefined);
  }

  // schema-inspector 문법은 array에 들어올 수 있는 타입을 한 개 이상 받을 수 있게 되어있지만
  // 여기서는 가장 첫번째 한 개만 처리하고 있다. 인터페이스 구조상 여러 개도 처리할 수 있지만 단순히 안 한 것 뿐이다.
  // @kson //2016-08-04
  function validateAsArray(items?: ValidatePropertyTypes[]) {
    if (!items) return;
    const item = items[0];
    const property: SchemaInspectorProperty = { optional: false };
    return parseValidation(property, item);
  }

  // v.Array로 선언되어 Option이 있는 경우 이 함수가 사용된다.
  function validateAsArrayWithOptions(obj?: { items?: ValidatePropertyTypes[], opts?: __Array }) {
    obj = obj || {};
    if (!obj.items) return;
    const item = obj.items as any;
    const property: SchemaInspectorProperty = { optional: false };

    _.each(obj, (value, key: string) => {
      if (key === 'items') {
        property.items = validateAsArray(item);
      } else {
        property[key] = value;
      }
    });
    return parseValidation(property, item);
  }
  // validation의 optional의 기본값은 false
  // https://github.com/Atinux/schema-inspector#v_optional
  // 헷갈리니까 생략하면 기본값, !는 required, ?는 optional로 양쪽에서 동일한 규칙을 쓰도록 한다
  // [example] validate: { a: 1, 'b?': 1, 'c!': 1 } - required / optional / required
  // [example] sanitize: { a: 1, 'b?': 1, 'c!': 1 } - optional / optional / required
  function validateAsObject(obj?: { [key: string]: ValidatePropertyTypes }) {
    if (!obj) return;

    const properties: { [key: string]: SchemaInspectorProperty } = {};
    _.each(obj, (value, key: string) => {
      const property: SchemaInspectorProperty = { optional: false };
      if (key.endsWith('?')) {
        property.optional = true;
        key = key.slice(0, -1);
      } else if (key.endsWith('!')) {
        property.optional = false;
        key = key.slice(0, -1);
      }
      if (key.includes('+')) {
        const [a] = key.split('+', 1);
        property.__langid = key;
        key = a;
      }
      properties[key] = parseValidation(property, value);
    });
    return properties;
  }

  // tslint:disable-next-line cyclomatic-complexity
  function isPlainObject(target: ValidatePropertyTypes | { [key: string]: ValidatePropertyTypes }) {
    if (
      target instanceof _Number ||
      target instanceof _String ||
      target instanceof _Object ||
      target instanceof _Array ||
      target === global.Number ||
      target === global.String ||
      target === Boolean ||
      target === ObjectId ||
      target === Cider ||
      target === NumberOrQuery ||
      target === Any
    ) {
      return false;
    }
    return true;
  }

  export function validate(target: ValidatePropertyTypes |
    { [key: string]: ValidatePropertyTypes } |
    [ValidatePropertyTypes]): {[key: string]: any} {
    if (global.Array.isArray(target)) {
      // 여기에서 체크된 Array는 option이 없는 경우이다.
      return {
        items: validateAsArray(target),
        type: 'array'
      };
      // 여기 내려오면 obj는 배열이 아니니까 [ValidatePropertyTypes]는 타입 추론에서 제외되어야 하는데 잡아주질 못하고 있다
      // 2.x에는 아마 가능할 것 같은 느낌.  @kson //2016-08-03
    } else if (isPlainObject(target)) {
      return {
        properties: validateAsObject(target as { [key: string]: ValidatePropertyTypes }),
        type: 'object'
      };
    }
    return parseValidation({}, target as ValidatePropertyTypes);
  }

  export const body = makeDecorator<ValidatePropertyTypes>(validate, 'validation', 'body');
  export const params = makeDecorator<ValidatePropertyTypes>(validate, 'validation', 'params');
  export const query = makeDecorator<ValidatePropertyTypes>(validate, 'validation', 'query');
  export const result = makeDecorator<ValidatePropertyTypes>(validate, 'validation', 'result');
  export const session = makeDecorator<ValidatePropertyTypes>(validate, 'validation', 'session');
  export const user = makeDecorator<ValidatePropertyTypes>(validate, 'validation', 'user');
}

// Login ensure 레벨을 지정
// TOKEN : 토큰 확인
// SESSION : SESSION 확인
// CONNECTION : client의 push-island 연결 확인
//
// [EXAMPLE]
// @island.ensure(island.EnsureOptions.CONNECTION)
// @island.ensure(3)
// @island.endpoint('...', { ensure: island.EnsureOptions.CONNECTION })
export function ensure(ensure: number) {
  return (target, key, desc: PropertyDescriptor) => {
    const options = desc.value.options = (desc.value.options || {}) as EndpointOptions;
    options.ensure = (ensure || options.ensure) || EnsureOptions.TOKEN;
    if (desc.value.endpoints) {
      desc.value.endpoints.forEach(e => _.merge(e.options, options));
    }
  };
}

// - request에 session을 붙이지 않도록 해준다.
// - session이 필요하지 않은 endpoint에 사용.
//
// [EXAMPLE]
// @island.nosession()
// @island.endpoint('...', { ignoreSession: true })
export function nosession() {
  return (target, key, desc: PropertyDescriptor) => {
    const options = desc.value.options = (desc.value.options || {}) as EndpointOptions;
    options.ignoreSession = true;
    if (desc.value.endpoints) {
      desc.value.endpoints.forEach(e => _.merge(e.options, options));
    }
  };
}

// - EndpointOptions#level 속성의 Syntactic Sugar 이다
// - @endpoint 데코레이터의 옵션에서 레벨을 선언하는 것과 @auth 데코레이터의 효과는 동일하다
// - 선언이 중복될 경우 높은 레벨이 남는다
// - 어떤 순서로 선언되어도 효과는 동일하다
//
// [EXAMPLE]
// @island.auth(10)
// @island.endpoint('...', { level: 10 })
export function auth(level: number) {
  return (target, key, desc: PropertyDescriptor) => {
    const options = desc.value.options = (desc.value.options || {}) as EndpointOptions;
    options.level = Math.max(options.level || 0, level);
    if (desc.value.endpoints) {
      desc.value.endpoints.forEach(e => _.merge(e.options, options));
    }
  };
}

// - EndpointOptions#level, EndpointOptions#admin 속성의 Syntactic Sugar 이다
// [EXAMPLE]
// @island.endpoint('GET /v2/a', {})
// @island.admin
// @island.endpoint('GET /v2/b', {})
export function admin(target, key, desc) {
  const options = desc.value.options = (desc.value.options || {}) as EndpointOptions;
  options.level = Math.max(options.level || 0, 9);
  options.admin = true;
  if (desc.value.endpoints) {
    desc.value.endpoints.forEach(e => {
      _.merge(e.options, options);
    });
  }
}

// - 예외적인 케이스로 인해 특정 endpoint의 호출을 제어하고자 할 때 사용 한다
// - 2017.07.21
// - nosession, devonly도 점차적으로 extra 데코레이터를 쓰도록 가이드해야 한다
// [EXAMPLE] admin API 이외에 내부망의 전용 gateway를 통해서만 통신해야만 하는 endpoint의 경우
// @island.auth(0)
// @island.extra({internal: true})
// @island.endpoint('GET /v2/c', {})
export function extra(extra: { [key: string]: any }) {
  return (target, key, desc: PropertyDescriptor) => {
    const options = desc.value.options = (desc.value.options || {}) as EndpointOptions;
    options.extra = extra || {};
    if (desc.value.endpoints) {
      desc.value.endpoints.forEach(e => _.merge(e.options, options));
    }
  };
}

export function devonly(target, key, desc) {
  const options = desc.value.options = (desc.value.options || {}) as EndpointOptions;
  options.developmentOnly = true;
  if (desc.value.endpoints) {
    desc.value.endpoints.forEach(e => {
      _.merge(e.options, options);
    });
  }
}

export function mangle(name) {
  return name.replace(' ', '@').replace(/\//g, '|');
}

function pushSafe(object, arrayName, element) {
  const array = object[arrayName] = object[arrayName] || [];
  array.push(element);
}

// endpoint에 userQuota를 설정한다.
//
// [EXAMPLE]
// @island.quota(1, 2)
// @island.endpoint('...')
export function quota(limit: number, banSecs: number) {
  return (target, key, desc: PropertyDescriptor) => {
    const options = desc.value.options = (desc.value.options || {}) as EndpointOptions;
    options.quota = options.quota || {};
    options.quota.limit = Number(limit);
    options.quota.banSecs = Number(banSecs);
    if (desc.value.endpoints) {
      desc.value.endpoints.forEach(e => _.merge(e.options, options));
    }
  };
}
// endpoint에 serviceGroupQuota를 설정한다.
//
// [EXAMPLE]
// @island.groupServiceQuota([group1, gropu2])
// @island.endpoint('...')
export function groupServiceQuota(group: string[]) {
  return (target, key, desc: PropertyDescriptor) => {
    const options = desc.value.options = (desc.value.options || {}) as EndpointOptions;
    options.serviceQuota = options.serviceQuota || {};
    options.serviceQuota.group = group;
    if (desc.value.endpoints) {
      desc.value.endpoints.forEach(e => _.merge(e.options, options));
    }
  };
}
//
// endpoint에 quota Group을 설정한다.
//
// [EXAMPLE]
// @island.groupQuota([group1, gropu2])
// @island.endpoint('...')
export function groupQuota(group: string[]) {
  return (target, key, desc: PropertyDescriptor) => {
    const options = desc.value.options = (desc.value.options || {}) as EndpointOptions;
    options.quota = options.quota || {};
    options.quota.group = group;
    if (desc.value.endpoints) {
      desc.value.endpoints.forEach(e => _.merge(e.options, options));
    }
  };
}
// endpoint에 sessionGroup을 설정한다. sessionGroup이 설정된 endpoint는 해당 sessionGroup에 해당하는 session 정보만을 전달받게 된다.
// 설정하지 않을 경우 environments.getEndpointSessionGroup()을 기본으로 참고한다.
//
// [EXAMPLE]
// @island.sessionGroup(group)
// @island.endpoint('...')
export function sessionGroup(group: string) {
  return (target, key, desc: PropertyDescriptor) => {
    const options = desc.value.options = (desc.value.options || {}) as EndpointOptions;
    options.sessionGroup = group;
    if (desc.value.endpoints) {
      desc.value.endpoints.forEach(e => _.merge(e.options, options));
    }
  };
}
interface Endpoint {
  name: string;
  options: EndpointOptions;
  handler: (req) => Promise<any>;
}

export interface EndpointDecorator {
  (name: string, endpointOptions?: EndpointOptions): (target, key, desc: PropertyDescriptor) => any;
  get: (name: string, endpointOptions?: EndpointOptions) => (target, key, desc: PropertyDescriptor) => any;
  post: (name: string, endpointOptions?: EndpointOptions) => (target, key, desc: PropertyDescriptor) => any;
  put: (name: string, endpointOptions?: EndpointOptions) => (target, key, desc: PropertyDescriptor) => any;
  del: (name: string, endpointOptions?: EndpointOptions) => (target, key, desc: PropertyDescriptor) => any;
}

// - 컨트롤러 메소드 하나에 여러 endpoint를 붙일 수 있다.
//
// [EXAMPLE]
// @island.endpoint('GET /v2/blahblah', { level: 10, developmentOnly: true })
export const endpoint: EndpointDecorator = (() => {
  const decorator: any = makeEndpointDecorator();
  decorator.get = makeEndpointDecorator('GET');
  decorator.post = makeEndpointDecorator('POST');
  decorator.put = makeEndpointDecorator('PUT');
  decorator.del = makeEndpointDecorator('DEL');
  return decorator;
})();

function throwIfRedeclared(name) {
  const [method, uri] = name.split(' ');
  if (!method || !uri) return;
  if (['GET', 'POST', 'PUT', 'DEL'].indexOf(method.toUpperCase()) > -1) {
    throw new FatalError(ISLAND.FATAL.F0024_ENDPOINT_METHOD_REDECLARED);
  }
}

function makeEndpointDecorator(method?: string) {
  // FIXME name -> URI?
  return (name: string, endpointOptions?: EndpointOptions) => {
    if (method) {
      throwIfRedeclared(name);
    }
    return (target, key, desc: PropertyDescriptor) => {
      const handler = desc.value;
      const options = _.merge({}, handler.options || {}, endpointOptions) as EndpointOptions;
      if (!options.hasOwnProperty('level')) {
        options.level = 7;
      }
      if (!options.hasOwnProperty('ensure')) {
        options.ensure = EnsureOptions.TOKEN;
      }

      name = [method, name].filter(Boolean).join(' ');
      const endpoint = { name, options, handler } as Endpoint;
      pushSafe(handler, 'endpoints', endpoint);

      const constructor = target.constructor;
      pushSafe(constructor, '_endpointMethods', endpoint);
    };
  };
}

export function endpointController(registerer?: {
  registerEndpoint: (name: string, value: any) => void,
  saveEndpoint: () => Promise<any>
}) {
  return target => {
    const _initialize = target.prototype.initialize;
    const _onInitialized = target.prototype.onInitialized;

    // tslint:disable-next-line
    target.prototype.initialize = async function () {
      const _listen = this._server.listen;
      if (_listen && !_listen.isRegister) {
        // tslint:disable-next-line
        this._server.listen = async function () {
          if (registerer) {
            await registerer.saveEndpoint();
          }
          return _listen.apply(this);
        };
        this._server.listen.isRegister = true;
      }
      return _initialize.apply(this);
    };
    // tslint:disable-next-line
    target.prototype.onInitialized = async function () {
      await Promise.all(_.map(target._endpointMethods, (v: Endpoint) => {
        const developmentOnly = _.get(v, 'options.developmentOnly');
        if (developmentOnly && !Environments.isDevMode()) return Promise.resolve();

        v.name = mangle(v.name);
        if (Environments.getEndpointSessionGroup() && !v.options.sessionGroup)
          v.options.sessionGroup = Environments.getEndpointSessionGroup();
        return this.server.register(v.name, v.handler.bind(this), 'endpoint').then(() => {
          return registerer && registerer.registerEndpoint(v.name, v.options || {}) || Promise.resolve();
        }).catch(e => {
          throw new FatalError(ISLAND.FATAL.F0028_CONSUL_ERROR, e.message);
        });
      }));
      return _onInitialized.apply(this);
    };

  };
}
