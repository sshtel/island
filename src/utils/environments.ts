import ms = require('ms');
import { env, LoadEnv } from '../utils/env-loader';

export type LoggerLevel = 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'crit';

export class IslandEnvironments {
  public static getInstance(): IslandEnvironments {
    IslandEnvironments._instance = IslandEnvironments._instance || new IslandEnvironments();
    return IslandEnvironments._instance;
  }
  private static _instance: IslandEnvironments;

  @env({ legacyKeys: ['SERVICE_NAME'] })
  public ISLAND_SERVICE_NAME: string = 'no-service-name';

  // TraceLog uses this as a name of node
  @env({ legacyKeys: ['HOSTNAME'] })
  public ISLAND_HOST_NAME: string = 'no-host-name';

  // When true, allows APIs which has options.developmentOnly
  @env({ legacyKeys: ['USE_DEV_MODE'] })
  public ISLAND_USE_DEV_MODE: boolean = false;

  // currently able Push format json and msgpack
  @env({ required: false, legacyKeys: ['SERIALIZE_FORMAT_PUSH'] })
  public ISLAND_SERIALIZE_FORMAT_PUSH: string = 'msgpack';

  @env({ legacyKeys: ['EVENT_PREFETCH'] })
  public ISLAND_EVENT_PREFETCH: number = 100;

  // Count of RPC Prefetch
  @env({ legacyKeys: ['RPC_PREFETCH'] })
  public ISLAND_RPC_PREFETCH: number = 100;

  // Timeout during RPC execution
  @env()
  public ISLAND_RPC_EXEC_TIMEOUT: string = '25s';
  // deprecated
  @env()
  public ISLAND_RPC_EXEC_TIMEOUT_MS: number = 0;

  // Timeout during RPC call
  @env()
  public ISLAND_RPC_WAIT_TIMEOUT: string = '60s';
  // deprecated
  @env()
  public ISLAND_RPC_WAIT_TIMEOUT_MS: number = 0;

  // Time to load service
  @env()
  public ISLAND_SERVICE_LOAD_TIME: string = '60s';
  // deprecated
  @env()
  public ISLAND_SERVICE_LOAD_TIME_MS: number = 0;

  // Log level for logger
  @env({ eq: ['debug', 'info', 'notice', 'warning', 'error', 'crit'] })
  public ISLAND_LOGGER_LEVEL: string = 'info';

  @env({ eq: ['short', 'long', 'json'] })
  public ISLAND_LOGGER_TYPE: string = 'short';

  @env()
  public ISLAND_RPC_RES_NOACK: boolean = false;

  @env({ legacyKeys: ['NO_REVIVER'] })
  public ISLAND_NO_REVIVER: boolean = false;

  @env({ legacyKeys: ['USE_REVIVER'] })
  public ISLAND_USE_REVIVER: boolean = false;

  // If it is true, use island-status-exporter
  @env({ legacyKeys: ['STATUS_EXPORT'] })
  public ISLAND_STATUS_EXPORT: boolean = false;

  // Time to save file for instance status
  @env()
  public ISLAND_STATUS_EXPORT_TIME: string = '10s';
  // deprecated
  @env({ legacyKeys: ['STATUS_EXPORT_TIME_MS'] })
  public ISLAND_STATUS_EXPORT_TIME_MS: number = 0;

  // island-status-exporter uses this as a name for file
  @env({ required: false, legacyKeys: ['STATUS_FILE_NAME'] })
  public ISLAND_STATUS_FILE_NAME: string;

  // status-exporter uses this type for saving data
  @env({ legacyKeys: ['STATUS_EXPORT_TYPE'] })
  public ISLAND_STATUS_EXPORT_TYPE: string = 'FILE';

  // MQ(formatted by amqp URI) for TraceLog. If omitted it doesn't log
  @env({ required: false })
  public ISLAND_TRACEMQ_HOST: string;

  // A queue name to log TraceLog
  @env()
  public ISLAND_TRACEMQ_QUEUE: string = 'trace';

  // When true, add trace log to msg.header
  @env()
  public ISLAND_TRACE_HEADER_LOG: boolean = false;

  @env({ required: false, legacyKeys: ['ENDPOINT_SESSION_GROUP'] })
  public ISLAND_ENDPOINT_SESSION_GROUP: string;

