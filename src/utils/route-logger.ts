import { cls } from 'island-loggers';
import { Environments } from '../utils/environments';
import { logger } from '../utils/logger';

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
  static isEnabled()  {
    return Environments.ISLAND_TRACE_HEADER_LOG;
  }

  static tryToSaveLog(routeLogParams: RouteLogParams) {
    if (!RouteLogger.isEnabled()) return;

    const {clsNameSpace} = routeLogParams;
    const ns = cls.getNamespace(clsNameSpace);
    // If event occurr by cron, it's possible to empty active context;
    if (!ns.active) return;

    RouteLogger.saveLog(routeLogParams);
  }

  static saveLog(routeLogParams: RouteLogParams): void {
    if (!RouteLogger.isEnabled()) return;

    const {clsNameSpace,  type, protocol, correlationId, context } = routeLogParams;
    const ns = cls.getNamespace(clsNameSpace);
    const routeLogs = ns.get('routeLogs') || [];
    routeLogs.push({
      node: Environments.getHostName(),
      context,
      sender: Environments.getServiceName(),
      type,
      protocol,
      correlationId
    });

    ns.set('routeLogs', routeLogs);
  }

  static getLogs(clsNameSpace): RouteLog[] {
    if (!RouteLogger.isEnabled()) return [];

    const ns = cls.getNamespace(clsNameSpace);
    return ns.get('routeLogs') || [];
  }

  static replaceLogs(clsNameSpace, routeLogs: RouteLog[]): void {
    // console.log('replaceLogs', routeLogs);
    if (!RouteLogger.isEnabled()) return;

    const ns = cls.getNamespace(clsNameSpace);
    ns.set('routeLogs', routeLogs);
  }

  static print(clsNameSpace: string): void {
    if (!RouteLogger.isEnabled()) return;

    const ns = cls.getNamespace(clsNameSpace);
    logger.debug(`TraceHeaderLog:\n${JSON.stringify(ns.get('routeLogs'))}`);
  }
}
