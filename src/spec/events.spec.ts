import { Loggers } from 'island-loggers';
import * as _ from 'lodash';
import * as Events from '../utils/event';

describe('Events', () => {
  it('LoggerLevelChanged', async () => {
    const eventSubscription = _.find(Events.DEFAULT_SUBSCRIPTIONS,
      o => o.eventClass === Events.Events.LoggerLevelChanged);
    if (!eventSubscription) {
      fail();
      return;
    }
    await eventSubscription.handler(new Events.Events.LoggerLevelChanged({category: 'island', level: 'debug'}));
    expect(Loggers.getLevel('island')).toEqual('debug');

    await eventSubscription.handler(new Events.Events.LoggerLevelChanged({category: 'island', level: 'info'}));
    expect(Loggers.getLevel('island')).toEqual('info');
  });

});
