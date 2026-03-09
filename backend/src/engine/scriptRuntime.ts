import * as vm from 'vm';
import { VariableScope, TestResult } from './types';

interface ScriptContext {
  scope: VariableScope;
  responseBody?: any;
  responseStatus?: number;
  responseHeaders?: Record<string, string>;
  responseTime?: number;
  testResults: TestResult[];
  consoleOutput: string[];
}

/**
 * Execute a Postman script (pre-request or test) in a sandboxed VM.
 */
export function executeScript(
  scriptLines: string[],
  context: ScriptContext
): ScriptContext {
  const code = scriptLines.join('\n');
  if (!code.trim()) return context;

  // Build the pm object that mimics Postman's API
  const testResults: TestResult[] = [];
  const consoleOutput: string[] = [];

  const pmObject = buildPmObject(context, testResults, consoleOutput);

  const sandbox: Record<string, any> = {
    pm: pmObject,
    console: {
      log: (...args: any[]) => consoleOutput.push(args.map(String).join(' ')),
      warn: (...args: any[]) => consoleOutput.push('[WARN] ' + args.map(String).join(' ')),
      error: (...args: any[]) => consoleOutput.push('[ERROR] ' + args.map(String).join(' ')),
      info: (...args: any[]) => consoleOutput.push('[INFO] ' + args.map(String).join(' ')),
    },
    // Provide common globals
    JSON,
    parseInt,
    parseFloat,
    encodeURIComponent,
    decodeURIComponent,
    encodeURI,
    decodeURI,
    atob: (s: string) => Buffer.from(s, 'base64').toString('binary'),
    btoa: (s: string) => Buffer.from(s, 'binary').toString('base64'),
    setTimeout: undefined,
    setInterval: undefined,
    Buffer: undefined,
    require: undefined,
    process: undefined,
  };

  try {
    const vmContext = vm.createContext(sandbox);
    const script = new vm.Script(code, { filename: 'postman-script.js' });
    script.runInContext(vmContext);
  } catch (err: any) {
    consoleOutput.push(`[SCRIPT ERROR] ${err.message}`);
  }

  context.testResults = [...context.testResults, ...testResults];
  context.consoleOutput = [...context.consoleOutput, ...consoleOutput];

  return context;
}

