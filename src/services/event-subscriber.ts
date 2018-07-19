import * as amqp from 'amqplib';

export interface Event<T> {
  key: string;
  args: T;
  publishedAt?: Date;
}

export class BaseEvent<T> implements Event<T> {
  publishedAt: Date;
  constructor(public key: string, public args: T) {
  }
}

export class DebugBaseEvent<T> implements Event<T> {
  constructor(public key: string, public args: T, public publishedAt?: Date) {
  }
}

export class DebugEvent<T> extends DebugBaseEvent<T> {
  constructor(public debugClass: { key: string, args: T }, public publishedAt?: Date) {
    super(debugClass.key, debugClass.args, publishedAt);
  }
}

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
}

export class EventSubscriber extends Subscriber {
  private key: string;
  private queue: string;

  constructor(private handler: EventHandler<Event<any>>,
              private eventClass: new (args: any) => Event<any>) {
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
              private pattern: string) {
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

  handleEvent(content: any, msg: Message): Promise<any> {
    return Promise.resolve(this.handler({
      args: content,
      key: msg.fields.routingKey,
      publishedAt: new Date(msg.properties.timestamp || 0)
    }));
  }

  private convertRoutingKeyPatternToRegexp(pattern: string): RegExp {
    const regexPattern = pattern
      .replace('.', '\\.')        // dot(.) is separator
      .replace('*', '\\w+')       // star(*) means one word exactly
      .replace('#', '[\\w\\.]*'); // hash(#) means zero or more words, including dot(.)
    return new RegExp(`^${regexPattern}$`);
  }
}

export interface SubscriptionOptions {
  everyNodeListen?: boolean;
}
