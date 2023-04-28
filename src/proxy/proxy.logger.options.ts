import { LoggerOptions, format, transports } from 'winston';

const loggerFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS', alias: 'time' }),
  format.printf(
    (info: any) => `${info.timestamp}  ${info.level}: ${info.message}`,
  ),
  format.errors({ stack: true }),
);
const consoleTransport = new transports.Console({
  format: format.combine(
    loggerFormat,
    format.colorize({
      colors: { info: 'green', error: 'red' },
      all: true,
    }),
  ),
});
const fileTransport = new transports.File({
  filename: 'app.log',
  format: loggerFormat,
});

export const createAppLoggerOptions = (): LoggerOptions => {
  return {
    transports: [consoleTransport, fileTransport],
    handleExceptions: true,
    exceptionHandlers: [consoleTransport, fileTransport],
    handleRejections: true,
    rejectionHandlers: [consoleTransport, fileTransport],
  };
};
