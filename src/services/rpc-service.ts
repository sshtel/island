import { cls } from 'island-loggers';

import * as amqp from 'amqplib';
import * as Bluebird from 'bluebird';
import deprecated from 'deprecated-decorator';
import * as fs from 'fs';
import * as _ from 'lodash';
import * as os from 'os';
import uuid = require('uuid');

import { sanitize, validate } from '../middleware/schema.middleware';
import { DiagRpcArgs } from '../utils/diag';
import { Environments } from '../utils/environments';
import { AbstractError, FatalError, ISLAND, LogicError, mergeIslandJsError } from '../utils/error';
import { logger } from '../utils/logger';
import reviver from '../utils/reviver';
import { RouteLogger } from '../utils/route-logger';
import { RpcOptions, RpcRequest } from '../utils/rpc-request';
import { IRpcResponse, RpcResponse } from '../utils/rpc-response';
import { collector } from '../utils/status-collector';
import { AmqpChannelPoolService } from './amqp-channel-pool-service';

export { IRpcResponse, RpcRequest, RpcResponse };

export type RpcType = 'rpc' | 'endpoint';
export interface IConsumerInfo {
  channel: amqp.Channel;
  tag: string;
  options?: RpcOptions;
  key: string;
  consumer: (msg: any) => Promise<void>;
  consumerOpts?: any;
}

interface Message {
  content: Buffer;
  fields: {[key: string]: any; exchange: string};
  properties: amqp.Options.Publish;
}

export type RpcHook = (rpc) => Promise<any>;
export enum RpcHookType {
  PRE_ENDPOINT,
  POST_ENDPOINT,
  PRE_RPC,
  POST_RPC,
  PRE_ENDPOINT_ERROR,
  POST_ENDPOINT_ERROR,
  PRE_RPC_ERROR,
  POST_RPC_ERROR
}

export interface RpcEntities {
    [rpcName: string]: {
      handler: (req: any) => Promise<any>;
      type: RpcType;
      rpcOptions?: RpcOptions;
    };
}

export interface InitializeOptions {
  useReviver?: boolean;
  consumerAmqpChannelPool?: AmqpChannelPoolService;
}

function sanitizeAndValidate(content, rpcOptions) {
  if (rpcOptions) {
    if (_.get(rpcOptions, 'schema.query.sanitization')) {
      content = sanitize(rpcOptions.schema!.query!.sanitization, content);
    }
    if (_.get(rpcOptions, 'schema.query.validation')) {
      if (!validate(rpcOptions.schema!.query!.validation, content)) {
        throw new LogicError(ISLAND.LOGIC.L0002_WRONG_PARAMETER_SCHEMA, `Wrong parameter schema`);
      }
    }
  }
  return content;
}

function sanitizeAndValidateResult(res, rpcOptions?: RpcOptions) {
  if (!rpcOptions) return res;
  if (_.get(rpcOptions, 'schema.result.sanitization')) {
    res = sanitize(rpcOptions.schema!.result!.sanitization, res);
  }
  if (_.get(rpcOptions, 'schema.result.validation')) {
    validate(rpcOptions.schema!.result!.validation, res);
  }
  return res;
}

function nackWithDelay(channel, msg) {
  setTimeout(() => channel.nack(msg), 1000) as any;
}

type DeferredResponse = { resolve: (msg: Message) => any, reject: (e: Error) => any };

interface SystemDiagnosisPayload {
 fileName: string;
  cmd: string;
  args: DiagRpcArgs;
}
export class RPCService {
  private requestConsumerInfo: IConsumerInfo[] = [];
  private responseQueueName: string;
  private waitingResponse: { [corrId: string]: DeferredResponse } = {};
  private timedOut: { [corrId: string]: string } = {};
  private timedOutOrdered: string[] = [];
  private channelPool: AmqpChannelPoolService;
  private consumerChannelPool: AmqpChannelPoolService;
  private serviceName: string;
  private hooks: { [key: string]: RpcHook[] };
  private purging: Function | null = null;
  private rpcEntities: RpcEntities = {};
  private queuesAvailableSince: number[] = _.range(Environments.getRpcDistribSize()).map(o => +new Date());

