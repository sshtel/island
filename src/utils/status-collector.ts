import * as amqp from 'amqplib';
import { CalculatedData, StatusExporter } from 'island-status-exporter';
import * as _ from 'lodash';
import * as uuid from 'uuid';

import Islet from '../islet';
import { EventService } from '../services/event-service';
import { BaseEvent } from '../services/event-subscriber';
import { Environments } from '../utils/environments';
import { logger } from '../utils/logger';

export const STATUS_EXPORT: boolean = Environments.isStatusExport();
export const STATUS_EXPORT_TIME_MS: number = Environments.getStatusExportTimeMs();
const STATUS_FILE_NAME: string = Environments.getStatusFileName()!;
const STATUS_EXPORT_TYPE: string = Environments.getStatusExportType();
const HOST_NAME: string = Environments.getHostName()!;
const SERVICE_NAME: string = Environments.getServiceName()!;
const CIRCUIT_BREAK_THRESHOLD: number = 0.2;
const processUptime: Date = new Date();
// const SAVE_FILE_NAME: string = '';

export class StatusExport extends BaseEvent<CalculatedData> {
  constructor(args: CalculatedData) {
    super('island.status.export', args);
  }
}

if (STATUS_EXPORT)
  StatusExporter.initialize({
    name: STATUS_FILE_NAME,
    hostname: HOST_NAME,
    servicename: SERVICE_NAME
  });

export interface Message {
  content: Buffer;
  properties: amqp.Options.Publish;
}

export interface RequestStatistics {
  onGoingRequestCount: number;
  requestCount: number;
  executedCount: number;
  totalReceivedTime: number;
  totalExecutionTime: number;
  totalErrorTime: number;
}

export interface CollectOptions {
  requestId?: string;
  msg?: Message;
  err?: any;
  ignoreTimestamp?: boolean;
}

class RequestStatisticsMaker {
  static create(): RequestStatistics {
    return {
      onGoingRequestCount: 0,
      requestCount: 0,
      executedCount: 0,
      totalReceivedTime: 0,
      totalExecutionTime: 0,
      totalErrorTime: 0
    } as RequestStatistics;
  }
}

function setDecimalPoint(int: number): number {
  return Number(int.toFixed(2));
}
export class StatusCollector {
  private collectedData: { [type: string]: RequestStatistics } = {};
  private onGoingMap: Map<string, any> = new Map();
  private startedAt: number = +new Date();
  private eventService: EventService;

  public async saveStatus() {
    const calculated: CalculatedData = this.calculateMeasurementsByType();
    switch (STATUS_EXPORT_TYPE) {
      case 'FILE':
        return await StatusExporter.saveStatusJsonFile(calculated);
      case 'EVENT':
        return await this.sendStatusJsonEvent(calculated);
      default:
        break;
    }
  }

  // Note:
  // island.js 통해 받지 않는 요청('gateway의 restify', 'push의 socket') 또는 보낸 곳에서 시간값을 주지 않은 요청의 경우는 time 필드가 없다.
  public collectRequestAndReceivedTime(type: string, name: string, options?: CollectOptions): string {
    const requestId = uuid.v1();
    const reqTime = +new Date();

    const stat: RequestStatistics = this.getStat(type, name);
    ++stat.requestCount;

    if (!options || options.ignoreTimestamp) return requestId;

    this.onGoingMap.set(requestId, { reqTime });

    if (options.msg && options.msg.properties && options.msg.properties.timestamp) {
      stat.totalReceivedTime += reqTime - options.msg.properties.timestamp;
    }

    return requestId;
  }

  public collectExecutedCountAndExecutedTime(type: string, name: string, options: CollectOptions) {
    const stat: RequestStatistics = this.getStat(type, name);

    if (!options.err) ++stat.executedCount;
    if (!options.requestId) return;

    const reqCache = this.onGoingMap.get(options.requestId);
    if (!reqCache) return;

    this.onGoingMap.delete(options.requestId);
    const resTime = +new Date();
    const reqTime = reqCache.reqTime || resTime;
    if (options.err) {
      stat.totalErrorTime += resTime - reqTime;
    } else {
      stat.totalExecutionTime += resTime - reqTime;
    }
  }

  public async sigInfo(type: string) {
    logger.info(`${type} Service onGoingRequestCount : ${this.getOnGoingRequestCount(type)}`);
    _.forEach(this.collectedData, (v: RequestStatistics, k: string) => {
      if (!k.startsWith(type)) return;
      logger.info(`${type} Service ${k} : ${v}`);
    });
  }

  public getOnGoingRequestCount(type: string): number {
    let count = 0;
    _.forEach(this.collectedData, (stat: RequestStatistics, name: string) => {
      if (!name.startsWith(type + '@')) { return; }
      count += stat.onGoingRequestCount;
    });
    return count;
  }

  public hasOngoingRequests(type: string): boolean {
    return this.getOnGoingRequestCount(type) > 0;
  }

  public needCircuitBreak(type: string, name: string): boolean {
    const typeName = [type, name].join('@');
    const stat = this.collectedData[typeName] = this.collectedData[typeName] || RequestStatisticsMaker.create();
    const failedRate = 1 - (stat.executedCount / (stat.requestCount - stat.onGoingRequestCount));
    return failedRate > CIRCUIT_BREAK_THRESHOLD;
  }

  private sendStatusJsonEvent(data: CalculatedData) {
    if (!this.eventService) {
      this.eventService = Islet.getIslet().getAdaptee<EventService>('event');
    }
    return this.eventService && this.eventService.publishEvent(new StatusExport(data));
  }

  private getStat(type: string,  name: string): RequestStatistics {
    const typeName = [type, name].join('@');
    this.collectedData[typeName] = this.collectedData[typeName] || RequestStatisticsMaker.create();
    return this.collectedData[typeName];
  }

  private clearData() {
    this.collectedData = {};
    this.startedAt = +new Date();
  }

  private calculateMeasurementsByType(): CalculatedData {
    const measuringTime = +new Date() - this.startedAt;
    const cd = _.clone(this.collectedData);

    this.clearData();

    const calculatedData: CalculatedData = { processUptime, measurements: [] };
    const obj = [];

    _.forEach(cd, (stat: RequestStatistics, type: string) => {
      obj[type] = obj[type] || {
        type,
        requestPerSeconds: 0,
        executedPerSeconds: 0,
        avgReceiveMessageTimeByMQ: 0,
        avgExecutionTime: 0
      };
      obj[type].requestPerSeconds += stat.requestCount;
      obj[type].executedPerSeconds += stat.executedCount;
      obj[type].avgReceiveMessageTimeByMQ += stat.totalReceivedTime;
      obj[type].avgExecutionTime += stat.totalExecutionTime;
    });

    calculatedData.measurements = [];

    _.forEach(obj, (stat: any) => {
      stat.avgReceiveMessageTimeByMQ = setDecimalPoint(stat.avgReceiveMessageTimeByMQ / stat.requestPerSeconds);
      stat.avgExecutionTime = setDecimalPoint(stat.avgExecutionTime / stat.executedPerSeconds);
      stat.requestPerSeconds = setDecimalPoint(stat.requestPerSeconds / measuringTime);
      stat.executedPerSeconds = setDecimalPoint(stat.executedPerSeconds / measuringTime);

      calculatedData.measurements = calculatedData.measurements || [];
      calculatedData.measurements.push(stat);
    });

    return calculatedData;
  }
}

export const collector = new StatusCollector();
