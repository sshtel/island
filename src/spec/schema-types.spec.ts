import translateSchemaType from '../middleware/schema-types'
import Promise = require('bluebird')
import * as island from '../controllers/endpoint-decorator';
import { sanitize, validate } from '../middleware/schema.middleware'

describe('Schema-types test:', () => {

  it('schema-type test #1: translate : object', done => {
    let schema = {type: 'object', 
          properties:{name: {type: 'string' }}}; 
    return Promise.try(() => {
      translateSchemaType(schema);    
    })
    .then(() => expect(typeof(schema)).toEqual('object'))
    .catch(err => {
      console.log("schema-type test : ", err);
      return;
    })
    .then(done, done.fail);   
  })

  it('schema-type test #2: translate : $oid', done => {
    let schema = {
            type: '$oid'
            }
    let target = {
      type : 'string',
      pattern : /^[a-f\d]{24}$/i
    }
    return Promise.try(() => {
      translateSchemaType(schema);    
    })
    .then(() => expect(schema).toEqual(target))
    .catch(err => {
      console.log("schema-type test : ", err);
      return;
    })
    .then(done, done.fail);   
  })

  it('schema-type test #3: translate : $cider', done => {
    let schema = {
            type: '$cider'
            }
    let target = {
      type : 'string',
      pattern : /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])(\/(\d|[1-2]\d|3[0-2]))$/
    }
    return Promise.try(() => {
      translateSchemaType(schema);    
    })
    .then(() => expect(schema).toEqual(target))
    .catch(err => {
      console.log("schema-type test : ", err);
      return;
    })
    .then(done, done.fail);   
  })

  it('schema-type test #4: translate : $numberOrQuery', done => {
    let schema = {
            type: '$numberOrQuery'
            }
    let target = {
      type : ['object', 'number'],
      optional : true,
      someKeys : ['$lte', '$gte', '$lt', '$gt'],
      properties : {
        '$lte': { type: 'number', optional: true },
        '$gte': { type: 'number', optional: true },
        '$lt': { type: 'number', optional: true },
        '$gt': { type: 'number', optional: true }
      }
    }
    return Promise.try(() => {
      translateSchemaType(schema);    
    })
    //.then(() => expect(schema).toContain(target))
    .then(() => expect(schema).toEqual(jasmine.objectContaining(target)))
    .catch(err => {
      console.log("schema-type test : ", err);
      return;
    })
    .then(done, done.fail);   
  })

  it(`should convert query sanitization`, () => {
    
    const result = sanitize(island.sanitize.sanitize({
      'aid?': island.sanitize.ObjectId,
      'vcode!': 1,
      'dcode!': 1,
      name: String,
      slot: 1,
      cider: island.sanitize.Cider,
      number1: island.sanitize.NumberOrQuery,
      number2: island.sanitize.NumberOrQuery
    }), {
      'aid': 'tesssdfsdfds',
      vcode: 2,
      name: 'test',
      slot: 4,
      cider: '0.0.0.0/24',
      number1: 1,
      number2: {"$gt": "234"}
    });
    
    expect(result).toEqual({
      aid: 'tesssdfsdfds',
      vcode: 2,
      dcode: 1,
      name: 'test',
      slot: 4,
      cider: '0.0.0.0/24',
      number1: 1,
      number2: { '$gt': 234 } 
    });
  });

})