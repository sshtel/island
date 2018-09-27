import * as Crypto from 'crypto';
import * as _ from 'lodash';
import { EndpointOptions } from '../controllers/endpoint-decorator';
import { Environments } from './environments';
import { Events } from './event';

export interface Endpoints {
  [name: string]: EndpointOptions;
}

export class Information {
  public static getInstance(): Information {
    Information._instance = Information._instance || new Information();
    return Information._instance;
  }

  private static _instance: Information;
  private SERVICE_NAME: string;
  private VERSION: string;
  private SYNCED: boolean = false;
  private ENDPOINTS: Endpoints = {};
  private ENDPOINT_CHECKSUM: string;

  constructor() {
    this.VERSION = Environments.getIslandVersion();
    this.SERVICE_NAME = Environments.getServiceName();
  }

  isSynced(): boolean {
    return this.SYNCED;
  }

  registerEndpoint(name: string, options: EndpointOptions) {
    this.ENDPOINTS[name] = options;
  }

  saveEndpoint() {
    this.ENDPOINT_CHECKSUM = this.checksum(this.ENDPOINTS);
    this.SYNCED = true;
  }

  getSystemInfo(): Events.Arguments.SystemInfo {
    return {
      name: this.SERVICE_NAME,
      version: this.VERSION,
      checksum: this.SYNCED && this.ENDPOINT_CHECKSUM || ''
    };
  }

  getEndpoints(): Events.Arguments.SystemEndpointInfo {
    return {
      name: this.SERVICE_NAME,
      version: this.VERSION,
      checksum: this.SYNCED && this.ENDPOINT_CHECKSUM || '',
      endpoints: this.SYNCED && this.ENDPOINTS || {}
    };
  }

  private checksum(obj: any, algorithm?: string, encoding?: Crypto.HexBase64Latin1Encoding): string {
    const str = JSON.stringify((_(obj).toPairs().sortBy(0) as any).fromPairs().value());
    return Crypto.createHash(algorithm || 'md5').update(str, 'utf8').digest(encoding || 'hex');
  }
}
export const information = Information.getInstance();
