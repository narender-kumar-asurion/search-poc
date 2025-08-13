import pino, { Logger as PinoLogger } from 'pino';

export interface ILogger {
  error(message: string, error?: Error): void;
  warn(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
  success(message: string): void;
  search(message: string): void;
  server(message: string): void;
  data(message: string): void;
}

const level = (process.env.LOG_LEVEL || 'info').toLowerCase();
export const rawLogger: PinoLogger = pino({
  level,
  base: undefined,
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: { colorize: true, translateTime: 'SYS:standard', singleLine: true },
  } : undefined,
});

export const logger: ILogger = {
  error(message: string, error?: Error) {
    if (error) rawLogger.error({ err: error, msg: message });
    else rawLogger.error({ msg: message });
  },
  warn(message: string, meta?: any) {
    rawLogger.warn(meta ? { ...meta, msg: message } : { msg: message });
  },
  info(message: string, meta?: any) {
    rawLogger.info(meta ? { ...meta, msg: message } : { msg: message });
  },
  debug(message: string, meta?: any) {
    rawLogger.debug(meta ? { ...meta, msg: message } : { msg: message });
  },
  success(message: string) { rawLogger.info({ msg: `SUCCESS: ${message}` }); },
  search(message: string) { rawLogger.info({ msg: `SEARCH: ${message}` }); },
  server(message: string) { rawLogger.info({ msg: `SERVER: ${message}` }); },
  data(message: string) { rawLogger.info({ msg: `DATA: ${message}` }); },
};

export type Logger = ILogger;
