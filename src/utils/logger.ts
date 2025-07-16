/**
 * Custom logger utility that prefixes all logs with the source location
 * Usage: 
 * const logger = createLogger('ComponentName');
 * logger.log('message');
 * logger.error('error message');
 * logger.warn('warning message');
 * logger.debug('debug message');
 */

export interface Logger {
  log: (...args: any[]) => void;
  error: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  debug: (...args: any[]) => void;
  info: (...args: any[]) => void;
}

/**
 * Creates a logger instance with a specific prefix
 * @param prefix - The prefix to use for all logs (usually component/function name)
 * @returns Logger instance
 */
export function createLogger(prefix: string): Logger {
  const formatMessage = (level: string, ...args: any[]) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
    return [`[${prefix}] [${timestamp}]`, ...args];
  };

  return {
    log: (...args: any[]) => {
      console.log(...formatMessage('LOG', ...args));
    },
    error: (...args: any[]) => {
      console.error(...formatMessage('ERROR', ...args));
    },
    warn: (...args: any[]) => {
      console.warn(...formatMessage('WARN', ...args));
    },
    debug: (...args: any[]) => {
      if (process.env.NODE_ENV === 'development') {
        console.debug(...formatMessage('DEBUG', ...args));
      }
    },
    info: (...args: any[]) => {
      console.info(...formatMessage('INFO', ...args));
    }
  };
}

/**
 * Default logger for quick usage
 * Usage: logger.log('MyComponent', 'message');
 */
export const logger = {
  log: (prefix: string, ...args: any[]) => {
    createLogger(prefix).log(...args);
  },
  error: (prefix: string, ...args: any[]) => {
    createLogger(prefix).error(...args);
  },
  warn: (prefix: string, ...args: any[]) => {
    createLogger(prefix).warn(...args);
  },
  debug: (prefix: string, ...args: any[]) => {
    createLogger(prefix).debug(...args);
  },
  info: (prefix: string, ...args: any[]) => {
    createLogger(prefix).info(...args);
  }
};

// For backward compatibility and easier migration
export default createLogger;