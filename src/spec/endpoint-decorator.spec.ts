import * as island from '../controllers/endpoint-decorator';
import { FatalError } from '../utils/error';

function fakeDecorate(decorator) {
  const target = {constructor: {}};
  decorator(target, null, {value: {options: {}}});
  return (target.constructor as any)._endpointMethods[0];
}

function fakeDecorate2(decorator) {
  const desc = {value: {options: {}}};
  decorator({}, null, desc);
  return desc.value;
}

describe('@endpoint', () => {
  it('should be decorator itself', () => {
    class XX {
      @island.endpoint('GET /test')
      getTest() {}
    }
    const YY = XX as any;
    expect(YY._endpointMethods).toBeTruthy();
    expect(YY._endpointMethods[0]).toBeTruthy();
    expect(YY._endpointMethods[0].name).toEqual('GET /test');
  });
  it('should have separated methods', () => {
    expect(fakeDecorate(island.endpoint.get('/test')).name).toEqual('GET /test');
    expect(fakeDecorate(island.endpoint.post('/test')).name).toEqual('POST /test');
    expect(fakeDecorate(island.endpoint.put('/test')).name).toEqual('PUT /test');
    expect(fakeDecorate(island.endpoint.del('/test')).name).toEqual('DEL /test');
  });
  it('should prevent mistakes to redeclare method', () => {
    expect(() => fakeDecorate(island.endpoint.get('GET /test')).name).toThrowError(FatalError, /.*10010024.*/);
    expect(() => fakeDecorate(island.endpoint.get('get /test')).name).toThrowError(FatalError, /.*10010024.*/);
    expect(() => fakeDecorate(island.endpoint.get('POST /test')).name).toThrowError(FatalError, /.*10010024.*/);
  });
  it('auth, admin, devonly Test ', () => {
    expect(fakeDecorate2(island.auth(10))).toEqual({ options: { level: 10 } });
    expect(fakeDecorate2(island.admin)).toEqual({ options: { level: 9, admin: true } });
    expect(fakeDecorate2(island.extra({internal: true}))).toEqual({ options: { extra: { internal: true } } });
    expect(fakeDecorate2(island.devonly)).toEqual({ options: { developmentOnly: true } });
    expect(fakeDecorate2(island.ensure(island.EnsureOptions.SESSION))).toEqual({ options: { ensure: 2 } });
    expect(fakeDecorate2(island.nosession())).toEqual({ options: { ignoreSession: true } });
  });
});
