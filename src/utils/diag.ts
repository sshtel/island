import { Channel } from 'amqplib';
import * as Bluebird from 'bluebird';
import * as fs from 'fs';
import * as _ from 'lodash';

import { AmqpChannelPoolService } from '../services/amqp-channel-pool-service';
import { Environments } from './environments';
import { RpcSchemaOptions } from './rpc-request';

export interface DiagRpcArgs {
  name?: string;
  query?: any;
  plainQuery?: string;
  opts?: {
    stack?: boolean,
    remote?: boolean
  };
}

// internal

async function getAmqpChannelPoolService(fileName: string) {
  fs.writeFileSync(fileName, '');

  const channelPoolService = new AmqpChannelPoolService();
  const url = Environments.ISLAND_RABBITMQ_EVENT_HOST!;

  await channelPoolService.initialize({ url });

  return Bluebird.resolve(channelPoolService)
    .disposer(async channelPoolService => {
      await channelPoolService.purge();
      fs.unlinkSync(fileName);
    });
}

async function sendToRpcQueue(chan: Channel, queueName: string, fileName: string, cmd: string, args?: DiagRpcArgs) {
  return chan.sendToQueue(queueName, new Buffer(JSON.stringify({
    fileName, cmd, args
  })), { correlationId: 'system.diagnosis' });
}

// exported

export async function usingChannel(fileName: string, func) {
  return Bluebird.using(getAmqpChannelPoolService(fileName), async (service: AmqpChannelPoolService) => {
    return service.usingChannel(func);
  });
}

export function getProc(type: string = 'event'): { queue: string, status: string } {
  try {
    const procTxt = fs.readFileSync(`./${type}.proc`, 'utf-8');
    return JSON.parse(procTxt);
  } catch (e) {
    return { queue: '', status: 'stopped' };
  }
}

export async function sendToQueue(chan: Channel, queueName: string, payload: any) {
  return chan.sendToQueue(queueName, new Buffer(JSON.stringify(payload)));
}

export function parseRpcList(response) {
  return _.map(JSON.parse(response.message), (rpc: RpcSchemaOptions, name) => {
    const validation = _.get(rpc, 'rpcOptions.schema.query.validation');
    let schema;
    if (validation) {
      if (validation.type === 'object') {
        schema = _.map(validation.properties, (property, name) => {
          return [name, property.type].join(':');
        }).join(', ');
      } else {
        schema = validation.type;
      }
    }
    return [name, schema].filter(Boolean).join(' - ');
  });
}

export async function diagRpcSub(chan: Channel, queueName: string, fileName: string, subCommand: string) {
  return sendToRpcQueue(chan, queueName, fileName, 'rpc:' + subCommand, { opts: { stack: true }});
}

export async function diagRpc(chan: Channel, queueName: string, fileName: string, rpcName: string,
                              rpcArgs?: DiagRpcArgs) {
  rpcArgs = rpcArgs || {};
  rpcArgs.name = rpcName;
  if (rpcArgs.plainQuery) {
    rpcArgs.query = JSON.parse(rpcArgs.plainQuery);
  }
  return sendToRpcQueue(chan, queueName, fileName, 'rpc', rpcArgs);
}

export async function readResponse(fileName: string): Promise<any> {
  await Bluebird.delay(1000);
  return new Promise((res, rej) => {
    const rs = fs.createReadStream(fileName);
    let data = '';
    rs.on('data', chunks => {
      data += chunks;
    });
    rs.on('end', () => {
      if (data.length === 0) {
        data = '"not responding"';
      }
      res(JSON.parse(data));
    });
    rs.on('error', rej);
  });
}
