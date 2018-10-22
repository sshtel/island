import * as fs from 'fs';
import { Loggers } from 'island-loggers';
import { BaseEvent, Event } from 'island-types';

import { EventHandler, SubscriptionOptions } from '../services/event-subscriber';
import { Endpoints, information } from './information';
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

    export interface SystemHealthCheck {
    }

    export interface SystemInfo {
      name: string;
      version: string;
      checksum: string;
    }

    export interface SystemEndpointInfo {
      name: string;
      version: string;
      checksum: string;
      endpoints: Endpoints;
    }

    export interface SystemEndpointCheck {
      name: string;
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

  export class SystemHealthCheck extends BaseEvent<Arguments.SystemHealthCheck> {
    constructor(args: Arguments.SystemHealthCheck) {
      super('system.health.check', args);
    }
  }

  export class SystemInfo extends BaseEvent<Arguments.SystemInfo> {
    constructor(args: Arguments.SystemInfo) {
      super('system.info.checked', args);
    }
  }

  export class SystemEndpointInfo extends BaseEvent<Arguments.SystemEndpointInfo> {
    constructor(args: Arguments.SystemEndpointInfo) {
      super('system.endpoint.checked', args);
    }
  }

  export class SystemEndpointCheck extends BaseEvent<Arguments.SystemEndpointCheck> {
    constructor(args: Arguments.SystemEndpointCheck) {
      super('system.endpoint.check', args);
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
  }, {
    eventClass: Events.SystemHealthCheck,
    async handler(event: Events.SystemHealthCheck) {
      if (!information.isSynced()) return;
      this.publishEvent(new Events.SystemInfo(information.getSystemInfo()));
    }
  }, {
    eventClass: Events.SystemEndpointCheck,
    async handler(event: Events.SystemEndpointCheck) {
      const info = information.getSystemInfo();
      if (event.args.name !== info.name || !information.isSynced()) return;
      this.publishEvent(new Events.SystemEndpointInfo(information.getEndpoints()));
    }
  }
];
