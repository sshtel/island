import { AmqpChannelPoolService } from '../services/amqp-channel-pool-service';
import { jasmineAsyncAdapter as spec } from '../utils/jasmine-async-support';

describe('AmqpChannelPool', () => {
  const amqpChannelPool = new AmqpChannelPoolService();

  beforeEach(spec(async () => {
    return amqpChannelPool.initialize({
      url: process.env.RABBITMQ_HOST || 'amqp://rabbitmq:5672',
      poolSize: 3
    });
  }));

  afterEach(spec(async () => amqpChannelPool.purge()));

  it('can acquire a channel and release it', spec(async () => {
    const channel = await amqpChannelPool.acquireChannel();
    expect(channel).not.toBeUndefined();
    const xName = `spec.temp.${+new Date()}`;
    await channel.assertExchange(xName, 'fanout', {autoDelete: true});
    await channel.deleteExchange(xName);
    await amqpChannelPool.releaseChannel(channel);
  }));

  it('can use channel disposer', spec(async () => {
    expect((amqpChannelPool as any).idleChannels.length).toEqual(0);
    await amqpChannelPool.usingChannel(async channel => {
      const xName = `spec.temp.${+new Date()}`;
      await channel.assertExchange(xName, 'fanout', {autoDelete: true});
      await channel.deleteExchange(xName);
    });
    expect((amqpChannelPool as any).idleChannels.length).toEqual(1);
  }));

  it('should remove the channel that got an error', spec(async () => {
    expect((amqpChannelPool as any).idleChannels.length).toEqual(0);

    await amqpChannelPool.usingChannel(async channel => {
      const xName = `spec.temp.${+new Date()}`;
      await channel.assertExchange(xName, 'fanout', {autoDelete: true});
    });
    await amqpChannelPool.usingChannel(async channel => {
      const xName = `spec.temp2.${+new Date()}`;
      await channel.assertExchange(xName, 'fanout', {autoDelete: true});
      // force to raise error by using the same exchange name and a different option
      try {
        await channel.assertExchange(xName, 'fanout', {autoDelete: false});
      } catch (e) {}
    });
    expect((amqpChannelPool as any).idleChannels.length).toEqual(1);
  }));

  it('should not allow a miss in a race condition', spec(async () => {
    expect((amqpChannelPool as any).idleChannels.length).toEqual(0);
    await Promise.all([
      amqpChannelPool.acquireChannel(),
      amqpChannelPool.acquireChannel(),
      amqpChannelPool.acquireChannel(),
      amqpChannelPool.acquireChannel()
    ]);
    expect((amqpChannelPool as any).idleChannels.length).toEqual(3);
  }));
});
