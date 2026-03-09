import axios, { AxiosRequestConfig, AxiosResponse, Method } from 'axios';
import FormData from 'form-data';
import {
  PostmanItem,
  PostmanAuth,
  PostmanEvent,
  VariableScope,
  ExecutionResult,
  TestResult,
  RequestOverrides,
} from './types';
import {
  resolveVariables,
  resolveUrl,
  resolveHeaders,
  resolveBody,
} from './variableResolver';
import { executeScript } from './scriptRuntime';

export interface ExecuteRequestOptions {
  item: PostmanItem;
  scope: VariableScope;
  collectionAuth?: PostmanAuth;
  collectionEvents?: PostmanEvent[];
  parentAuth?: PostmanAuth;
  parentEvents?: PostmanEvent[];
  requestPath: string;
  overrides?: RequestOverrides;
}

/**
 * Execute a single Postman request item.
 */
export async function executeRequest(options: ExecuteRequestOptions): Promise<ExecutionResult> {
  const { item, scope, collectionAuth, collectionEvents, parentAuth, parentEvents, requestPath, overrides } = options;

  if (!item.request) {
    return {
      requestName: item.name,
      requestPath,
      method: 'UNKNOWN',
      url: '',
      status: 0,
      statusText: 'No request defined',
      responseTime: 0,
      responseSize: 0,
      responseHeaders: {},
      responseBody: null,
      testResults: [],
      error: 'No request defined in this item',
      timestamp: new Date().toISOString(),
    };
  }

  const request = item.request;

  // Apply overrides from UI edits
  if (overrides) {
    if (overrides.url !== undefined) {
      request.url = overrides.url;
    }
    if (overrides.headers) {
      request.header = overrides.headers.map(h => ({
        key: h.key,
        value: h.value,
        disabled: !h.enabled,
      }));
    }
    if (overrides.body) {
      const ob = overrides.body;
      if (ob.mode === 'none') {
        request.body = undefined;
      } else {
        request.body = {
          mode: ob.mode as any,
          raw: ob.raw,
          options: request.body?.options,
          urlencoded: ob.urlencoded?.map(u => ({ key: u.key, value: u.value, disabled: !u.enabled })),
          formdata: ob.formdata?.map(f => ({ key: f.key, value: f.value, type: f.type, disabled: !f.enabled })),
        };
      }
    }
  }

  // Gather pre-request scripts (collection -> parent folder -> request)
  const preRequestScripts: string[][] = [];
  const testScripts: string[][] = [];

  if (collectionEvents) {
    for (const event of collectionEvents) {
      if (event.listen === 'prerequest') preRequestScripts.push(event.script.exec);
      if (event.listen === 'test') testScripts.push(event.script.exec);
    }
  }

  if (parentEvents) {
    for (const event of parentEvents) {
      if (event.listen === 'prerequest') preRequestScripts.push(event.script.exec);
      if (event.listen === 'test') testScripts.push(event.script.exec);
    }
  }

  if (item.event) {
    for (const event of item.event) {
      if (event.listen === 'prerequest') preRequestScripts.push(event.script.exec);
      if (event.listen === 'test') testScripts.push(event.script.exec);
    }
  }

  // Execute pre-request scripts
  const preScriptContext = {
    scope,
    testResults: [] as TestResult[],
    consoleOutput: [] as string[],
  };

  for (const scriptLines of preRequestScripts) {
    executeScript(scriptLines, preScriptContext);
  }

  // Determine auth: request -> parent -> collection
  const effectiveAuth = request.auth || parentAuth || collectionAuth;

  // Resolve URL
  const resolvedUrl = resolveUrl(request.url, scope);

  // Resolve headers
  const resolvedHeaders = resolveHeaders(request.header, effectiveAuth, scope);

  // Resolve body
  const bodyResult = resolveBody(request, scope);

  // Set content type if not already set and we have one
  if (bodyResult.contentType && !Object.keys(resolvedHeaders).some(k => k.toLowerCase() === 'content-type')) {
    if (bodyResult.contentType !== 'multipart/form-data') {
      resolvedHeaders['Content-Type'] = bodyResult.contentType;
    }
  }

  // Build axios config
  const method = (request.method || 'GET').toUpperCase() as Method;

  const axiosConfig: AxiosRequestConfig = {
    method,
    url: resolvedUrl,
    headers: resolvedHeaders,
    validateStatus: () => true, // Don't throw on any status
    timeout: 30000,
    maxRedirects: 10,
  };

  // Handle body
  if (bodyResult.data !== undefined) {
    if (bodyResult.contentType === 'multipart/form-data' && Array.isArray(bodyResult.data)) {
      const form = new FormData();
      for (const entry of bodyResult.data) {
        form.append(entry.key, entry.value);
      }
      axiosConfig.data = form;
      axiosConfig.headers = { ...axiosConfig.headers, ...form.getHeaders() };
    } else {
      axiosConfig.data = bodyResult.data;
    }
  }

  const startTime = Date.now();
  let response: AxiosResponse | null = null;
  let error: string | undefined;

  try {
    response = await axios(axiosConfig);
  } catch (err: any) {
    error = err.message || 'Request failed';
  }

  const responseTime = Date.now() - startTime;

  const status = response?.status || 0;
  const statusText = response?.statusText || error || 'Error';
  const responseHeaders: Record<string, string> = {};
  if (response?.headers) {
    for (const [key, val] of Object.entries(response.headers)) {
      responseHeaders[key] = String(val);
    }
  }

  let responseBody = response?.data;
  const responseSize = response?.data
    ? Buffer.byteLength(typeof response.data === 'string' ? response.data : JSON.stringify(response.data))
    : 0;

  // Execute test scripts
  const testScriptContext = {
    scope,
    responseBody,
    responseStatus: status,
    responseHeaders,
    responseTime,
    testResults: [] as TestResult[],
    consoleOutput: preScriptContext.consoleOutput,
  };

  for (const scriptLines of testScripts) {
    executeScript(scriptLines, testScriptContext);
  }

  return {
    requestName: item.name,
    requestPath,
    method,
    url: resolvedUrl,
    status,
    statusText,
    responseTime,
    responseSize,
    responseHeaders,
    responseBody,
    testResults: testScriptContext.testResults,
    error,
    timestamp: new Date().toISOString(),
  };
}