  constructor(serviceName?: string) {
    this.serviceName = serviceName || 'unknown';
    this.hooks = {};
    this.responseQueueName = this.makeResponseQueueName();
    fs.writeFileSync('./rpc.proc', JSON.stringify({ status: 'initializing', queue: this.responseQueueName }));
  }

  public async initialize(channelPool: AmqpChannelPoolService, opts?: InitializeOptions): Promise<any> {
    if (Environments.ISLAND_USE_REVIVER || opts && opts.useReviver) {
      RpcResponse.reviver = reviver;
    } else {
      RpcResponse.reviver = undefined;
    }
    if (opts && opts.consumerAmqpChannelPool) {
      this.consumerChannelPool = opts.consumerAmqpChannelPool;
      logger.info(`pub/sub channelPool connection splitted`);
    } else {
      this.consumerChannelPool = channelPool;
    }
    logger.info(`consuming ${this.responseQueueName}`);

    this.channelPool = channelPool;
    await this.consumerChannelPool.usingChannel(
      channel => channel.assertQueue(this.responseQueueName, {
        durable: false,
        exclusive: true,
        expires: Environments.ISLAND_RPC_WAIT_TIMEOUT_MS + Environments.ISLAND_SERVICE_LOAD_TIME_MS
      })
    );

    await this.consumeForResponse();
    fs.writeFileSync('./rpc.proc', JSON.stringify({ status: 'initialized', queue: this.responseQueueName }));
  }

  @deprecated()
  public _publish(exchange: any, routingKey: any, content: any, options?: any) {
    return this.channelPool.usingChannel(channel => {
      return Promise.resolve(channel.publish(exchange, routingKey, content, options));
    });
  }

  public async purge() {
    try { fs.unlinkSync('./rpc.proc'); } catch (_e) {}
    logger.info('stop serving');
    await this.unregisterAll();

    let precondition = Promise.resolve();
    if (0 < collector.getOnGoingRequestCount('rpc')) {
      precondition = new Promise<void>(res => this.purging = res);
    }
    await precondition;

    this.hooks = {};
    this.timedOut = {};
    this.timedOutOrdered = [];
    this.queuesAvailableSince = _.range(Environments.getRpcDistribSize()).map(o => +new Date());
  }

  public async sigInfo() {
    return await collector.sigInfo('rpc');
  }

  public registerHook(type: RpcHookType, hook: RpcHook) {
    this.hooks[type] = this.hooks[type] || [];
    this.hooks[type].push(hook);
  }

  public async register(rpcName: string,
                        handler: (req: any) => Promise<any>,
                        type: RpcType,
                        rpcOptions?: RpcOptions): Promise<void> {
    this.rpcEntities[rpcName] = { handler, type, rpcOptions };
  }

  public async listen() {
    const queues = _.map(_.range(Environments.getRpcDistribSize()), no => (`rpc.req.${this.serviceName}.${no}`));
    await this.assertQueues(queues);
    await this.assertExchanges(this.rpcEntities);
    await this.bindQueuesToExchanges(queues, this.rpcEntities);
    await this.startConsumingQueues(queues);
    fs.writeFileSync('./rpc.proc', JSON.stringify({ status: 'started', queue: this.responseQueueName }));
  }

  @deprecated()
  public async pause(name: string) {
    logger.warning('RPCService no longer supports to pause a specific RPC', name);
  }

  public async pauseAll() {
    if (this.requestConsumerInfo.length === 0) return;
    await Promise.all(this.requestConsumerInfo.map(ci => ci.channel.cancel(ci.tag)));
  }

  @deprecated()
  public async resume(name: string) {
    logger.warning('RPCService no longer supports to resume a specific RPC', name);
  }

  public async resumeAll() {
    if (this.requestConsumerInfo.length === 0) return;
    await Promise.all(this.requestConsumerInfo.map(ci => ci.channel.consume(ci.key, ci.consumer)));
  }

  @deprecated()
  public async unregister(name: string) {
    logger.warning('RPCService no longer supports to unregister a specific RPC', name);
  }

