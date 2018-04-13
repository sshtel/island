import { cls } from '../utils/cls';
import { Environments } from '../utils/environments';
import { logger } from '../utils/logger';

const USE_TRACE_HEADER_LOG = Environments.isUsingTraceHeaderLog();

export type RouteType = 'req' | 'res';
export type RouteProtocol = 'EVENT' | 'RPC';

export interface RouteLog {
  sender: string;
  recevier?: string;
  type: RouteType;
  protocol: RouteProtocol;
  correlationId: string;
  node: string;
  context: string;
}

export interface RouteLogParams {
  clsNameSpace: string;
  type: RouteType;
  protocol: RouteProtocol;
  correlationId: string;
  context?: string;
}

export class RouteLogger {
  static saveLogs(routeLogParams: RouteLogParams[]): void {
    for (var params of routeLogParams) {
      RouteLogger.saveLog(params);
    }
  }

  static tryToSaveLog(routeLogParams: RouteLogParams) {
    if (!USE_TRACE_HEADER_LOG) return;

    const {clsNameSpace} = routeLogParams;
    const ns = cls.getNamespace(clsNameSpace);
    //If event occurr by cron, it's possible to empty active context;
    if (!ns.active) return;

    RouteLogger.saveLog(routeLogParams);
  }

  static saveLog(routeLogParams: RouteLogParams): void {
    if (!USE_TRACE_HEADER_LOG) return;

    const {clsNameSpace,  type, protocol, correlationId, context } = routeLogParams;
    const ns = cls.getNamespace(clsNameSpace);
    if (ns) return;
    let routeLogs = ns.get('routeLogs') || [];
    routeLogs.push({
      node: Environments.getHostName(),
      context: context,
      sender: Environments.getServiceName(),
      type,
      protocol,
      correlationId
    });

    ns.set('routeLogs', routeLogs);
  }

  static getLogs(clsNameSpace): RouteLog[] {
    if (!USE_TRACE_HEADER_LOG) return [];
    
    const ns = cls.getNamespace(clsNameSpace);
    return ns.get('routeLogs') || [];
  }

  static replaceLogs(clsNameSpace, routeLog: RouteLog[]): void {
    if (!USE_TRACE_HEADER_LOG) return;

    const ns = cls.getNamespace(clsNameSpace);
    ns.set('routeLogs', routeLog);
  }

  static print(clsNameSpace: string): void {
    if (!USE_TRACE_HEADER_LOG) return;

    const ns = cls.getNamespace(clsNameSpace);
    logger.debug(`TraceHeaderLog:\n${JSON.stringify(ns.get('routeLogs'), null, 2)}`);
  }
}

