import { Loggers } from 'island-loggers';
import * as winston from 'winston';
import { Environments } from '../utils/environments';

export const logger: winston.LoggerInstance = Loggers.get('island');
Loggers.switchLevel('island', Environments.getIslandLoggerLevel());
