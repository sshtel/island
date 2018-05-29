#!/usr/bin/env node

// tslint:disable-next-line
require('source-map-support').install();

import { Channel } from 'amqplib';
import { v4 } from 'uuid';

import { getProc, readResponse, sendToQueue, usingChannel } from './diag';

async function main(args) {
  const fileName = v4().split('-')[0] + '.txt';
  return usingChannel(fileName, async (channel: Channel) => {
    const proc = getProc();
    if (proc.status === 'stopped') {
      console.log('not started');
      return;
    }
    await sendToQueue(channel, proc.queue, { fileName, args });
    const response = await readResponse(fileName);
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
