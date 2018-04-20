import { env, LoadEnv } from '../utils/env-loader';

export type LoggerLevel = 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'crit';

export class IslandEnvironments {
  private static _instance: IslandEnvironments;

  @env({ legacyKeys: ['SERVICE_NAME'] })
  public ISLAND_SERVICE_NAME: string = 'no-service-name';

  @env({ legacyKeys: ['HOSTNAME'] })
  public ISLAND_HOST_NAME: string = 'no-host-name';

  @env({ legacyKeys: ['USE_DEV_MODE'] })
  public ISLAND_USE_DEV_MODE: boolean = false;

  @env({ required: false, legacyKeys: ['SERIALIZE_FORMAT_PUSH'] })
  public ISLAND_SERIALIZE_FORMAT_PUSH: string;

  @env({ legacyKeys: ['EVENT_PREFETCH'] })
  public ISLAND_EVENT_PREFETCH: number = 100;

  @env({ legacyKeys: ['RPC_PREFETCH'] })
  public ISLAND_RPC_PREFETCH: number = 100;

  @env()
  public ISLAND_RPC_EXEC_TIMEOUT_MS: number = 25000;

  @env()
  public ISLAND_RPC_WAIT_TIMEOUT_MS: number = 60000;

  @env()
  public ISLAND_SERVICE_LOAD_TIME_MS: number = 60000;

  @env({ eq: ['debug', 'info', 'notice', 'warning', 'error', 'crit'] })
  public ISLAND_LOGGER_LEVEL: string = 'info';

  @env({ eq: ['short', 'long', 'json'] })
  public ISLAND_LOGGER_TYPE: string = 'short';

  @env()
  public ISLAND_RPC_RES_NOACK: boolean = false;

  @env({ legacyKeys: ['NO_REVIVER'] })
  public ISLAND_NO_REVIVER: boolean = false;

  @env({ legacyKeys: ['STATUS_EXPORT'] })
  public ISLAND_STATUS_EXPORT: boolean = false;

  @env({ legacyKeys: ['STATUS_EXPORT_TIME_MS'] })
  public ISLAND_STATUS_EXPORT_TIME_MS: number = 10 * 1000;

  @env({ required: false, legacyKeys: ['STATUS_FILE_NAME'] })
  public ISLAND_STATUS_FILE_NAME: string;

  @env({ legacyKeys: ['STATUS_EXPORT_TYPE'] })
  public ISLAND_STATUS_EXPORT_TYPE: string = 'FILE';

  @env({ required: false })
  public ISLAND_TRACEMQ_HOST: string;

  @env()
  public ISLAND_TRACEMQ_QUEUE: string = 'trace';

  @env()
  public ISLAND_TRACE_HEADER_LOG: boolean = false;

  @env({ required: false, legacyKeys: ['ENDPOINT_SESSION_GROUP'] })
  public ISLAND_ENDPOINT_SESSION_GROUP: string;

  // @env({ default: '' })
  // public ISLAND_IGNORE_EVENT_LOG: string;

  @env({ legacyKeys: ['CONSUL_HOST'] })
  public ISLAND_CONSUL_HOST: string = 'consul';

  @env({ legacyKeys: ['CONSUL_PORT'] })
  public ISLAND_CONSUL_PORT: string = '8500'; // Why String???

  @env({ required: false, legacyKeys: ['CONSUL_NAMESPACE'] })
  public ISLAND_CONSUL_NAMESPACE: string;

  @env({ required: false, legacyKeys: ['CONSUL_TOKEN'] })
  public ISLAND_CONSUL_TOKEN: string;

  @env({ legacyKeys: ['RABBITMQ_HOST'] })
  public ISLAND_RABBITMQ_HOST: string = 'amqp://rabbitmq:5672';

  @env({ required: false, legacyKeys: ['RABBITMQ_PUSH_HOST'] })
  public ISLAND_RABBITMQ_PUSH_HOST: string;

  @env({ required: false, legacyKeys: ['RABBITMQ_RPC_HOST'] })
  public ISLAND_RABBITMQ_RPC_HOST: string;

  @env({ required: false, legacyKeys: ['RABBITMQ_EVENT_HOST'] })
  public ISLAND_RABBITMQ_EVENT_HOST: string;

  @env({ legacyKeys: ['RABBITMQ_POOLSIZE'] })
  public ISLAND_RABBITMQ_POOLSIZE: number = 100;

  @env({ required: false, legacyKeys: ['REDIS_AUTH'] })
  public ISLAND_REDIS_AUTH: string;

  @env({ legacyKeys: ['REDIS_HOST'] })
  public ISLAND_REDIS_HOST: string = 'redis';

  @env({ legacyKeys: ['REDIS_PORT'] })
  public ISLAND_REDIS_PORT: number = 6379;

  @env({ legacyKeys: ['MONGO_HOST'] })
  public ISLAND_MONGO_HOST: string = 'mongodb://mongodb:27017';

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

  public getSerializeFormatPush(): string | undefined {
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

  public isNoReviver(): boolean {
    return this.ISLAND_NO_REVIVER;
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
    return (process.env.ISLAND_IGNORE_EVENT_LOG || '').split(',').join('|');
  }

  public getEndpointSessionGroup(): string | undefined {
    return this.ISLAND_ENDPOINT_SESSION_GROUP;
  }

  constructor() {
    if (IslandEnvironments._instance) {
      throw new Error(`Error - use IslandEnvironments.getInstance()`);
    }
    LoadEnv(this);
  }

  public refreshEnvForDebug() {
    LoadEnv(this);
  }

  public static getInstance(): IslandEnvironments {
    IslandEnvironments._instance = IslandEnvironments._instance || new IslandEnvironments();
    return IslandEnvironments._instance;
  }
}

export const Environments = IslandEnvironments.getInstance();
