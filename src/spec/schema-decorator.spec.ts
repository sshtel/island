import 'source-map-support/register';
import * as island from '../controllers/endpoint-decorator';

const v = island.validate;
const s = island.sanitize;

describe('validate', () => {
  it('should support any', () => {
    const result = island.validate.validate(island.validate.Any);
    expect(result).toEqual({ type: 'any' });
  });
  it('should support primitive types itself', () => {
    const result1 = island.validate.validate(String);
    expect(result1).toEqual({ type: 'string' });
    const result2 = island.validate.validate(Number);
    expect(result2).toEqual({ type: 'number' });
    const result3 = island.validate.validate(Boolean);
    expect(result3).toEqual({ type: 'boolean' });
  });
  it('should support empty object', () => {
    const result = v.validate(island.validate.Object());
    expect(result).toEqual({
      type: 'object'
    });
  });
  it(`should convert query validation`, () => {
    const result = island.validate.validate({
      'aid?': v.ObjectId,
      cider: v.Cider,
      dcode: Number,
      name: String,
      number: v.NumberOrQuery,
      slot: Number,
      vcode: Number
    });
    expect(result).toEqual({
      properties: {
        aid: { type: '$oid', optional: true },
        cider: { type: '$cider', optional: false },
        dcode: { type: 'number', optional: false },
        name: { type: 'string', optional: false },
        number: { type: '$numberOrQuery', optional: false },
        slot: { type: 'number', optional: false },
        vcode: { type: 'number', optional: false }
      },
      type: 'object'
    });
  });
  it('should support array', () => {
    const result = v.validate([v.Cider]);
    expect(result).toEqual({
      items: { type: '$cider', optional: false },
      type: 'array'
    });
  });
  it('should support empty array', () => {
    const result = v.validate(island.validate.Array());
    expect(result).toEqual({
      type: 'array'
    });
  });
  it('should support boolean', () => {
    const result = v.validate({ a: Boolean });
    expect(result).toEqual({
      properties: {
        a: { type: 'boolean', optional: false }
      },
      type: 'object'
    });
  });
  it('should override value by key with ?', () => {
    const result = v.validate({
      'jti?': v.String({ exactLength: 32 }),
      'session_types?': v.Array([String]),
      limit: v.Number({ lte: 100 }),
      offset: Number
    });
    expect(result).toEqual({
      properties: {
        jti: { type: 'string', exactLength: 32, optional: true },
        session_types: { type: 'array', items: { type: 'string', optional: false }, optional: true },
        limit: { type: 'number', lte: 100, optional: false },
        offset: { type: 'number', optional: false }
      },
      type: 'object'
    });
  });
  it('should support complex type with String', () => {
    const result1 = v.validate(v.String({ eq: ['haha', 'hoho'] }));
    expect(result1).toEqual({
      eq: ['haha', 'hoho'],
      type: 'string'
    });
    const result2 = v.validate({
      grant_type: v.String({ eq: ['password', 'client_credentials'] }),
      'jti?': v.String({ exactLength: 32 }),
      token_type: v.String({ eq: 'Bearer' })
    });
    expect(result2).toEqual({
      properties: {
        grant_type: { type: 'string', eq: ['password', 'client_credentials'], optional: false },
        jti: { type: 'string', exactLength: 32, optional: true },
        token_type: { type: 'string', eq: 'Bearer', optional: false }
      },
      type: 'object'
    });
  });
  it('should support minLength, maxLength, exactLength with String', () => {
    const result = v.validate({
      exact: v.String({ exactLength: 8 }),
      max: v.String({ maxLength: 10 }),
      min: v.String({ minLength: 1 }),
      mixed: v.String({ minLength: 2, maxLength: 4, exactLength: 3 })
    });
    expect(result).toEqual({
      properties: {
        exact: { type: 'string', exactLength: 8, optional: false },
        max: { type: 'string', maxLength: 10, optional: false },
        min: { type: 'string', minLength: 1, optional: false },
        mixed: { type: 'string', minLength: 2, maxLength: 4, exactLength: 3, optional: false }
      },
      type: 'object'
    });
  });
  it('should support complex type with Number', () => {
    const result = v.validate({
      limit: v.Number({ lte: 100 }),
      offset: Number
    });
    expect(result).toEqual({
      properties: {
        limit: { type: 'number', lte: 100, optional: false },
        offset: { type: 'number', optional: false }
      },
      type: 'object'
    });
  });
  it('should support postfix for key', () => {
    const result = island.validate.validate({
      a: Number,
      'b?': Number,
      'c!': Number
    });
    expect(result).toEqual({
      properties: {
        a: { type: 'number', optional: false },
        b: { type: 'number', optional: true },
        c: { type: 'number', optional: false }
      },
      type: 'object'
    });
  });
  it('should support nested object', () => {
    const result = island.validate.validate({
      a: v.Object({
        b: Number,
        'c?': String
      })
    });
    expect(result).toEqual({
      properties: {
        a: {
          optional: false,
          properties: {
            b: { type: 'number', optional: false },
            c: { type: 'string', optional: true }
          },
          type: 'object'
        }
      },
      type: 'object'
    });
  });
  it('should support nested nested object', () => {
    const result = island.validate.validate({
      a: v.Object({ b: v.Object({ 'c?': String }) })
    });
    expect(result).toEqual({
      properties: {
        a: {
          optional: false,
          properties: {
            b: {
              optional: false,
              properties: {
                c: { type: 'string', optional: true }
              },
              type: 'object'
            }
          },
          type: 'object'
        }
      },
      type: 'object'
    });
  });
  it('should support array of array', () => {
    const result = island.validate.validate([v.Array([Number])]);
    expect(result).toEqual({
      items: {
        items: { type: 'number', optional: false },
        optional: false,
        type: 'array'
      },
      type: 'array'
    });
  });
  it('should support array of object', () => {
    const result = island.validate.validate([v.Object({
      a: Number
    })]);
    expect(result).toEqual({
      items: {
        optional: false,
        properties: { a: { type: 'number', optional: false } },
        type: 'object'
      },
      type: 'array'
    });
  });
  it('should support object of array', () => {
    const result = island.validate.validate({
      a: v.Array([Number])
    });
    expect(result).toEqual({
      properties: {
        a: {
          items: { type: 'number', optional: false },
          optional: false,
          type: 'array'
        }
      },
      type: 'object'
    });
  });

  it('should support array options - minLength', () => {
    const result = v.validate(v.Array([Number], {minLength: 5 }));
    expect(result).toEqual({
      type: 'array',
      minLength: 5,
      optional: false,
      items: {type : 'number',
              optional: false
             }
    });
  });

  it('should support array options - maxLength', () => {
    const result = v.validate(v.Array([Number], {maxLength: 10 }));
    expect(result).toEqual({
      type: 'array',
      maxLength: 10,
      optional: false,
      items: {type : 'number',
              optional: false
             }
    });
  });

  it('should support array options - exactLength', () => {
    const result = v.validate(v.Array([Number], {exactLength: 10 }));
    expect(result).toEqual({
      type: 'array',
      exactLength: 10,
      optional: false,
      items: {type : 'number',
              optional: false
             }
    });
  });

  it('should support array options', () => {
    const result = v.validate(v.Array([Number], {minLength: 5 , maxLength: 10, exactLength: 15  }));
    expect(result).toEqual({
      type: 'array',
      minLength: 5,
      maxLength: 10,
      exactLength: 15,
      optional: false,
      items: {type : 'number',
              optional: false
             }
    });
  });
});