  // The address of consul.
  @env({ legacyKeys: ['CONSUL_HOST'] })
  public ISLAND_CONSUL_HOST: string = 'consul';

  // consul port. work with CONSUL_HOST
  @env({ legacyKeys: ['CONSUL_PORT'] })
  public ISLAND_CONSUL_PORT: string = '8500';

  @env({ required: false, legacyKeys: ['CONSUL_NAMESPACE'] })
  public ISLAND_CONSUL_NAMESPACE: string;

  @env({ required: false, legacyKeys: ['CONSUL_TOKEN'] })
  public ISLAND_CONSUL_TOKEN: string;

  // The address of rabbitmq.
  @env({ legacyKeys: ['RABBITMQ_HOST'] })
  public ISLAND_RABBITMQ_HOST: string = 'amqp://rabbitmq:5672';

  @env({ required: false, legacyKeys: ['RABBITMQ_PUSH_HOST', 'ISLAND_RABBITMQ_HOST', 'RABBITMQ_HOST'] })
  public ISLAND_RABBITMQ_PUSH_HOST: string;

  @env({ required: false, legacyKeys: ['RABBITMQ_RPC_HOST', 'ISLAND_RABBITMQ_HOST', 'RABBITMQ_HOST'] })
  public ISLAND_RABBITMQ_RPC_HOST: string;

  @env({ required: false, legacyKeys: ['RABBITMQ_EVENT_HOST', 'ISLAND_RABBITMQ_HOST', 'RABBITMQ_HOST'] })
  public ISLAND_RABBITMQ_EVENT_HOST: string;

  @env({ legacyKeys: ['RABBITMQ_POOLSIZE'] })
  public ISLAND_RABBITMQ_POOLSIZE: number = 100;

  @env({ required: false, legacyKeys: ['REDIS_AUTH'] })
  public ISLAND_REDIS_AUTH: string;

  // The address of redishost.
  @env({ legacyKeys: ['REDIS_HOST'] })
  public ISLAND_REDIS_HOST: string = 'redis';

  @env({ legacyKeys: ['REDIS_PORT'] })
  public ISLAND_REDIS_PORT: number = 6379;

  @env({ legacyKeys: ['MONGO_HOST'] })
  public ISLAND_MONGO_HOST: string = 'mongodb://mongodb:27017';

  @env()
  public ISLAND_RPC_DISTRIB_SIZE: number = 16;

  @env()
  public ISLAND_USE_CIRCUIT_BREAK: boolean = false;

  @env()
  public ISLAND_CIRCUIT_BREAK_TIME: string = '1m';
  // deprecated
  @env()
  public ISLAND_CIRCUIT_BREAK_TIME_MS: number = 0;
  @env()
  public ISLAND_CIRCUIT_BREAK_FAILRATE_THRESHOLD: number = 0.2;
  @env()
  public ISLAND_CIRCUIT_BREAK_REQUEST_THRESHOLD: number = 10;
  @env()
  public ISLAND_FLOWMODE_DELAY_TIME: string = '10s';
  // deprecated
  @env()
  public ISLAND_FLOWMODE_DELAY: number = 0;

  // @env()
  // public ISLAND_IGNORE_EVENT_LOG: string = '';

  constructor() {
    if (IslandEnvironments._instance) {
      throw new Error(`Error - use IslandEnvironments.getInstance()`);
    }
    this.ISLAND_RPC_EXEC_TIMEOUT_MS = this.ISLAND_RPC_EXEC_TIMEOUT_MS === 0
                                      ? ms(this.ISLAND_RPC_EXEC_TIMEOUT)
                                      : this.ISLAND_RPC_EXEC_TIMEOUT_MS;
    this.ISLAND_RPC_WAIT_TIMEOUT_MS = this.ISLAND_RPC_WAIT_TIMEOUT_MS === 0
                                      ? ms(this.ISLAND_RPC_EXEC_TIMEOUT)
                                      : this.ISLAND_RPC_WAIT_TIMEOUT_MS;
    this.ISLAND_SERVICE_LOAD_TIME_MS = this.ISLAND_SERVICE_LOAD_TIME_MS === 0
                                       ? ms(this.ISLAND_SERVICE_LOAD_TIME)
                                       : this.ISLAND_SERVICE_LOAD_TIME_MS;
    this.ISLAND_STATUS_EXPORT_TIME_MS = this.ISLAND_STATUS_EXPORT_TIME_MS === 0
                                        ? ms(this.ISLAND_STATUS_EXPORT_TIME)
                                        : this.ISLAND_STATUS_EXPORT_TIME_MS;
    this.ISLAND_CIRCUIT_BREAK_TIME_MS = this.ISLAND_CIRCUIT_BREAK_TIME_MS === 0
                                        ? ms(this.ISLAND_CIRCUIT_BREAK_TIME)
                                        : this.ISLAND_CIRCUIT_BREAK_TIME_MS;
    this.ISLAND_FLOWMODE_DELAY = this.ISLAND_FLOWMODE_DELAY === 0
                                 ? ms(this.ISLAND_FLOWMODE_DELAY_TIME)
                                 : this.ISLAND_FLOWMODE_DELAY;
    LoadEnv(this);
  }