  public async unregisterAll() {
    if (this.requestConsumerInfo.length === 0) return;
    await Promise.all(this.requestConsumerInfo.map(async ci => {
      try {
        await ci.channel.cancel(ci.tag);
      } catch (e) {
        // ignore against an already closed channel
      }
    }));
    this.requestConsumerInfo = [];
    this.rpcEntities = {};
  }

  public async invoke<T, U>(name: string, msg: T, opts?: {withRawdata: boolean}): Promise<U>;
  public async invoke(name: string, msg: any, opts?: {withRawdata: boolean}): Promise<any> {
    name = name.trim();
    const routingKey = this.makeRoutingKey();
    const option = this.makeInvokeOption(name);
    const p = this.waitResponse(option.correlationId!, (msg: Message) => {
      if (msg.properties && msg.properties.headers) {
        RouteLogger.replaceLogs('app', msg.properties.headers.extra.routeLogs);
      }
      if (msg.properties.headers.extra.flow) {
        logger.notice(`RPC(${name}) responses extra.flow by the queue.${routingKey}`);
        this.queuesAvailableSince[routingKey] = +new Date() + Environments.getFlowModeDelay();
      }
      const res = RpcResponse.decode(msg.content);
      if (res.result === false) throw res.body;
      if (opts && opts.withRawdata) return { body: res.body, raw: msg.content };
      return res.body;
    })
      .timeout(Environments.ISLAND_RPC_WAIT_TIMEOUT_MS)
      .catch(Bluebird.TimeoutError, () => this.throwTimeout(name, option.correlationId!))
      .catch(err => {
        err.tattoo = option.headers.tattoo;
        throw err;
      });

    const content = new Buffer(JSON.stringify(msg), 'utf8');
    try {
      await this.channelPool.usingChannel(async chan => chan.publish(name, routingKey, content, option));
    } catch (e) {
      this.waitingResponse[option.correlationId!].reject(e);
      this.waitingResponse = _.omit(this.waitingResponse, option.correlationId!);
    }
    return await p;
  }

  // There are two kind of consumes - get requested / get a response
  // * get-requested consumers can be multiple per a node and they shares a RPC queue between island nodes
  // * get-a-response consumer is only one per a node and it has an exclusive queue
  protected async _consume(key: string, handler: (msg) => Promise<any>, noAck?: boolean): Promise<IConsumerInfo> {
    const channel = await this.consumerChannelPool.acquireChannel();
    const prefetchCount = await this.consumerChannelPool.getPrefetchCount();
    noAck = noAck || false;
    await channel.prefetch(prefetchCount || Environments.getRpcPrefetch());

    const consumer = async msg => {
      try {
        await handler(msg);
        if (!noAck) channel.ack(msg);
      } catch (error) {
        if (this.is503(error)) return nackWithDelay(channel, msg);
        if (this.isCritical(error)) return this.shutdown();
        if (!noAck) channel.ack(msg);
      }
    };
    const opts = {
      consumerTag: [this.serviceName, os.hostname(), key].join('.')
    } as amqp.Options.Consume;
    if (noAck) {
      opts.noAck = noAck;
    }
    const result = await channel.consume(key, consumer, opts);
    return { channel, tag: result.consumerTag, key, consumer };
  }

  private throwTimeout(name, corrId: string) {
    this.waitingResponse = _.omit(this.waitingResponse, corrId);
    this.timedOut[corrId] = name;
    this.timedOutOrdered.push(corrId);
    if (20 < this.timedOutOrdered.length) {
      this.timedOut = _.omit(this.timedOut, this.timedOutOrdered.shift()!);
    }
    const err = new FatalError(ISLAND.FATAL.F0023_RPC_TIMEOUT,
                               `RPC(${name}) does not return in ${Environments.ISLAND_RPC_WAIT_TIMEOUT_MS} ms`);
    err.statusCode = 504;
    throw err;
  }

  private shutdown() {
    process.emit('SIGTERM');
  }

  private makeRoutingKey(): string {
    const now = +new Date();
    const routingKeys = _.keys(_.pickBy(this.queuesAvailableSince.map(d => d < now), Boolean));
    if (routingKeys.length < Math.floor(Environments.getRpcDistribSize() * 0.4)) {
      logger.warning(`Availability of RPC queues are under 40%`);
      // We should send this request anyway
      return _.sample(_.keys(this.queuesAvailableSince))!;
    } else if (routingKeys.length < Math.floor(Environments.getRpcDistribSize() * 0.7)) {
      logger.notice(`Availability of RPC queues are under 70%`);
    }
    return _.sample(routingKeys)!;
  }