describe('sanitize', () => {
  it('should support primitive types itself', () => {
    const result1 = island.sanitize.sanitize(String);
    expect(result1).toEqual({ type: 'string' });
    const result2 = island.sanitize.sanitize(Number);
    expect(result2).toEqual({ type: 'number' });
    const result3 = island.sanitize.sanitize(Boolean);
    expect(result3).toEqual({ type: 'boolean' });
  });
  it(`should convert query sanitization`, () => {
    const result = island.sanitize.sanitize({
      'aid?': s.ObjectId,
      cider: s.Cider,
      dcode: 1,
      name: String,
      number: s.NumberOrQuery,
      slot: 1,
      vcode: 1
    });
    expect(result).toEqual({
      properties: {
        aid: { type: '$oid', optional: true },
        cider: { optional: true, type: '$cider' },
        dcode: { type: 'number', def: 1, optional: true },
        name: { type: 'string', optional: true },
        number: { optional: true, type: '$numberOrQuery' },
        slot: { type: 'number', def: 1, optional: true },
        vcode: { type: 'number', def: 1, optional: true }
      },
      type: 'object'
    });
  });
  it('should sanitize string', () => {
    const result = island.sanitize.sanitize({
      aid: s.ObjectId,
      expireAt: Number,
      reason: ''
    });
    expect(result).toEqual({
      properties: {
        aid: { type: '$oid', optional: true },
        expireAt: { type: 'number', optional: true },
        reason: { type: 'string', def: '', optional: true }
      },
      type: 'object'
    });
  });
  it('should support boolean', () => {
    const result = island.sanitize.sanitize({ a: Boolean });
    expect(result).toEqual({
      properties: {
        a: { type: 'boolean', optional: true }
      },
      type: 'object'
    });
  });
  it('should support postfix for key', () => {
    const result = island.sanitize.sanitize({
      a: Number,
      'b?': Number,
      'c!': Number
    });
    expect(result).toEqual({
      properties: {
        a: { type: 'number', optional: true },
        b: { type: 'number', optional: true },
        c: { type: 'number', optional: false }
      },
      type: 'object'
    });
  });
  it('should support object of object', () => {
    const result = island.sanitize.sanitize({
      a: s.Object({
        b: Number,
        'c?': String
      })
    });
    expect(result).toEqual({
      properties: {
        a: {
          optional: true,
          properties: {
            b: { type: 'number', optional: true },
            c: { type: 'string', optional: true }
          },
          type: 'object'
        }
      },
      type: 'object'
    });
  });
  it('should support object of object of object', () => {
    const result = island.sanitize.sanitize({
      a: s.Object({ b: s.Object({ 'c?': String }) })
    });
    expect(result).toEqual({
      properties: {
        a: {
          optional: true,
          properties: {
            b: {
              optional: true,
              properties: {
                c: { type: 'string', optional: true }
              },
              type: 'object'
            }
          },
          type: 'object'
        }
      },
      type: 'object'
    });
  });
  it('should support array of array', () => {
    const result = island.sanitize.sanitize([s.Array([Number])]);
    expect(result).toEqual({
      items: {
        items: { type: 'number', optional: true },
        optional: true,
        type: 'array'
      },
      type: 'array'
    });
  });
  it('should support array of object', () => {
    const result = island.sanitize.sanitize([s.Object({
      a: Number
    })]);
    expect(result).toEqual({
      items: {
        optional: true,
        properties: { a: { type: 'number', optional: true } },
        type: 'object'
      },
      type: 'array'
    });
  });
  it('should support object of array', () => {
    const result = island.sanitize.sanitize({
      a: s.Array([Number])
    });
    expect(result).toEqual({
      properties: {
        a: {
          items: { type: 'number', optional: true },
          optional: true,
          type: 'array'
        }
      },
      type: 'object'
    });
  });

  it('should support default value of object', () => {
    const result = island.sanitize.sanitize({
      a: s.Object({ b: Number }, { def: { b: 1 } }),
      c: s.Object({
        d: s.Object({ e: String })
      }, { def: { d: { e: 'string' } } })
    });
    expect(result.properties.a.def).toEqual({ b: 1 });
    expect(result.properties.c.def).toEqual({ d: { e: 'string' } });
  });
});

describe('__langid', () => {
  it('should be copied on sanitization', () => {
    const result = island.sanitize.sanitize({
      'id+uniqueid': String,
      'roomid+very+good+room!': island.sanitize.ObjectId
    });
    expect(result).toEqual({
      properties: {
        id: { type: 'string', optional: true, __langid: 'id+uniqueid' },
        roomid: { type: '$oid', optional: false, __langid: 'roomid+very+good+room' }
      },
      type: 'object'
    });
  });
  it('should be copied on validation', () => {
    const result = island.validate.validate({
      'id+uniqueid?': String,
      'roomid+very+good+room': island.validate.ObjectId
    });
    expect(result).toEqual({
      properties: {
        id: { type: 'string', optional: true, __langid: 'id+uniqueid' },
        roomid: { type: '$oid', optional: false, __langid: 'roomid+very+good+room' }
      },
      type: 'object'
    });
  });
});
