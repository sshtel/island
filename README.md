# island v1.5

An opinionated, full-stacked Microservices framework for [node](http://nodejs.org), powered by [TypeScript](https://github.com/microsoft/typescript).

[![Build Status][travis-image]][travis-url]
[![NPM version][npm-image]][npm-url]
[![Dependency Status][david-image]][david-url]
[![Coverage Status][coveralls-image]][coveralls-url]
[![Test Coverage][codeclimate-coverage]][codeclimate-url]
[![Code Climate][codeclimate-gpa]][codeclimate-url]
[![Issue Count][codeclimate-issue]][codeclimate-url]


```typescript
import * as island from 'island';
import * as keeper from 'island-keeper';
import { EndpointController } from './controller/endpoint.controller';
import { EventController } from './controller/event.controller';

const serviceName = 'hawaii';

class HawaiiIslet extends island.Islet {
  main() {
    const islandKeeper = keeper.IslandKeeper.getInst();
    islandKeeper.init('consul', 'island');
    islandKeeper.setServiceName(serviceName);

    const amqpChannelPoolAdapter = new island.AmqpChannelPoolAdapter({url: 'amqp://rabbitmq:5672'});
    this.registerAdapter('amqpChannelPool', amqpChannelPoolAdapter);
    const rpcAdapter = new island.RPCAdapter({amqpChannelPoolAdapter, serviceName});
    rpcAdapter.registerController(EndpointController);
    this.registerAdapter('rpc', rpcAdapter);

    const eventAdapter = new island.EventAdapter({amqpChannelPoolAdapter, serviceName});
    eventAdapter.registerController(EventController);
    this.registerAdapter('event', eventAdapter);
  }
}

island.Islet.run(HawaiiIslet);
```


## Table of Contents

  - [Installation](#installation)
  - [Features](#features)
  - [v1.0](#v1.0)
  - [Building](#building)
  - [Tests](#tests)
  - [Environment Variables](#environment+variables)
  - [Milestones](#milestones)
  - [People](#people)
  - [License](#license)


## Installation

```
$ npm install island --save
```


## Features

  - Free from service discovery
  - Support various types of communication
    - RPC(strong link between islands)
    - Event(weak link between islands)
    - Push messaging(to user) via `socket.io`
  - Ensure that each island gets proper parameters
  - Track communications per each request
  - Chain contexts with UUID per each request

## v1.2
 
### Changes

  - Support to expand langid from property name for @validate @sanitize [#69](https://github.com/spearhead-ea/island/issues/68)
  - Fix singleton bug [#64](https://github.com/spearhead-ea/island/pull/67)

## v1.0

### Changes

  - `Loggers` is no longer a part of `island` -> [island-loggers](https://github.com/spearhead-ea/island-loggers) [#14](https://github.com/spearhead-ea/island/issues/14)
  - `Di` is no longer a part of `island` -> [island-di](https://github.com/spearhead-ea/island-di) [#16](https://github.com/spearhead-ea/island/issues/16)
  - `@endpoint` decorator now provides 4 more methods [#28](https://github.com/spearhead-ea/island/issues/28)
    - `@endpoint('GET /test')` still works
    - `@endpoint.get('/test')` - You can omit the GET method
    - `@endpoint.post('/test')` - You can omit the POST method
    - `@endpoint.put('/test')` - You can omit the PUT method
    - `@endpoint.del('/test')` - You can omit the DEL method


### Breaking Changes

  - Require TypeScript@2.x
    - `strictNullChecks`


## Building

In order to build the island, ensure that you have [Git](http://git-scm.com/downloads) and [Node.js](http://nodejs.org/) installed.

Clone a copy of the repo:

```
$ git clone https://github.com/spearhead-ea/island.git
```

Change to the island directory:

```
$ cd island
```

Install prerequisites and dev dependencies:

```
$ npm install -g gulp typescript
$ npm install
```


## Tests

  To run the test suite, first install the dependencies, then run `npm test`:

```bash
$ npm install
$ RABBITMQ_HOST=localhost npm test
```


## Environment Variables

| Environments                  | Type    | Default                   | Notes                                                             | LegacyKeys               |
| ----------------------------- | ------- | ------------------------- | ----------------------------------------------------------------- | ------------------------ |
| ISLAND_SERVICE_NAME           | string  | 'no-service-name'         |                                                                   | 'SERVICE_NAME'           |
| ISLAND_HOST_NAME              | string  | 'no-host-name'            | TraceLog uses this as a name of node                              | 'HOSTNAME'               |
| ISLAND_USE_DEV_MODE           | boolean | false                     | When true, allows APIs which has options.developmentOnly          | 'USE_DEV_MODE'           |
| ISLAND_SERIALIZE_FORMAT_PUSH  | string  | 'msgpack'                 | currently able Push format json and msgpack                       | 'SERIALIZE_FORMAT_PUSH'  |
| ISLAND_EVENT_PREFETCH         | number  | 100                       |                                                                   | 'EVENT_PREFETCH'         |
| ISLAND_RPC_PREFETCH           | number  | 100                       | Count of RPC Prefetch                                             | 'RPC_PREFETCH'           |
| ISLAND_RPC_EXEC_TIMEOUT_MS    | number  | 25000                     | Timeout during RPC execution                                      |                          |
| ISLAND_RPC_WAIT_TIMEOUT_MS    | number  | 60000                     | Timeout during RPC call                                           |                          |
| ISLAND_SERVICE_LOAD_TIME_MS   | number  | 60000                     | Time to load service                                              |                          |
| ISLAND_LOGGER_LEVEL           | string  | 'info'                    | Log level for logger                                              |                          |
| ISLAND_LOGGER_TYPE            | string  | 'short'                   |                                                                   |                          |
| ISLAND_RPC_RES_NOACK          | boolean | false                     |                                                                   |                          |
| ISLAND_NO_REVIVER             | boolean | false                     |                                                                   | 'NO_REVIVER'             |
| ISLAND_STATUS_EXPORT          | boolean | false                     | If it is true, use island-status-exporter                         | 'STATUS_EXPORT'          |
| ISLAND_STATUS_EXPORT_TIME_MS  | number  | 10 * 1000                 | Time to save file for instance status                             | 'STATUS_EXPORT_TIME_MS'  |
| ISLAND_STATUS_FILE_NAME       | string  |                           | island-status-exporter uses this as a name for file               | 'STATUS_FILE_NAME'       |
| ISLAND_STATUS_EXPORT_TYPE     | string  | 'FILE'                    | status-exporter uses this type for saving data                    | 'STATUS_EXPORT_TYPE'     |
| ISLAND_TRACEMQ_HOST           | string  |                           | MQ(formatted by amqp URI) for TraceLog. If omitted it doesn't log |                          |
| ISLAND_TRACEMQ_QUEUE          | string  | 'trace'                   | A queue name to log TraceLog                                      |                          |
| ISLAND_TRACE_HEADER_LOG       | boolean | false                     | When true, add trace log to msg.header                            |                          |
| ISLAND_ENDPOINT_SESSION_GROUP | string  |                           |                                                                   | 'ENDPOINT_SESSION_GROUP' |
| ISLAND_CONSUL_HOST            | string  | 'consul'                  | The address of consul.                                            | 'CONSUL_HOST'            |
| ISLAND_CONSUL_PORT            | string  | '8500'                    | consul port. work with CONSUL_HOST                                | 'CONSUL_PORT'            |
| ISLAND_CONSUL_NAMESPACE       | string  |                           |                                                                   | 'CONSUL_NAMESPACE'       |
| ISLAND_CONSUL_TOKEN           | string  |                           |                                                                   | 'CONSUL_TOKEN'           |
| ISLAND_RABBITMQ_HOST          | string  | 'amqp://rabbitmq:5672'    | The address of rabbitmq.                                          | 'RABBITMQ_HOST'          |
| ISLAND_RABBITMQ_PUSH_HOST     | string  |                           |                                                                   | 'RABBITMQ_PUSH_HOST'     |
| ISLAND_RABBITMQ_RPC_HOST      | string  |                           |                                                                   | 'RABBITMQ_RPC_HOST'      |
| ISLAND_RABBITMQ_EVENT_HOST    | string  |                           |                                                                   | 'RABBITMQ_EVENT_HOST'    |
| ISLAND_RABBITMQ_POOLSIZE      | number  | 100                       |                                                                   | 'RABBITMQ_POOLSIZE'      |
| ISLAND_REDIS_AUTH             | string  |                           |                                                                   | 'REDIS_AUTH'             |
| ISLAND_REDIS_HOST             | string  | 'redis'                   | The address of redishost.                                         | 'REDIS_HOST'             |
| ISLAND_REDIS_PORT             | number  | 6379                      |                                                                   | 'REDIS_PORT'             |
| ISLAND_MONGO_HOST             | string  | 'mongodb://mongodb:27017' |                                                                   | 'MONGO_HOST'             |
| ISLAND_RPC_DISTRIB_SIZE       | number  | 16                        |                                                                   |                          |


## Milestones

For details on our planned features and future direction please refer to our [milestones](https://github.com/spearhead-ea/island/milestones)



## People

The original author of `island` is [Wonshik Kim](https://github.com/wokim)

The current lead maintainer is [Kei Son](https://github.com/heycalmdown)

[List of all contributors](https://github.com/spearhead-ea/island/graphs/contributors)



## License

  [MIT](LICENSE)


[travis-image]: https://api.travis-ci.org/spearhead-ea/island.svg?branch=release-1.0
[travis-url]: https://travis-ci.org/spearhead-ea/island
[npm-image]: https://badge.fury.io/js/island.svg
[npm-url]: http://badge.fury.io/js/island
[david-image]: https://david-dm.org/spearhead-ea/island/status.svg
[david-url]: https://david-dm.org/spearhead-ea/island
[coveralls-image]: https://coveralls.io/repos/github/spearhead-ea/island/badge.svg?branch=master
[coveralls-url]: https://coveralls.io/github/spearhead-ea/island?branch=master
[codeclimate-coverage]: https://codeclimate.com/github/spearhead-ea/island/badges/coverage.svg
[codeclimate-gpa]: https://codeclimate.com/github/spearhead-ea/island/badges/gpa.svg
[codeclimate-issue]: https://codeclimate.com/github/spearhead-ea/island/badges/issue_count.svg
[codeclimate-url]: https://codeclimate.com/github/spearhead-ea/island/coverage