  private makeResponseQueueName() {
    // NOTE: live docker 환경에서는 같은 hostname + process.pid 조합이 유일하지 않을 수 있다
    // docker 내부의 process id 는 1인 경우가 대부분이며 host=net으로 실행시키는 경우 hostname도 동일할 수 있다.
    return `rpc.res.${this.serviceName}.${os.hostname()}.${uuid.v4()}`;
  }

  private consumeForResponse() {
    return this._consume(this.responseQueueName, (msg: Message | null) => {
      if (!msg) {
        logger.crit(`The consumer is canceled, will lose following responses - https://goo.gl/HIgy4D`);
        throw new FatalError(ISLAND.FATAL.F0027_CONSUMER_IS_CANCELED);
      }
      const correlationId = msg.properties.correlationId;
      if (!correlationId) {
        logger.notice('Got a response with no correlationId');
        return;
      }
      if (correlationId === 'system.diagnosis') {
        return this.onSystemDiagnosis(msg);
      }
      if (this.timedOut[correlationId]) {
        const name = this.timedOut[correlationId];
        this.timedOut = _.omit(this.timedOut, correlationId);
        this.timedOutOrdered = _.pull(this.timedOutOrdered, correlationId);

        logger.warning(`Got a response of \`${name}\` after timed out - ${correlationId}`);
        return;
      }
      const waiting = this.waitingResponse[correlationId];
      if (!waiting) {
        logger.notice(`Got an unknown response - ${correlationId}`);
        return;
      }
      this.waitingResponse = _.omit(this.waitingResponse, correlationId);
      return waiting.resolve(msg);
    }, Environments.ISLAND_RPC_RES_NOACK);
  }

  private async onSystemDiagnosis(msg: Message) {
    const body: SystemDiagnosisPayload = JSON.parse(msg.content.toString());
    const response = await this.dispatchDiagnosis(body);
    response.timestamp = +new Date();
    fs.appendFile(
      body.fileName,
      JSON.stringify({
        timestamp: +new Date(),
        message: JSON.stringify(response.message),
        error: JSON.stringify(response.error) }),
      err => {
        err && console.error(err);
      }
    );
  }

  private async dispatchDiagnosis(body: SystemDiagnosisPayload):
      Promise<{ timestamp?: number, message?: any, error?: any }> {
    const subCommand = body.cmd.split(':')[1];
    if (!subCommand) {
      return this.onDiagnosisRpc(body);
    }
    switch (subCommand) {
      case 'list':
        return { message: this.rpcEntities };
    }
    return { message: '' };
  }

  private async onDiagnosisRpc(body: SystemDiagnosisPayload) {
    const args = body.args;
    try {
      if (!this.rpcEntities[args.name!] && !_.get(args, 'opts.remote')) {
        throw new Error('no such RPC - ' + args.name);
      }
      return {
        message: await this.invoke(args.name!, args.query || {})
      };
    } catch (e) {
      const error: any = {
        message: e.message
      };
      if (_.get(args, 'opts.stack')) {
        error.stack = e.stack;
      }
      return { error };
    }
  }

  private waitResponse(corrId: string, handleResponse: (msg: Message) => any) {
    return new Bluebird((resolve, reject) => {
      this.waitingResponse[corrId] = { resolve, reject };
    }).then((msg: Message) => {
      const clsScoped = cls.getNamespace('app').bind((msg: Message) => {
        this.waitingResponse = _.omit(this.waitingResponse, corrId);
        return handleResponse(msg);
      });
      return clsScoped(msg);
    });
  }

  private makeInvokeOption(name: string): amqp.Options.Publish {
    const correlationId = uuid.v4();
    RouteLogger.saveLog({ clsNameSpace: 'app', context: name, type: 'req', protocol: 'RPC', correlationId });
    return {
      correlationId,
      expiration: Environments.ISLAND_RPC_WAIT_TIMEOUT_MS,
      headers: this.makeInvokeHeader(),
      replyTo: this.responseQueueName,
      timestamp: +(new Date())
    };
  }

