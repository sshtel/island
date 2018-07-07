#!/usr/bin/env node

// tslint:disable-next-line
require('source-map-support').install();

import { Channel } from 'amqplib';
import { v4 } from 'uuid';

import { diagRpc, diagRpcSub, getProc, parseRpcList, readResponse, sendToQueue, usingChannel } from './diag';

async function handleEvent(channel: Channel, queueName: string, fileName: string, args: string[]) {
  await sendToQueue(channel, queueName, { fileName, args });
}

async function handleRpc(channel: Channel, queueName: string, fileName: string, args: string[], subCommand?: string) {
  if (subCommand) {
    return diagRpcSub(channel, queueName, fileName, subCommand);
  }
  const [, rpcName, plainQuery] = args;
  try {
    if (plainQuery) {
      JSON.parse(plainQuery);
    }
  } catch (_e) {
    console.log('A following argument of RPC must be well-formed JSON');
    return process.exit(1);
  }
  return diagRpc(channel, queueName, fileName, rpcName, { plainQuery });
}

async function main(args: string[]) {
  const fileName = v4().split('-')[0] + '.txt';
  return usingChannel(fileName, async (channel: Channel) => {
    const [command, subCommand] = args[0].split(':');
    const type = command === 'rpc' && 'rpc' || 'event';
    const proc = getProc(type);
    if (proc.status !== 'started') {
      console.log(`"${proc.status}"`);
      return process.exit(1);
    }
    switch (type) {
      case 'event':
        await handleEvent(channel, proc.queue, fileName, args);
        break;

    case 'rpc':
        await handleRpc(channel, proc.queue, fileName, args, subCommand);
        break;
    }
    const response = await readResponse(fileName);
    if (type === 'rpc' && subCommand === 'list') {
      console.log(parseRpcList(response));
      return;
    }
    console.log(response);
  });
}

if (!module.parent) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    console.error(e);
  }
}