  public isDevMode(): boolean {
    return this.ISLAND_USE_DEV_MODE;
  }

  public getHostName(): string | undefined {
    return this.ISLAND_HOST_NAME;
  }

  public getServiceName(): string | undefined {
    return this.ISLAND_SERVICE_NAME;
  }

  public getEventPrefetch(): number {
    return this.ISLAND_EVENT_PREFETCH;
  }

  public getRpcPrefetch(): number {
    return this.ISLAND_RPC_PREFETCH;
  }

  public getSerializeFormatPush(): string {
    return this.ISLAND_SERIALIZE_FORMAT_PUSH;
  }

  public getIslandRpcExecTimeoutMs(): number {
    return this.ISLAND_RPC_EXEC_TIMEOUT_MS;
  }

  public getIslandRpcWaitTimeoutMs(): number {
    return this.ISLAND_RPC_WAIT_TIMEOUT_MS;
  }

  public getIslandServiceLoadTimeMs(): number {
    return this.ISLAND_SERVICE_LOAD_TIME_MS;
  }

  public isIslandRpcResNoack(): boolean {
    return this.ISLAND_RPC_RES_NOACK;
  }

  public isUseReviver(): boolean {
    return this.ISLAND_USE_REVIVER;
  }

  public getIslandLoggerLevel(): LoggerLevel {
    return (this.ISLAND_LOGGER_LEVEL) as LoggerLevel;
  }

  public isStatusExport(): boolean {
    return this.ISLAND_STATUS_EXPORT;
  }

  public getStatusExportTimeMs(): number {
    return this.ISLAND_STATUS_EXPORT_TIME_MS;
  }

  public getStatusFileName(): string | undefined {
    return this.ISLAND_STATUS_FILE_NAME;
  }

  public getStatusExportType(): string {
    return this.ISLAND_STATUS_EXPORT_TYPE;
  }

  public getIslandTracemqHost(): string | undefined {
    return this.ISLAND_TRACEMQ_HOST;
  }

  public getIslandTracemqQueue(): string {
    return this.ISLAND_TRACEMQ_QUEUE;
  }

  public isUsingTraceHeaderLog(): boolean {
    return this.ISLAND_TRACE_HEADER_LOG;
  }

  public getIgnoreEventLogRegexp(): string {
    // Ignore the log for Event containing this Env
    return (process.env.ISLAND_IGNORE_EVENT_LOG || '').split(',').join('|');
  }

  public getEndpointSessionGroup(): string | undefined {
    return this.ISLAND_ENDPOINT_SESSION_GROUP;
  }

  public refreshEnvForDebug() {
    LoadEnv(this);
    this.logProperties();
  }

  public logProperties() {
    // Use console.info instead of logger.info
    // for remove circular dependency - logger and environments
    console.info(`[Environments] Default Island Environments`);
    for (const key in this) {
      if (!this.hasOwnProperty(key)) continue;
      console.info(`${key}${' '.repeat(40 - key.length)}: ${this[key]}`);
    }
  }

  public getRpcDistribSize(): number {
    return this.ISLAND_RPC_DISTRIB_SIZE;
  }

  public getFlowModeDelay(): number {
    return this.ISLAND_FLOWMODE_DELAY;
  }
}

export const Environments = IslandEnvironments.getInstance();
