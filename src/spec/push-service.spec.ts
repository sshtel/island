import Bluebird = require('bluebird');
import { AmqpChannelPoolService } from '../services/amqp-channel-pool-service';
import PushService from '../services/push-service';
import MessagePack from '../utils/msgpack';

describe('PushService test : ', () => {
  const pushService = new PushService();
  const amqpChannelPool = new AmqpChannelPoolService();
  let msgpack: MessagePack;
  msgpack = MessagePack.getInst();

  const destinationExchange = 'dddddd_ex';
  const destinationQueue = 'dddddd_que';
  const sourceQueue = 'ssssss_que';
  const sourceExchange = 'ssssss_ex';

  beforeAll(done => {
    const url = process.env.RABBITMQ_HOST || 'amqp://rabbitmq:5672';

    return amqpChannelPool.initialize({ url })
      .then(() => pushService.initialize(amqpChannelPool))
      .then(() =>
        amqpChannelPool.usingChannel(channel => {
          channel.assertQueue(sourceQueue, {});
          channel.assertQueue(destinationQueue, {});
          channel.assertExchange(destinationExchange, 'fanout', { durable: true, autoDelete: true });
          return channel.assertExchange(sourceExchange, 'fanout', { durable: true, autoDelete: true });
        })
          .then(() => amqpChannelPool.usingChannel(channel => {
            channel.bindQueue(destinationQueue, destinationExchange, '');
            return channel.bindQueue(sourceQueue, sourceExchange, '');
          }))
          .then(() => {
            return pushService.bindExchange(destinationExchange, sourceExchange);
          })
      )
      .then(() => done());
  });

  afterAll(done => {
    pushService.unbindExchange(destinationExchange, sourceExchange)
      .then(() =>
        pushService.deleteExchange(destinationExchange)
      )
      .then(() =>
        pushService.deleteExchange(sourceExchange)
      )
      .then(() =>
        pushService.purge()
      )
      .then(() => amqpChannelPool.purge())
      .then(done)
      .catch(done.fail);
  });

  it('push test #1: unicast test', done => {
    const msg = 'testMessage';
    amqpChannelPool.usingChannel(channel => {
      return channel.consume(destinationQueue, content => {
        expect(msgpack.decode(content && content.content)).toBe('testMessage');
      });
    }).then(() => {
      return pushService.unicast(sourceExchange, msg);
    })
      .then(done, done.fail);
  });

  it('push test #2: multicast test', done => {
    const msg = 'testMessage';
    amqpChannelPool.usingChannel(channel => {
      return channel.consume(destinationQueue, content => {
        expect(msgpack.decode(content && content.content)).toBe('testMessage');
      });
    }).then(() => {
      return pushService.multicast(sourceExchange, msg);
    })
      .then(done, done.fail);
  });

  it('push test #3: msgpack Error test', () => {
    expect(() => {
      return new MessagePack();
    }).toThrow();
  });

  it('push test #4: msgpack Encode test', () => {
    expect(() => {
      msgpack.encode(undefined);
    }).toThrow();
  });

  it('push test #5: msgpack Encode Date test', done => {
    const content = new Date();
    return Bluebird.try(() => {
      msgpack.encode(content);
    })
      .catch(err => {
        console.log('msgpack Encode Date test : ', err);
        return;
      })
      .then(done, done.fail);
  });

  it('push test #6: msgpack Encode Error test', done => {
    const content = new Error('test Err');
    return Bluebird.try(() => {
      msgpack.encode(content);
    })
      .catch(err => {
        console.log('msgpack Encode Error test : ', err);
        return;
      })
      .then(done, done.fail);
  });

});
