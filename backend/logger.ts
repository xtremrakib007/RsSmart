import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'erp-api', version: process.env.GIT_SHA },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: '/var/log/erp/app.log' }),
  ],
});

export default logger;
