const winston = require('winston');

const isProduction = process.env.NODE_ENV === 'production';

const transports = [new winston.transports.Console()];

// Only write to files in development
if (!isProduction) {
  const fs = require('fs');
  if (!fs.existsSync('logs')) fs.mkdirSync('logs');
  transports.push(new winston.transports.File({ filename: 'logs/error.log', level: 'error' }));
  transports.push(new winston.transports.File({ filename: 'logs/combined.log' }));
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    isProduction
      ? winston.format.json()
      : winston.format.combine(winston.format.colorize(), winston.format.simple())
  ),
  transports,
});

module.exports = { logger };
