import * as Bluebird from 'bluebird';

import { Event, EventHandler, SubscriptionOptions } from '../services/event-subscriber';
import { EventSubscription } from '../utils/event';
import AbstractController from './abstract-controller';

interface PatternSubscription {
  pattern: string;
  handler: EventHandler<any>;
  options?: SubscriptionOptions;
}

interface EventSubscriptionContainer<T extends Event<U>, U> {
  _eventSubscriptions: EventSubscription<T, U>[];
}

interface PatternSubscriptionContainer {
  _patternSubscriptions: PatternSubscription[];
}

export function eventController<T>(target: any) {
  const _onInitialized = target.prototype.onInitialized;
  // tslint:disable-next-line
  target.prototype.onInitialized = async function () {
    const result = await _onInitialized.apply(this);

    const constructor = target as {new (): AbstractController<T>} &
      EventSubscriptionContainer<Event<any>, any> & PatternSubscriptionContainer;

    return Bluebird.map(constructor._eventSubscriptions || [], ({eventClass, handler, options}) => {
        return this.server.subscribeEvent(eventClass, handler.bind(this), options);
      })
      .then(() => Bluebird.map(constructor._patternSubscriptions || [], ({pattern, handler, options}) => {
        return this.server.subscribePattern(pattern, handler.bind(this), options);
      }))
      .then(() => result);
  };
}

export function subscribeEvent<T extends Event<U>, U>(eventClass: new (args: U) => T, options?: SubscriptionOptions) {
  return (target: any, propertyKey: string, desc: PropertyDescriptor) => {
    const constructor = target.constructor as Function & EventSubscriptionContainer<T, U>;
    constructor._eventSubscriptions = constructor._eventSubscriptions || [];
    constructor._eventSubscriptions.push({
      eventClass,
      handler: desc.value,
      options
    });
  };
}

export function subscribePattern(pattern: string, options?: SubscriptionOptions) {
  return (target: any, propertyKey: string, desc: PropertyDescriptor) => {
    pattern = pattern.trim();
    const constructor = target.constructor as Function & PatternSubscriptionContainer;
    constructor._patternSubscriptions = constructor._patternSubscriptions || [];
    constructor._patternSubscriptions.push({
      pattern,
      handler: desc.value,
      options
    });
  };
}
