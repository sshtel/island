import { env, LoadEnv } from '../utils/env-loader';

export type LoggerLevel = 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'crit';

export class IslandEnvironments {
  @env({ default: 'no-service-name', legacyKeys: ['SERVICE_NAME'] })
  public ISLAND_SERVICE_NAME!: string;

  @env({ default: 'no-host-name', legacyKeys: ['HOSTNAME'] })
  public ISLAND_HOST_NAME: string;

  @env({ default: false, legacyKeys: ['USE_DEV_MODE'] })
  public ISLAND_USE_DEV_MODE: boolean;

  @env({ default: 100, legacyKeys: ['EVENT_PREFETCH'] })
  public ISLAND_EVENT_PREFETCH: number;

  @env({ default: 100, legacyKeys: ['RPC_PREFETCH'] })
  public ISLAND_RPC_PREFETCH: number;

  @env({ required: false, legacyKeys: ['SERIALIZE_FORMAT_PUSH'] })
  public ISLAND_SERIALIZE_FORMAT_PUSH: string;

  @env({ default: 25000 })
  public ISLAND_RPC_EXEC_TIMEOUT_MS: number;

  @env({ default: 60000 })
  public ISLAND_RPC_WAIT_TIMEOUT_MS: number;

  @env({ default: 60000 })
  public ISLAND_SERVICE_LOAD_TIME_MS: number;

  @env({ default: 'info', eq: ['debug', 'info', 'notice', 'warning', 'error', 'crit'] })
  public ISLAND_LOGGER_LEVEL: string;

  @env({ default: false })
  public ISLAND_RPC_RES_NOACK: boolean;

  @env({ default: false, legacyKeys: ['NO_REVIVER'] })
  public ISLAND_NO_REVIVER: boolean;

  @env({ default: false, legacyKeys: ['STATUS_EXPORT'] })
  public ISLAND_STATUS_EXPORT: boolean;

  @env({ default: 10 * 1000, legacyKeys: ['STATUS_EXPORT_TIME_MS'] })
  public ISLAND_STATUS_EXPORT_TIME_MS: number;

  @env({ required: false, legacyKeys: ['STATUS_FILE_NAME'] })
  public ISLAND_STATUS_FILE_NAME: string;

  @env({ default: 'FILE', legacyKeys: ['STATUS_EXPORT_TYPE'] })
  public ISLAND_STATUS_EXPORT_TYPE: string;

  @env({ required: false })
  public ISLAND_TRACEMQ_HOST: string;

  @env({ default: 'trace' })
  public ISLAND_TRACEMQ_QUEUE: string;

  @env({ default: false })
  public ISLAND_TRACE_HEADER_LOG: boolean;

  @env({ required: false, legacyKeys: ['ENDPOINT_SESSION_GROUP'] })
  public ISLAND_ENDPOINT_SESSION_GROUP: string;

  @env({ default: '' })
  public ISLAND_IGNORE_EVENT_LOG: string;

  @env({ default: 'short', eq: ['short', 'long', 'json'] })
  public ISLAND_LOGGER_TYPE: string;

  @env({ default: 'consul', legacyKeys: ['CONSUL_HOST'] })
  public ISLAND_CONSUL_HOST: string;

  @env({ default: '8500', legacyKeys: ['CONSUL_PORT'] })
  public ISLAND_CONSUL_PORT: string; // Why String???

  @env({ required: false, legacyKeys: ['CONSUL_NAMESPACE'] })
  public ISLAND_CONSUL_NAMESPACE: string;

  @env({ required: false, legacyKeys: ['CONSUL_TOKEN'] })
  public ISLAND_CONSUL_TOKEN: string;

  @env({ default: 'amqp://rabbitmq:5672', legacyKeys: ['RABBITMQ_HOST'] })
  public ISLAND_RABBITMQ_HOST: string;

  @env({ required: false, legacyKeys: ['RABBITMQ_PUSH_HOST'] })
  public ISLAND_RABBITMQ_PUSH_HOST: string;

  @env({ required: false, legacyKeys: ['RABBITMQ_RPC_HOST'] })
  public ISLAND_RABBITMQ_RPC_HOST: string;

  @env({ required: false, legacyKeys: ['RABBITMQ_EVENT_HOST'] })
  public ISLAND_RABBITMQ_EVENT_HOST: string;

  @env({ default: 100, legacyKeys: ['RABBITMQ_POOLSIZE'] })
  public ISLAND_RABBITMQ_POOLSIZE: number;

  @env({ required: false, legacyKeys: ['REDIS_AUTH'] })
  public ISLAND_REDIS_AUTH: string;

  @env({ default: 'redis', legacyKeys: ['REDIS_HOST'] })
  public ISLAND_REDIS_HOST: string;

  @env({ default: 6379, legacyKeys: ['REDIS_PORT'] })
  public ISLAND_REDIS_PORT: number;

  @env({ default: 'mongodb://mongodb:27017', legacyKeys: ['MONGO_HOST'] })
  public ISLAND_MONGO_HOST: string;

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
    return (this.ISLAND_IGNORE_EVENT_LOG).split(',').join('|');
  }

  public getEndpointSessionGroup(): string | undefined {
    return this.ISLAND_ENDPOINT_SESSION_GROUP;
  }

  constructor() {
    LoadEnv(this);
  }
}

export const Environments = new IslandEnvironments();
