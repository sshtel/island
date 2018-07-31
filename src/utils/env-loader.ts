import 'reflect-metadata';

import * as _ from 'lodash';
import * as inspector from 'schema-inspector';

export class SchemaStorage {
  private _schemaMetadata: any[] = [];

  get schemaMetadata(): any[] {
    return this._schemaMetadata;
  }

  public addSchemaMetadata(targetConstructor: Function, metadata: any) {
    const { type, propertyName, opts } = metadata;
    let targetMetadata = this.getSchemasForObject(targetConstructor);
    if (targetMetadata) {
      targetMetadata.schema.properties[propertyName] = opts;
      targetMetadata.schema.properties[propertyName].type = type;
    } else {
      targetMetadata = {
        key: targetConstructor,
        schema: {
          type: 'object',
          properties: {}
        }
      };
      targetMetadata.schema.properties[propertyName] = opts;
      targetMetadata.schema.properties[propertyName].type = type;
      this._schemaMetadata.push(targetMetadata);
    }
  }

  public getSchemasForObject(targetConstructor: Function): any {
    return this.schemaMetadata.find(metadata => {
      if (metadata.key === targetConstructor)
        return true;
      if (metadata.key instanceof Function &&
        !(targetConstructor.prototype instanceof (metadata.key as Function)))
           return false;

      return true;
    });
  }
}

const defaultSchemaStorage = new SchemaStorage();

function makeDecorator(optionalSchema?: any) {
  return (object: Object, propertyName: string) => {
    const metadata = Reflect.getMetadata('design:type', object, propertyName);
    // console.log(`${propertyName} props: ${Object.getOwnPropertyNames(metadata)}`);

    let type = '';
    switch (metadata.name) {
      case 'String':
      case 'Number':
      case 'Boolean':
      type = metadata.name.toLowerCase();
      break;
    }

    defaultSchemaStorage.addSchemaMetadata(object.constructor, {
      type,
      propertyName,
      opts: optionalSchema || {}
    });
  };
}

function isInvalidEnvValue(value) {
  if (value === undefined) return true;
  if (typeof value === 'number' && isNaN(value)) return true;
  return false;
}

function loadValueFromEnv(schema: any, object: any, itemKey: string): void {
  let loadedValue: any = undefined;

  const keys = (schema.legacyKeys && schema.legacyKeys.length) ? [itemKey].concat(schema.legacyKeys) : [itemKey];

  _.some(keys, envKey => {
    const envVar = process.env[envKey];
    if (envVar === undefined || envVar === '') {
      return false;
    }

    switch (schema.type) {
      case 'boolean':
        {
          const lowerCase = envVar.toLowerCase();
          switch (lowerCase) {
            // for support tencent-island.(legacy codes)
            case '1':
            case 'true':
              loadedValue = true;
              break;
            case '0':
            case 'false':
              loadedValue = false;
              break;
          }
        }
        break;
      case 'number':
      case 'float':
        loadedValue = parseFloat(envVar);
        break;
      case 'int':
      case 'integer':
        loadedValue = parseInt(envVar, 10);
        break;
      case 'string':
      default:
        loadedValue = envVar;
        break;
    }
    return true;
  });

  // schema-inspector will handle all invalid cases.
  if (isInvalidEnvValue(loadedValue)) {
    return;
  }

  object[itemKey] = loadedValue;
}

/**
 * environment decorator - 3 custom options & schema-inspector options
 * required: boolean - default true, also supports optional.
 * legacyKeys: array of string - find process.env[some of legacyKeys] when process.env[key] is undefined
 *
 * only supports 1 depth object.
 */
// TODO : custom: string - if ms and type number, parse value with ms
// TODO : support TypeScript 2.7 definite property assignment assertion - reflection didn't support yet
export function env(optionalSchema?: any) {
  return makeDecorator(optionalSchema);
}

export function LoadEnv(object: any): void {
  const metadata = defaultSchemaStorage.getSchemasForObject(object.constructor);
  _.forEach(metadata.schema.properties, (schema, key) => {
    if (typeof schema.optional !== 'boolean') {
      schema.optional = schema.required === false;
    }

    loadValueFromEnv(schema, object, key);
  });

  inspector.sanitize(metadata.schema, object);
  const result = inspector.validate(metadata.schema, object);
  const errors = _.filter(result.error || [], v => v.reason !== 'type' && v.property !== '@');
  if (errors.length) {
    let message = '[Environments] Initalization Error!!';
    _.forEach(errors, err => {
      message += `\nprocess.env ${err.property} ${err.message}`;
    });
    throw new Error(message);
  }
}

// Do not execute before LoadEnv!!!
export function setReadonly(object: any): void {
  const metadata = defaultSchemaStorage.getSchemasForObject(object.constructor);
  _.forEach(metadata.schema.properties, (schema, key) => {
    if (!schema.writable) {
      Object.defineProperty(object, key, {
        writable: false
      });
    }
  });
  return;
}