function buildPmObject(
  context: ScriptContext,
  testResults: TestResult[],
  consoleOutput: string[]
) {
  // Response object for test scripts
  const responseObj = {
    json: () => {
      if (typeof context.responseBody === 'string') {
        try {
          return JSON.parse(context.responseBody);
        } catch {
          return context.responseBody;
        }
      }
      return context.responseBody;
    },
    text: () => {
      if (typeof context.responseBody === 'string') return context.responseBody;
      return JSON.stringify(context.responseBody);
    },
    code: context.responseStatus || 0,
    status: context.responseStatus || 0,
    responseTime: context.responseTime || 0,
    headers: {
      get: (key: string) => {
        if (!context.responseHeaders) return undefined;
        const lower = key.toLowerCase();
        for (const [k, v] of Object.entries(context.responseHeaders)) {
          if (k.toLowerCase() === lower) return v;
        }
        return undefined;
      },
    },
    to: {
      have: {
        status: (code: number) => {
          if (context.responseStatus !== code) {
            throw new Error(`Expected status ${code} but got ${context.responseStatus}`);
          }
        },
      },
    },
  };

  // Expect/assertion helper
  const createExpect = (value: any) => {
    return {
      to: {
        equal: (expected: any) => {
          if (value !== expected) throw new Error(`Expected ${expected} but got ${value}`);
        },
        eql: (expected: any) => {
          if (JSON.stringify(value) !== JSON.stringify(expected))
            throw new Error(`Expected deep equal failed`);
        },
        be: {
          a: (type: string) => {
            if (typeof value !== type) throw new Error(`Expected type ${type} but got ${typeof value}`);
          },
          an: (type: string) => {
            if (typeof value !== type) throw new Error(`Expected type ${type} but got ${typeof value}`);
          },
          true: (() => {
            // This is a property, not a method
            return value === true;
          })(),
          false: (() => {
            return value === false;
          })(),
          below: (n: number) => {
            if (value >= n) throw new Error(`Expected ${value} to be below ${n}`);
          },
          above: (n: number) => {
            if (value <= n) throw new Error(`Expected ${value} to be above ${n}`);
          },
          oneOf: (arr: any[]) => {
            if (!arr.includes(value)) throw new Error(`Expected ${value} to be one of ${JSON.stringify(arr)}`);
          },
        },
        include: (str: string) => {
          if (typeof value === 'string' && !value.includes(str))
            throw new Error(`Expected string to include "${str}"`);
          if (Array.isArray(value) && !value.includes(str))
            throw new Error(`Expected array to include "${str}"`);
        },
        property: (prop: string) => {
          if (typeof value !== 'object' || !(prop in value))
            throw new Error(`Expected object to have property "${prop}"`);
        },
        length: {
          above: (n: number) => {
            if (!value || value.length <= n) throw new Error(`Expected length above ${n}`);
          },
          below: (n: number) => {
            if (!value || value.length >= n) throw new Error(`Expected length below ${n}`);
          },
        },
        not: {
          equal: (expected: any) => {
            if (value === expected) throw new Error(`Expected not equal to ${expected}`);
          },
          eql: (expected: any) => {
            if (JSON.stringify(value) === JSON.stringify(expected))
              throw new Error(`Expected not deep equal`);
          },
          be: {
            undefined: (() => {
              return value !== undefined;
            })(),
            null: (() => {
              return value !== null;
            })(),
          },
        },
      },
    };
  };

  const pm = {
    // Environment variables
    environment: {
      get: (key: string) => context.scope.environment[key] ?? undefined,
      set: (key: string, value: any) => {
        context.scope.environment[key] = String(value);
      },
      unset: (key: string) => {
        delete context.scope.environment[key];
      },
      has: (key: string) => key in context.scope.environment,
      toObject: () => ({ ...context.scope.environment }),
    },

    // Collection variables
    collectionVariables: {
      get: (key: string) => context.scope.collection[key] ?? undefined,
      set: (key: string, value: any) => {
        context.scope.collection[key] = String(value);
      },
      unset: (key: string) => {
        delete context.scope.collection[key];
      },
      has: (key: string) => key in context.scope.collection,
      toObject: () => ({ ...context.scope.collection }),
    },

    // Global variables
    globals: {
      get: (key: string) => context.scope.global[key] ?? undefined,
      set: (key: string, value: any) => {
        context.scope.global[key] = String(value);
      },
      unset: (key: string) => {
        delete context.scope.global[key];
      },
      has: (key: string) => key in context.scope.global,
      toObject: () => ({ ...context.scope.global }),
    },

    // Generic variable access (follows resolution order)
    variables: {
      get: (key: string) => {
        if (key in context.scope.request) return context.scope.request[key];
        if (key in context.scope.collection) return context.scope.collection[key];
        if (key in context.scope.environment) return context.scope.environment[key];
        if (key in context.scope.global) return context.scope.global[key];
        return undefined;
      },
      set: (key: string, value: any) => {
        // pm.variables.set sets a request-level variable
        context.scope.request[key] = String(value);
      },
      has: (key: string) => {
        return (
          key in context.scope.request ||
          key in context.scope.collection ||
          key in context.scope.environment ||
          key in context.scope.global
        );
      },
    },

    // Response object (only useful in test scripts)
    response: responseObj,

    // Test function
    test: (name: string, fn: () => void) => {
      try {
        fn();
        testResults.push({ name, passed: true });
      } catch (err: any) {
        testResults.push({ name, passed: false, error: err.message });
      }
    },

    // Expect
    expect: createExpect,

    // Info
    info: {
      requestName: 'Request',
      requestId: '',
    },
  };

  return pm;
}
