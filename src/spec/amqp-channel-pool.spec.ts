import { AmqpChannelPoolService } from '../services/amqp-channel-pool-service';
import { jasmineAsyncAdapter as spec } from '../utils/jasmine-async-support';

fdescribe('AmqpChannelPool', () => {
  const amqpChannelPool = new AmqpChannelPoolService();

  beforeEach(spec(async () => {
    return amqpChannelPool.initialize({
      url: process.env.RABBITMQ_HOST || 'amqp://rabbitmq:5672'
    });
  }));

  afterEach(spec(async () => amqpChannelPool.purge()));

  it('can acquire a channel and release it', spec(async () => {
    const channel = await amqpChannelPool.acquireChannel();
    expect(channel).not.toBeUndefined();
    const exchange = `spec.temp.${+new Date()}`;
    await channel.assertExchange(exchange, 'fanout', {autoDelete: true});
    await channel.deleteExchange(exchange);
    await amqpChannelPool.releaseChannel(channel);
  }));

  it('can use channel disposer', spec(async () => {
    expect((amqpChannelPool as any).idleChannels.length).toEqual(0);
    await amqpChannelPool.usingChannel(channel => {
      const exchange = `spec.temp.${+new Date()}`;
      return channel.assertExchange(exchange, 'fanout', {autoDelete: true})
        .then(() => channel.deleteExchange(exchange));
    });
    expect((amqpChannelPool as any).idleChannels.length).toEqual(1);
  }));
});
