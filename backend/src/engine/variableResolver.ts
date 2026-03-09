import {
  PostmanAuth,
  PostmanHeader,
  PostmanRequest,
  PostmanUrl,
  VariableScope,
} from './types';

/**
 * Resolve all {{variable}} placeholders in a string.
 * Resolution order: request -> collection -> environment -> global
 */
export function resolveVariables(input: string, scope: VariableScope): string {
  if (!input) return input;

  return input.replace(/\{\{([^}]+)\}\}/g, (_match, varName: string) => {
    const trimmed = varName.trim();

    if (trimmed in scope.request) return scope.request[trimmed];
    if (trimmed in scope.collection) return scope.collection[trimmed];
    if (trimmed in scope.environment) return scope.environment[trimmed];
    if (trimmed in scope.global) return scope.global[trimmed];

    // Return the original placeholder if not resolved
    return `{{${trimmed}}}`;
  });
}

/**
 * Build full URL from PostmanUrl or raw string, with variables resolved.
 */
export function resolveUrl(url: PostmanUrl | string | undefined, scope: VariableScope): string {
  if (!url) return '';

  if (typeof url === 'string') {
    return resolveVariables(url, scope);
  }

  // Use the raw URL if available
  if (url.raw) {
    return resolveVariables(url.raw, scope);
  }

  // Build from components
  const protocol = url.protocol || 'https';
  const host = url.host ? url.host.join('.') : '';
  const port = url.port ? `:${url.port}` : '';
  const pathStr = url.path ? '/' + url.path.join('/') : '';

  let queryStr = '';
  if (url.query && url.query.length > 0) {
    const enabledParams = url.query.filter(q => !q.disabled);
    if (enabledParams.length > 0) {
      queryStr = '?' + enabledParams
        .map(q => `${encodeURIComponent(resolveVariables(q.key, scope))}=${encodeURIComponent(resolveVariables(q.value, scope))}`)
        .join('&');
    }
  }

  const raw = `${protocol}://${host}${port}${pathStr}${queryStr}`;
  return resolveVariables(raw, scope);
}

/**
 * Resolve headers, including auth headers.
 */
export function resolveHeaders(
  headers: PostmanHeader[] | undefined,
  auth: PostmanAuth | undefined,
  scope: VariableScope
): Record<string, string> {
  const result: Record<string, string> = {};

  if (headers) {
    for (const h of headers) {
      if (h.disabled) continue;
      const key = resolveVariables(h.key, scope);
      const value = resolveVariables(h.value, scope);
      result[key] = value;
    }
  }

  // Apply auth
  if (auth) {
    applyAuth(auth, result, scope);
  }

  return result;
}

function applyAuth(auth: PostmanAuth, headers: Record<string, string>, scope: VariableScope): void {
  switch (auth.type) {
    case 'bearer': {
      const tokenParam = auth.bearer?.find(p => p.key === 'token');
      if (tokenParam) {
        const token = resolveVariables(tokenParam.value, scope);
        headers['Authorization'] = `Bearer ${token}`;
      }
      break;
    }
    case 'basic': {
      const usernameParam = auth.basic?.find(p => p.key === 'username');
      const passwordParam = auth.basic?.find(p => p.key === 'password');
      const username = usernameParam ? resolveVariables(usernameParam.value, scope) : '';
      const password = passwordParam ? resolveVariables(passwordParam.value, scope) : '';
      const encoded = Buffer.from(`${username}:${password}`).toString('base64');
      headers['Authorization'] = `Basic ${encoded}`;
      break;
    }
    case 'apikey': {
      const keyParam = auth.apikey?.find(p => p.key === 'key');
      const valueParam = auth.apikey?.find(p => p.key === 'value');
      const inParam = auth.apikey?.find(p => p.key === 'in');
      if (keyParam && valueParam) {
        const k = resolveVariables(keyParam.value, scope);
        const v = resolveVariables(valueParam.value, scope);
        const location = inParam?.value || 'header';
        if (location === 'header') {
          headers[k] = v;
        }
        // query params handled separately
      }
      break;
    }
    case 'noauth':
    default:
      break;
  }
}

/**
 * Resolve body content.
 */
export function resolveBody(
  request: PostmanRequest | undefined,
  scope: VariableScope
): { data: any; contentType?: string } {
  if (!request || !request.body) return { data: undefined };

  const body = request.body;

  switch (body.mode) {
    case 'raw': {
      const resolved = resolveVariables(body.raw || '', scope);
      const lang = body.options?.raw?.language;
      if (lang === 'json') {
        return { data: resolved, contentType: 'application/json' };
      }
      if (lang === 'xml') {
        return { data: resolved, contentType: 'application/xml' };
      }
      if (lang === 'text') {
        return { data: resolved, contentType: 'text/plain' };
      }
      // Try to detect JSON
      try {
        JSON.parse(resolved);
        return { data: resolved, contentType: 'application/json' };
      } catch {
        return { data: resolved, contentType: 'text/plain' };
      }
    }

    case 'urlencoded': {
      if (!body.urlencoded) return { data: undefined };
      const params = new URLSearchParams();
      for (const item of body.urlencoded) {
        if (item.disabled) continue;
        params.append(
          resolveVariables(item.key, scope),
          resolveVariables(item.value, scope)
        );
      }
      return { data: params.toString(), contentType: 'application/x-www-form-urlencoded' };
    }

    case 'formdata': {
      if (!body.formdata) return { data: undefined };
      // Return structured form data - will be handled by executor
      const formEntries: Array<{ key: string; value: string; type: string }> = [];
      for (const item of body.formdata) {
        if (item.disabled) continue;
        formEntries.push({
          key: resolveVariables(item.key, scope),
          value: resolveVariables(item.value || '', scope),
          type: item.type || 'text',
        });
      }
      return { data: formEntries, contentType: 'multipart/form-data' };
    }

    case 'graphql': {
      const query = resolveVariables(body.graphql?.query || '', scope);
      const variables = resolveVariables(body.graphql?.variables || '{}', scope);
      return {
        data: JSON.stringify({ query, variables: JSON.parse(variables) }),
        contentType: 'application/json',
      };
    }

    default:
      return { data: undefined };
  }
}

/**
 * Resolve query params from the URL object (in addition to those already in raw URL).
 */
export function resolveQueryParams(
  url: PostmanUrl | string | undefined,
  scope: VariableScope
): Record<string, string> {
  if (!url || typeof url === 'string') return {};

  const params: Record<string, string> = {};
  if (url.query) {
    for (const q of url.query) {
      if (q.disabled) continue;
      params[resolveVariables(q.key, scope)] = resolveVariables(q.value, scope);
    }
  }
  return params;
}
