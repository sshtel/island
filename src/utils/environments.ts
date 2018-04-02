export class Environments {
  static isDevMode(): boolean {
    return process.env.USE_DEV_MODE === 'true';
  }

  static getHostName(): string {
    return process.env.HOSTNAME;
  }

  static getServiceName(): string {
    return process.env.SERVICE_NAME;
  }

  static getEventPrefetch(): number {
    return +process.env.EVENT_PREFETCH || 100;
  }

  static getRpcPrefetch(): number {
    return +process.env.RPC_PREFETCH || 100;
  }

  static getSerializeFormatPush(): string {
    return process.env.SERIALIZE_FORMAT_PUSH;
  }

  static getIslandRpcExecTimeoutMs(): number {
    return parseInt(process.env.ISLAND_RPC_EXEC_TIMEOUT_MS, 10) || 25000;
  }

  static getIslandRpcWaitTimeoutMs(): number {
    return parseInt(process.env.ISLAND_RPC_WAIT_TIMEOUT_MS, 10) || 60000;
  }

  static getIslandServiceLoadTimeMs(): number {
    return parseInt(process.env.ISLAND_SERVICE_LOAD_TIME_MS, 10) || 60000;
  }

  static isIslandRpcResNoack(): boolean {
    return process.env.ISLAND_RPC_RES_NOACK === 'true';
  }

  static isNoReviver(): boolean {
    return process.env.NO_REVIVER === 'true';
  }

  static getIslandLoggerLevel(): 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'crit' {
    return process.env.ISLAND_LOGGER_LEVEL || 'info';
  }

  static isStatusExport(): boolean {
    return process.env.STATUS_EXPORT === 'true';
  }

  static getStatusExportTimeMs(): number {
    return parseInt(process.env.STATUS_EXPORT_TIME_MS, 10) || 10 * 1000;
  }

  static getStatusFileName(): string {
    return process.env.STATUS_FILE_NAME;
  }

  static getIslandTracemqHost(): string {
    return process.env.ISLAND_TRACEMQ_HOST;
  }

  static getIslandTracemqQueue(): string {
    return process.env.ISLAND_TRACEMQ_QUEUE || 'trace';
  }

  static isUsingTraceHeaderLog(): boolean {
    return process.env.ISLAND_TRACE_HEADER_LOG === 'true';
  }

  static getIgnoreEventLogRegexp(): string {
    return (process.env.ISLAND_IGNORE_EVENT_LOG || '').split(',').join('|');
  }

  static getEndpointSessionGroup(): string {
    return process.env.ENDPOINT_SESSION_GROUP;
  }
}
