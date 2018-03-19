import * as cls from 'continuation-local-storage';

import * as amqp from 'amqplib';
import * as _ from 'lodash';

import { CalculatedData, StatusExporter } from 'island-status-exporter';
import { Environments } from '../utils/environments';
import { logger } from '../utils/logger';

export const STATUS_EXPORT: boolean = Environments.isStatusExport();
export const STATUS_EXPORT_TIME_MS: number = Environments.getStatusExportTimeMs();
const STATUS_FILE_NAME: string = Environments.getStatusFileName();
const HOST_NAME: string = Environments.getHostName();
const SERVICE_NAME: string = Environments.getServiceName();
const CIRCUIT_BREAK_THRESHOLD: number = 0.2;
const processUptime: Date = new Date();
// const SAVE_FILE_NAME: string = '';

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
};

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
  private startedAt: number = +new Date();

  public async saveStatus() {
    const exportTarget = 'FILE';
    const calculated: CalculatedData = this.calculateMeasurementsByType();
    switch (exportTarget) {
      case 'FILE':
      return await StatusExporter.saveStatusJsonFile(calculated);
      default:
      break;
    }
  }

  // Note:
  // island.js 통해 받지 않는 요청('gateway의 restify', 'push의 socket') 또는 보낸 곳에서 시간값을 주지 않은 요청의 경우는 time 필드가 없다.
  public collectRequestAndReceivedTime(type: string, name: string, msg?: any) {
    // correlationId

    const stat: RequestStatistics = this.getStat(type, name);
    ++stat.requestCount;
    ++stat.onGoingRequestCount;

    const ns = cls.getNamespace('app');
    const now = +new Date();

    if (msg && msg.properties && msg.properties.timestamp) {
      stat.totalReceivedTime += now - msg.properties.timestamp;
    }
    ns.set('stat.reqTime', now);
  }

  public collectExecutedCountAndExecutedTime(type: string, name: string, err?: any) {
    const stat: RequestStatistics = this.getStat(type, name);
    --stat.onGoingRequestCount;

    const ns = cls.getNamespace('app');
    const reqTime = ns.get('stat.reqTime');
    const resTime = +new Date();

    if (!err) {
      ++stat.executedCount;
      stat.totalExecutionTime += resTime - reqTime;
    } else {
      stat.totalErrorTime += resTime - reqTime;
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
