import * as fs from 'fs';
import { Loggers } from 'island-loggers';
import { BaseEvent, Event, EventHandler, SubscriptionOptions } from '../services/event-subscriber';
import { collector } from './status-collector';

export interface EventSubscription<T extends Event<U>, U> {
  eventClass: new (args: U) => T;
  handler: EventHandler<T>;
  options?: SubscriptionOptions;
}

export namespace Events {
  export namespace Arguments {
    export interface LoggerTypeChanged {
      type: 'short' | 'long' | 'json';
    }

    export interface LoggerLevelChanged {
      category: string;
      level: 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'crit';
    }

    export interface SystemNodeStarted {
      name: string;
      island: string;
    }

    export interface SystemDiagnosis {
      args: string[];
      fileName: string;
    }
  }

  export class LoggerLevelChanged extends BaseEvent<Arguments.LoggerLevelChanged> {
    constructor(args: Arguments.LoggerLevelChanged) {
      super('logger.level.changed', args);
    }
  }

  export class LoggerTypeChanged extends BaseEvent<Arguments.LoggerTypeChanged> {
    constructor(args: Arguments.LoggerTypeChanged) {
      super('logger.type.changed', args);
    }
  }

  export class SystemNodeStarted extends BaseEvent<Arguments.SystemNodeStarted> {
    constructor(args: Arguments.SystemNodeStarted) {
      super('system.node.started', args);
    }
  }

  export class SystemDiagnosis extends BaseEvent<Arguments.SystemDiagnosis> {
    constructor(args: Arguments.SystemDiagnosis) {
      super('system.diagnosis', args);
    }
  }
}

export const DEFAULT_SUBSCRIPTIONS: EventSubscription<Event<any>, any>[] = [{
    eventClass: Events.LoggerLevelChanged,
    handler: (event: Events.LoggerLevelChanged) => Loggers.switchLevel(event.args.category, event.args.level),
    options: {everyNodeListen: true}
  }, {
    eventClass: Events.LoggerTypeChanged,
    handler: (event: Events.LoggerTypeChanged) => Loggers.switchType(event.args.type),
    options: {everyNodeListen: true}
  }, {
    eventClass: Events.SystemDiagnosis,
    handler: async (event: Events.SystemDiagnosis) => {
      if (event.args.args[0] === 'ping') {
        fs.appendFile(
          event.args.fileName,
          JSON.stringify({ timestamp: +new Date(), message: 'pong' }),
          err => {
            err && console.error(err);
          }
        );
      } else if (event.args.args[0] === 'status') {
        const status = await collector.calculateMeasurementsByType();
        fs.appendFile(
          event.args.fileName,
          JSON.stringify({ timestamp: +new Date(), message: JSON.stringify(status) }),
          err => {
            err && console.error(err);
          }
        );
      }
    },
    options: {everyNodeListen: true}
  }
];
