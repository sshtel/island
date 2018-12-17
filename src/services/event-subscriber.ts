import * as amqp from 'amqplib';
import { Event } from 'island-types';

export interface EventHandler<T> {
  (event: T): Promise<any> | any;
}

export interface Message {
  content: Buffer;
  fields: {
    routingKey: string;
  };
  properties: amqp.Options.Publish;
}

export abstract class Subscriber {
  abstract getQueue(): string;
  abstract setQueue(queue: string): void;
  abstract getRoutingPattern(): string;
  abstract isRoutingKeyMatched(routingKey: string): boolean;
  abstract handleEvent(content: any, msg: Message): Promise<any>;
  abstract getOptions(): SubscriptionOptions;
}

export class EventSubscriber extends Subscriber {
  private key: string;
  private queue: string;

  constructor(private handler: EventHandler<Event<any>>,
              private eventClass: new (args: any) => Event<any>,
              private options: SubscriptionOptions) {
    super();
    const event = new eventClass(null);
    this.key = event.key.trim();
  }

  getQueue(): string {
    return this.queue;
  }

  setQueue(queue: string): void {
    this.queue = queue;
  }

  getRoutingPattern(): string {
    return this.key;
  }

  get routingKey(): string {
    return this.key;
  }

  isRoutingKeyMatched(routingKey: string): boolean {
    return routingKey === this.key;
  }

  getOptions(): SubscriptionOptions {
    return this.options || {};
  }

  handleEvent(content: any, msg: Message): Promise<any> {
    const event = new this.eventClass(content);
    event.publishedAt = new Date(msg.properties.timestamp || 0);
    return Promise.resolve(this.handler(event));
  }
}

export class PatternSubscriber extends Subscriber {
  private regExp: RegExp;
  private queue: string;

  constructor(private handler: EventHandler<Event<any>>,
              private pattern: string,
              private options: SubscriptionOptions) {
    super();
    this.regExp = this.convertRoutingKeyPatternToRegexp(pattern);
  }

  getQueue(): string {
    return this.queue;
  }

  setQueue(queue: string): void {
    this.queue = queue;
  }

  getRoutingPattern(): string {
    return this.pattern;
  }

  isRoutingKeyMatched(routingKey: string): boolean {
    return this.regExp.test(routingKey);
  }

  getOptions(): SubscriptionOptions {
    return this.options || {};
  }

  handleEvent(content: any, msg: Message): Promise<any> {
    return Promise.resolve(this.handler({
      args: content,
      key: msg.fields.routingKey,
      publishedAt: new Date(msg.properties.timestamp || 0)
    }));
  }

  private convertRoutingKeyPatternToRegexp(pattern: string): RegExp {
    const regexPattern = pattern
      .replace(/\./gi, '\\.')        // dot(.) is separator
      .replace(/\*/gi, '\\w+')       // star(*) means one word exactly
      .replace(/\#/gi, '[\\w\\.]*');  // hash(#) means zero or more words, including dot(.)
    return new RegExp(`^${regexPattern}$`);
  }
}

export interface SubscriptionOptions {
  everyNodeListen?: boolean;
  guaranteeArrivalTime?: boolean;
}
