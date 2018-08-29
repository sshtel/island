# island.js

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


## Installation

```
$ npm i island
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


## Building

In order to build the island, ensure that you have [Git](http://git-scm.com/downloads) and [Node.js](http://nodejs.org/) installed.

Clone a copy of the repo:

```bash
$ git clone https://github.com/spearhead-ea/island.git
```

Change to the island directory:

```bash
$ cd island
```

Install dependencies and dev dependencies:

```bash
$ npm i
```


## Tests

  To run the test suite, first install the dependencies, then run `npm test`:

```bash
$ npm i
$ RABBITMQ_HOST=localhost npm t
```


## Environment Variables

| Name                                    | Type    | Default                   | Notes                                                             | LegacyKeys                                                     |
| --------------------------------------- | ------- | ------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------- |
| ISLAND_SERVICE_NAME                     | String  | 'no-service-name'         |                                                                   | 'SERVICE_NAME'                                                 |
| ISLAND_HOST_NAME                        | String  | 'no-host-name'            | TraceLog uses this as a name of node                              | 'HOSTNAME'                                                     |
| ISLAND_USE_DEV_MODE                     | Boolean | false                     | When true, allows APIs which has options.developmentOnly          | 'USE_DEV_MODE'                                                 |
| ISLAND_SERIALIZE_FORMAT_PUSH            | String  | 'msgpack'                 | currently able Push format json and msgpack                       | 'SERIALIZE_FORMAT_PUSH'                                        |
| ISLAND_EVENT_PREFETCH                   | Number  | 100                       |                                                                   | 'EVENT_PREFETCH'                                               |
| ISLAND_RPC_PREFETCH                     | Number  | 100                       | Count of RPC Prefetch                                             | 'RPC_PREFETCH'                                                 |
| ISLAND_RPC_EXEC_TIMEOUT                 | String  | '25s'                     | Timeout during RPC execution                                      |                                                                |
| ISLAND_RPC_EXEC_TIMEOUT_MS              | Number  | 0                         | deprecated                                                        |                                                                |
| ISLAND_RPC_WAIT_TIMEOUT                 | String  | '60s'                     | Timeout during RPC call                                           |                                                                |
| ISLAND_RPC_WAIT_TIMEOUT_MS              | Number  | 0                         | deprecated                                                        |                                                                |
| ISLAND_SERVICE_LOAD_TIME                | String  | '60s'                     | Time to load service                                              |                                                                |
| ISLAND_SERVICE_LOAD_TIME_MS             | Number  | 0                         | deprecated                                                        |                                                                |
| ISLAND_LOGGER_LEVEL                     | String  | 'info'                    | Log level for logger                                              |                                                                |
| ISLAND_LOGGER_TYPE                      | String  | 'short'                   |                                                                   |                                                                |
| ISLAND_RPC_RES_NOACK                    | Boolean | false                     |                                                                   |                                                                |
| ISLAND_NO_REVIVER                       | Boolean | false                     |                                                                   | 'NO_REVIVER'                                                   |
| ISLAND_USE_REVIVER                      | Boolean | false                     |                                                                   | 'USE_REVIVER'                                                  |
| ISLAND_STATUS_EXPORT                    | Boolean | false                     | If it is true, use island-status-exporter                         | 'STATUS_EXPORT'                                                |
| ISLAND_STATUS_EXPORT_TIME               | String  | '10s'                     | Time to save file for instance status                             |                                                                |
| ISLAND_STATUS_EXPORT_TIME_MS            | Number  | 0                         | deprecated                                                        | 'STATUS_EXPORT_TIME_MS'                                        |
| ISLAND_STATUS_FILE_NAME                 | String  |                           | island-status-exporter uses this as a name for file               | 'STATUS_FILE_NAME'                                             |
| ISLAND_STATUS_EXPORT_TYPE               | String  | 'FILE'                    | status-exporter uses this type for saving data                    | 'STATUS_EXPORT_TYPE'                                           |
| ISLAND_TRACEMQ_HOST                     | String  |                           | MQ(formatted by amqp URI) for TraceLog. If omitted it doesn't log |                                                                |
| ISLAND_TRACEMQ_QUEUE                    | String  | 'trace'                   | A queue name to log TraceLog                                      |                                                                |
| ISLAND_TRACE_HEADER_LOG                 | Boolean | false                     | When true, add trace log to msg.header                            |                                                                |
| ISLAND_ENDPOINT_SESSION_GROUP           | String  |                           |                                                                   | 'ENDPOINT_SESSION_GROUP'                                       |
| ISLAND_CONSUL_HOST                      | String  | 'consul'                  | The address of consul.                                            | 'CONSUL_HOST'                                                  |
| ISLAND_CONSUL_PORT                      | String  | '8500'                    | consul port. work with CONSUL_HOST                                | 'CONSUL_PORT'                                                  |
| ISLAND_CONSUL_NAMESPACE                 | String  |                           |                                                                   | 'CONSUL_NAMESPACE'                                             |
| ISLAND_CONSUL_TOKEN                     | String  |                           |                                                                   | 'CONSUL_TOKEN'                                                 |
| ISLAND_RABBITMQ_HOST                    | String  | 'amqp://rabbitmq:5672'    | The address of rabbitmq.                                          | 'RABBITMQ_HOST'                                                |
| ISLAND_RABBITMQ_PUSH_HOST               | String  |                           |                                                                   | 'RABBITMQ_PUSH_HOST', 'ISLAND_RABBITMQ_HOST', 'RABBITMQ_HOST'  |
| ISLAND_RABBITMQ_RPC_HOST                | String  |                           |                                                                   | 'RABBITMQ_RPC_HOST', 'ISLAND_RABBITMQ_HOST', 'RABBITMQ_HOST'   |
| ISLAND_RABBITMQ_EVENT_HOST              | String  |                           |                                                                   | 'RABBITMQ_EVENT_HOST', 'ISLAND_RABBITMQ_HOST', 'RABBITMQ_HOST' |
| ISLAND_RABBITMQ_POOLSIZE                | Number  | 100                       |                                                                   | 'RABBITMQ_POOLSIZE'                                            |
| ISLAND_REDIS_AUTH                       | String  |                           |                                                                   | 'REDIS_AUTH'                                                   |
| ISLAND_REDIS_HOST                       | String  | 'redis'                   | The address of redishost.                                         | 'REDIS_HOST'                                                   |
| ISLAND_REDIS_PORT                       | Number  | 6379                      |                                                                   | 'REDIS_PORT'                                                   |
| ISLAND_MONGO_HOST                       | String  | 'mongodb://mongodb:27017' |                                                                   | 'MONGO_HOST'                                                   |
| ISLAND_RPC_DISTRIB_SIZE                 | Number  | 16                        |                                                                   |                                                                |
| ISLAND_USE_CIRCUIT_BREAK                | Boolean | false                     |                                                                   |                                                                |
| ISLAND_CIRCUIT_BREAK_TIME               | String  | '1m'                      |                                                                   |                                                                |
| ISLAND_CIRCUIT_BREAK_TIME_MS            | Number  | 0                         | deprecated                                                        |                                                                |
| ISLAND_CIRCUIT_BREAK_FAILRATE_THRESHOLD | Number  | 0.2                       |                                                                   |                                                                |
| ISLAND_CIRCUIT_BREAK_REQUEST_THRESHOLD  | Number  | 10                        |                                                                   |                                                                |
| ISLAND_FLOWMODE_DELAY_TIME              | String  | '10s'                     |                                                                   |                                                                |
| ISLAND_FLOWMODE_DELAY                   | Number  | 0                         | deprecated                                                        |                                                                |


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


## Error Codes

### ErrorLevel
```javascript

  EXPECTED  = 1,
  LOGIC     = 2,
  FATAL     = 3,
  RESERVED4 = 4,
  RESERVED5 = 5,
  RESERVED6 = 6,
  RESERVED7 = 7,
  RESERVED8 = 8,
  ETC       = 9