  private makeInvokeHeader(): any {
    const ns = cls.getNamespace('app');
    return {
      tattoo: ns.get('RequestTrackId'),
      from: {
        node: Environments.getHostName(),
        context: ns.get('Context'),
        island: this.serviceName,
        type: ns.get('Type')
      },
      extra: {
        sessionType: ns.get('sessionType'),
        routeLogs: RouteLogger.getLogs('app')
      }
    };
  }

  // 503(Service Temporarily Unavailable) 오류일 때는 응답을 caller에게 안보내줘야함
  private async earlyThrowWith503(rpcName, err, msg) {
    // Requeue the message when it has a chance
    if (this.is503(err)) throw err;
    return err;
  }

  private is503(err) {
    return err.statusCode && parseInt(err.statusCode, 10) === 503;
  }

  private isCritical(err) {
    return err.code === mergeIslandJsError(ISLAND.FATAL.F0027_CONSUMER_IS_CANCELED);
  }

  private logRpcError(err) {
    logger.error(`Got an error during ${err.extra.island}/${err.extra.rpcName}` +
      ` with ${JSON.stringify(err.extra.req)} - ${err.stack}`);
  }

  private attachExtraError(err: AbstractError, rpcName: string, req: any) {
    err.extra = _.defaults({}, err.extra, { island: this.serviceName, rpcName, req });
    err.extra = AbstractError.ensureUuid(err.extra);
    return err;
  }

  // returns value again for convenience
  private async reply(replyTo: string, value: any, options: amqp.Options.Publish) {
    options.headers = this.makeReplyHeader(options);
    await this.channelPool.usingChannel(async channel => {
      return channel.sendToQueue(replyTo, RpcResponse.encode(value), options);
    });
    return value;
  }

  private makeReplyHeader(options: amqp.Options.Publish) {
    if (options.headers && options.headers.extra) {
      const ns = cls.getNamespace('app');
      RouteLogger.saveLog({
        clsNameSpace: 'app',
        context: ns.get('Context'),
        type: 'res',
        protocol: 'RPC',
        correlationId: options.correlationId || ''
      });
      RouteLogger.print('app');
      options.headers.extra.routeLogs = RouteLogger.getLogs('app');
    }

    return options.headers;
  }

  // enter continuation-local-storage scope
  private enterCLS(tattoo, rpcName, extra, func) {
    const properties = _.merge({ RequestTrackId: tattoo, Context: rpcName, Type: 'rpc' }, extra);
    return new Promise((resolve, reject) => {
      const ns = cls.getNamespace('app');
      ns.run(() => {
        _.each(properties, (value, key: string) => {
          ns.set(key, value);
        });
        Bluebird.try(func).then(resolve).catch(reject);
      });
    });
  }

  private async dohook(prefix: 'pre' | 'post' | 'pre-error' | 'post-error', type: 'endpoint' | 'rpc', value) {
    const hookType = {
      endpoint: {
        pre: RpcHookType.PRE_ENDPOINT, post: RpcHookType.POST_ENDPOINT,
        'pre-error': RpcHookType.PRE_ENDPOINT_ERROR, 'post-error': RpcHookType.POST_ENDPOINT_ERROR
      },
      rpc: {
        pre: RpcHookType.PRE_RPC, post: RpcHookType.POST_RPC,
        'pre-error': RpcHookType.PRE_RPC_ERROR, 'post-error': RpcHookType.POST_RPC_ERROR
      }
    }[type][prefix];
    const hook = this.hooks[hookType];
    if (!hook) return value;
    return Bluebird.reduce(this.hooks[hookType], (value, hook) => hook(value), value);
  }

  private async assertQueues(queues: string[]): Promise<void> {
    await this.consumerChannelPool.usingChannel(async channel => {
      await Promise.all(_.map(queues, async (queue: string) => {
        await channel.assertQueue(queue,
                                  { durable: false,
                                    expires: Environments.ISLAND_RPC_WAIT_TIMEOUT_MS +
                                             Environments.ISLAND_SERVICE_LOAD_TIME_MS
                                  });
      }));
    });
  }

