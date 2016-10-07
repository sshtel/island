import { Loggers } from '../utils/loggers';
const stdMocks = require('std-mocks');

function mock(func) {
    stdMocks.use();
    func();
    const output = stdMocks.flush();
    stdMocks.restore();
    return output;
}

describe('Logger', () => {
  it('could show as JSON format', () => {
    const logger = Loggers.get('test');
    Loggers.switchType('json');
    const output = mock(() => {
      logger.info('haha');
    });
    const msg = JSON.parse(output.stdout[0].slice(0, -1)).msg;
    expect(msg).toEqual('haha');
  });

  it('should show where the log from', () => {
    const logger = Loggers.get('test');
    Loggers.switchType('json');
    const output = mock(() => {
      process.env.ISLAND_LOGGER_TRACE = 'true';
      logger.info('haha');
    });
    const log = JSON.parse(output.stdout[0].slice(0, -1));
    expect(log.file).toContain('logger.spec.ts');
    expect(log.line).toEqual(28);
  });
});
