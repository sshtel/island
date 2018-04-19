import * as _ from 'lodash';

// tslint:disable-next-line max-line-length
const CIDER_PATTERN = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])(\/(\d|[1-2]\d|3[0-2]))$/;

const translators = {
  $cider: schema => {
    schema.type = 'string';
    schema.pattern = CIDER_PATTERN;
  },
  $numberOrQuery: schema => {
    schema.type = ['object', 'number'];
    schema.optional = true;
    schema.someKeys = ['$lte', '$gte', '$lt', '$gt'];
    schema.properties = {
      $gt: { type: 'number', optional: true },
      $gte: { type: 'number', optional: true },
      $lt: { type: 'number', optional: true },
      $lte: { type: 'number', optional: true }
    };
    schema.exec = (schema, post) => {
      return (typeof post === 'string' && /^[0-9]+$/.test(post)) ? parseInt(post, 10) : post;
    };
  },
  $oid: schema => {
    schema.type = 'string';
    schema.pattern = /^[a-f\d]{24}$/i;
  },
  array: schema => translateSchemaType(schema.items),
  object: schema => _.forEach(schema.properties, v => translateSchemaType(v)),
  $html: schema => {
    schema.type = 'string';
  }
};

export default function translateSchemaType(schema) {
  schema && (translators[schema.type] || (() => {}))(schema);
}
