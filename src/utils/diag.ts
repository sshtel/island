import { Channel } from 'amqplib';
import * as Bluebird from 'bluebird';
import * as fs from 'fs';

import { AmqpChannelPoolService } from '../services/amqp-channel-pool-service';
import { Environments } from './environments';

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

export async function usingChannel(fileName: string, func) {
  return Bluebird.using(getAmqpChannelPoolService(fileName), async (service: AmqpChannelPoolService) => {
    return service.usingChannel(func);
  });
}

export function getProc(): { queue: string, status: string } {
  try {
    const procTxt = fs.readFileSync('./event.proc', 'utf-8');
    return JSON.parse(procTxt);
  } catch (e) {
    return { queue: '', status: 'stopped' };
  }
}

export async function sendToQueue(chan: Channel, queueName: string, payload: any) {
  return chan.sendToQueue(queueName, new Buffer(JSON.stringify(payload)));
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