  private async assertExchanges(rpcEntities: RpcEntities): Promise<void> {
    await this.consumerChannelPool.usingChannel(async channel => {
      await Promise.all(_.map(rpcEntities, async ({ type, handler, rpcOptions }, rpcName: string) => {
        await channel.assertExchange(rpcName, 'direct', { autoDelete: true, durable: false });
      }));
    });
  }

  private async bindQueuesToExchanges(queues: string[], rpcEntities: RpcEntities): Promise<void> {
    const bindInfos = _.flatten(_.map(_.keys(this.rpcEntities), rpcName => {
      return _.map(queues, queue => ({ queue, rpcName, routingKey: _.last(queue.split('.')) } ));
    }));
    await this.consumerChannelPool.usingChannel(async channel => {
      await Promise.all(_.map(bindInfos, async ({queue, rpcName, routingKey}) => {
        await channel.bindQueue(queue, rpcName, routingKey!);
      }));
    });
  }

  private async startConsumingQueues(queues: string[]): Promise<void> {
    await this.consumerChannelPool.usingChannel(async channel => {
      await Bluebird.each(queues, async (queue, shard) => {
        const consumerInfo = await this.startConsumingQueue(queue, shard);
        this.requestConsumerInfo.push(consumerInfo);
      });
    });
  }

  private determineFlowControl(shard: number, timestamp = 0, extra: any) {
    const now = +new Date();
    if (now - timestamp > 300) {
      logger.notice(`RPC queue.${shard} behinds ${now - timestamp}ms by flow control`);
      extra.flow = true;
    }
  }

  private async startConsumingQueue(queue: string, shard: number): Promise<IConsumerInfo> {
    return this._consume(queue, async (msg: Message) => {
      const rpcName = msg.fields.exchange;
      if (!this.rpcEntities[rpcName]) {
        logger.warning('no such RPC found', rpcName);
        return;
      }
      const { type, handler, rpcOptions } = this.rpcEntities[rpcName];
      const { replyTo, headers, correlationId, timestamp } = msg.properties;
      if (!replyTo) throw new FatalError(ISLAND.FATAL.F0026_MISSING_REPLYTO_IN_RPC);

      const tattoo = headers && headers.tattoo;
      const extra = headers && headers.extra || {};
      this.determineFlowControl(shard, timestamp, extra);
      return this.enterCLS(tattoo, rpcName, extra, async () => {
        const options = { correlationId, headers };
        const parsed = JSON.parse(msg.content.toString('utf8'), RpcResponse.reviver);
        const requestId: string = collector.collectRequestAndReceivedTime(type, rpcName, { msg, shard });
        try {
          await Bluebird.resolve()
            .then(()  => sanitizeAndValidate(parsed, rpcOptions))
            .tap (req => logger.debug(`[RPC][REQ] ${rpcName} with ${JSON.stringify(req, null, 2)}`))
            .then(req => this.dohook('pre', type, req))
            .then(req => handler(req))
            .then(res => this.dohook('post', type, res))
            .then(res => sanitizeAndValidateResult(res, rpcOptions))
            .then(res => this.reply(replyTo, res, options))
            .tap (res => logger.debug(`[RPC][RESP] ${JSON.stringify(res, null, 2)} ${type}, ${rpcName}`))
            .timeout(Environments.ISLAND_RPC_EXEC_TIMEOUT_MS);
        } catch (err) {
          await Bluebird.resolve(err)
            .then(err => this.earlyThrowWith503(rpcName, err, msg))
            .then(err => this.dohook('pre-error', type, err))
            .then(err => this.attachExtraError(err, rpcName, parsed))
            .then(err => this.reply(replyTo, err, options))
            .then(err => this.dohook('post-error', type, err))
            .tap (() => collector.collectExecutedCountAndExecutedTime(type, rpcName, { requestId, err }))
            .tap (err => this.logRpcError(err));
          throw err;
        } finally {
          collector.collectExecutedCountAndExecutedTime(type, rpcName, { requestId });
          if (this.purging && collector.getOnGoingRequestCount('rpc') < 1) {
            this.purging();
          }
        }
      });
    });
  }
}
