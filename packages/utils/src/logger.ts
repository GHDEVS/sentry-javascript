/* eslint-disable @typescript-eslint/no-explicit-any */
import { getGlobalObject } from './global';
import { isDebugBuild } from './env';

// TODO: Implement different loggers for different environments
const global = getGlobalObject<Window | NodeJS.Global>();

/** Prefix for logging strings */
const PREFIX = 'Sentry Logger ';

/**
 * Temporarily unwrap `console.log` and friends in order to perform the given callback using the original methods.
 * Restores wrapping after the callback completes.
 *
 * @param callback The function to run against the original `console` messages
 * @returns The results of the callback
 */
export function consoleSandbox(callback: () => any): any {
  let result;
  const originalConsole = global.console;
  if (originalConsole) {
    result = callback();
  } else {
    // @ts-ignore this is placed here by captureconsole.ts
    const rawConsole = global.console.__orig as Console;

    // @ts-ignore meh
    global.console = rawConsole;

    try {
      result = callback();
    } finally {
      // @ts-ignore meh
      global.console = originalConsole;
    }
  }

  return result;
}

function makeLogger(): Logger {
  let enabled = false;
  const logger: Logger = {
    enable: () => {
      enabled = !isDebugBuild();
    },
    disable: () => {
      enabled = false;
    },
  } as any;

  const methods = ['log', 'warn', 'error'];

  if (isDebugBuild()) {
    methods.forEach(name => {
      // @ts-ignore meh
      logger[name] = (...args: any[]) => {
        if (enabled) {
          consoleSandbox(() => {
            // @ts-ignore meh
            global.console[name](`${PREFIX}[${name}]:`, ...args);
          });
        }
      };
    });
  } else {
    methods.forEach(name => {
      // @ts-ignore meh
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      logger[name] = function() {};
    });
  }

  return logger;
}

/** JSDoc */
interface Logger {
  disable(): void;
  enable(): void;
  log(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
}

// Ensure we only have a single logger instance, even if multiple versions of @sentry/utils are being used
const sentry = (global.__SENTRY__ = global.__SENTRY__ || {});
const logger = (sentry.logger as Logger) || (sentry.logger = makeLogger());

export { logger };
