import Bluebird = require('bluebird');

import * as island from '../controllers/endpoint-decorator';
import translateSchemaType from '../middleware/schema-types';
import { sanitize } from '../middleware/schema.middleware';

describe('Schema-types test:', () => {
  it('schema-type test #1: translate : object', done => {
    const schema = {
      properties: { name: { type: 'string' } },
      type: 'object'
    };
    return Bluebird.try(() => {
      translateSchemaType(schema);
    })
      .then(() => expect(typeof (schema)).toEqual('object'))
      .catch(err => {
        console.log('schema-type test : ', err);
        return;
      })
      .then(done, done.fail);
  });

  it('schema-type test #2: translate : $oid', done => {
    const schema = {
      type: '$oid'
    };
    const target = {
      pattern: /^[a-f\d]{24}$/i,
      type: 'string'
    };
    return Bluebird.try(() => {
      translateSchemaType(schema);
    })
      .then(() => expect(schema).toEqual(target))
      .catch(err => {
        console.log('schema-type test : ', err);
        return;
      })
      .then(done, done.fail);
  });

  it('schema-type test #3: translate : $cider', done => {
    const schema = {
      type: '$cider'
    };
    // tslint:disable-next-line
    const pattern = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])(\/(\d|[1-2]\d|3[0-2]))$/;

    const target = { type: 'string', pattern };
    return Bluebird.try(() => {
      translateSchemaType(schema);
    })
      .then(() => expect(schema).toEqual(target))
      .catch(err => {
        console.log('schema-type test : ', err);
        return;
      })
      .then(done, done.fail);
  });

  /* error reserved word 'type' by jipark @2017.03.21
  it('schema-type test #4: translate : $numberOrQuery', done => {
    const schema = {
      type: '$numberOrQuery'
    };
    const target = {
      optional: true,
      properties: {
        $gt: { type: 'number', optional: true },
        $gte: { type: 'number', optional: true },
        $lt: { type: 'number', optional: true },
        $lte: { type: 'number', optional: true }
      },
      someKeys: ['$lte', '$gte', '$lt', '$gt'],
      type: ['object', 'number']
    };
    return Bluebird.try(() => {
      translateSchemaType(schema);
    })
      .then(() => expect(schema).toEqual(jasmine.objectContaining(target)))
      .catch(err => {
        console.log('schema-type test : ', err);
        return;
      })
      .then(done, done.fail);
  });
  */

  it('schema-type test #5: $html', done => {
    const schema = {
      type: '$html'
    };
    const target = {type: 'string'};

    return Bluebird.try(() => {
      translateSchemaType(schema);
    })
      .then(() => expect(schema).toEqual(target))
      .catch(err => {
        console.log('schema-type test : ', err);
        return;
      })
      .then(done, done.fail);
  });

  it(`should convert query sanitization`, () => {
    const result = sanitize(island.sanitize.sanitize({
      'aid?': island.sanitize.ObjectId,
      cider: island.sanitize.Cider,
      'dcode!': 1,
      name: String,
      number1: island.sanitize.NumberOrQuery,
      number2: island.sanitize.NumberOrQuery,
      slot: 1,
      'vcode!': 1
    }), {
        aid: 'tesssdfsdfds',
        cider: '0.0.0.0/24',
        name: 'test',
        number1: 1,
        number2: { $gt: '234' },
        slot: 4,
        vcode: 2
      });

    expect(result).toEqual({
      aid: 'tesssdfsdfds',
      cider: '0.0.0.0/24',
      dcode: 1,
      name: 'test',
      number1: 1,
      number2: { $gt: 234 },
      slot: 4,
      vcode: 2
    });
  });

  it(`test validation for string array types `, () => {
    const GAME_MODE_ARRAY1: string[] = ['ITEMINDIVIDUAL', 'ITEMTEAM', 'SPEEDINDIVIDUAL', 'SPEEDTEAM'];
    const GAME_MODE_ARRAY2: string[] = ['ITEMINDIVIDUAL', 'ITEMTEAM', 'SPEEDINDIVIDUAL', 'SPEEDTEAM'];

    const result1 = island.validate.validate({ 'gameMode!': island.validate.String({ eq: GAME_MODE_ARRAY1 }) });
    expect(result1).toEqual({
      properties: { gameMode: { optional: false, type: 'string', eq: GAME_MODE_ARRAY1 } },
      type: 'object'
    });

    const result2 = island.validate.validate({ 'gameMode!': island.validate.String({ eq: GAME_MODE_ARRAY1 }) });
    expect(result2).toEqual({
      properties: { gameMode: { optional: false, type: 'string', eq: GAME_MODE_ARRAY2 } },
      type: 'object'
    });

    const result3 = island.validate.validate({ 'gameMode!': island.validate.String({ eq: GAME_MODE_ARRAY2 }) });
    expect(result3).toEqual({
      properties: { gameMode: { optional: false, type: 'string', eq: GAME_MODE_ARRAY1 } },
      type: 'object'
    });

    const result4 = island.validate.validate({ 'gameMode!': island.validate.String({ eq: GAME_MODE_ARRAY2 }) });
    expect(result4).toEqual({
      properties: { gameMode: { optional: false, type: 'string', eq: GAME_MODE_ARRAY2 } },
      type: 'object'
    });

    const gameModes = ['ITEMINDIVIDUAL', 'ITEMTEAM', 'SPEEDINDIVIDUAL', 'SPEEDTEAM'];
    const result5 = island.validate.validate({ 'gameMode!': island.validate.String({ eq: gameModes }) });
    expect(result5).toEqual({
      properties: { gameMode: { optional: false, type: 'string', eq: GAME_MODE_ARRAY1 } },
      type: 'object'
    });
    const result6 = island.validate.validate({ 'gameMode!': island.validate.String({ eq: gameModes }) });
    expect(result6).toEqual({
      properties: { gameMode: { optional: false, type: 'string', eq: GAME_MODE_ARRAY2 } },
      type: 'object'
    });
  });
});