```
### IslandLevel
```javascript

  ISLAND    = 0,
  ISLANDJS  = 1,
  UNKNOWN   = 2,
  RESERVED3 = 3,
  RESERVED4 = 4,
  RESERVED5 = 5,
  RESERVED6 = 6,
  RESERVED7 = 7,
  RESERVED8 = 8,
  RESERVED9 = 9
```
### ERROR
```javascript

    E0001_ISLET_ALREADY_HAS_BEEN_REGISTERED   = 1,
    E0002_DUPLICATED_ADAPTER                  = 2,
    E0003_MISSING_ADAPTER                     = 3,
    E0004_NOT_IMPLEMENTED_ERROR               = 4,
    E0008_AMQP_CHANNEL_POOL_REQUIRED          = 8,
    E0011_NOT_INITIALIZED_EXCEPTION           = 11,
    E0012_ROUND_ROBIN_EVENT_Q_IS_NOT_DEFINED  = 12,
    E0013_NOT_INITIALIZED                     = 13,
    E0015_TAG_IS_UNDEFINED                    = 15,
    E0021_NOT_IMPLEMENTED_ERROR               = 21,
    E0022_NOT_INITIALIZED_EXCEPTION           = 22,
    E0023_RPC_TIMEOUT                         = 23,
    E0024_ENDPOINT_METHOD_REDECLARED          = 24,
    E0025_MISSING_ADAPTER_OPTIONS             = 25,
    E0026_MISSING_REPLYTO_IN_RPC              = 26,
    E0027_CONSUMER_IS_CANCELED                = 27,
    E0028_CONSUL_ERROR                        = 28,
    E0031_WRONG_PARAMETER_SCHEMA              = 31,
    E0032_MSG_PACK_ERROR                      = 32,
    E0033_MSG_PACK_ENCODE_ERROR               = 33,
    E0034_HANDLE_MESSAGE_ERROR                = 34,
    E0035_PUSH_ENCODE_ERROR                   = 35
```

