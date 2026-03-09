// Postman Collection v2.1 types

export interface PostmanCollection {
  info: PostmanCollectionInfo;
  item: PostmanItem[];
  variable?: PostmanVariable[];
  auth?: PostmanAuth;
  event?: PostmanEvent[];
}

export interface PostmanCollectionInfo {
  _postman_id?: string;
  name: string;
  description?: string;
  schema: string;
}

export interface PostmanItem {
  name: string;
  item?: PostmanItem[]; // folders
  request?: PostmanRequest;
  response?: any[];
  event?: PostmanEvent[];
  variable?: PostmanVariable[];
  auth?: PostmanAuth;
}

export interface PostmanRequest {
  method: string;
  header?: PostmanHeader[];
  body?: PostmanBody;
  url: PostmanUrl | string;
  auth?: PostmanAuth;
  description?: string;
}

export interface PostmanUrl {
  raw?: string;
  protocol?: string;
  host?: string[];
  port?: string;
  path?: string[];
  query?: PostmanQueryParam[];
  variable?: PostmanVariable[];
}

export interface PostmanHeader {
  key: string;
  value: string;
  type?: string;
  disabled?: boolean;
  description?: string;
}

export interface PostmanQueryParam {
  key: string;
  value: string;
  disabled?: boolean;
  description?: string;
}

export interface PostmanBody {
  mode: 'raw' | 'urlencoded' | 'formdata' | 'file' | 'graphql' | 'none';
  raw?: string;
  urlencoded?: PostmanUrlEncoded[];
  formdata?: PostmanFormData[];
  options?: {
    raw?: {
      language?: string;
    };
  };
  graphql?: {
    query?: string;
    variables?: string;
  };
}

export interface PostmanUrlEncoded {
  key: string;
  value: string;
  type?: string;
  disabled?: boolean;
  description?: string;
}

export interface PostmanFormData {
  key: string;
  value?: string;
  type?: string;
  src?: string;
  disabled?: boolean;
  description?: string;
  contentType?: string;
}

export interface PostmanAuth {
  type: 'noauth' | 'bearer' | 'basic' | 'apikey' | 'oauth2' | 'hawk' | 'digest' | 'ntlm' | 'awsv4';
  bearer?: PostmanAuthParam[];
  basic?: PostmanAuthParam[];
  apikey?: PostmanAuthParam[];
  oauth2?: PostmanAuthParam[];
  [key: string]: any;
}

export interface PostmanAuthParam {
  key: string;
  value: string;
  type?: string;
}

export interface PostmanEvent {
  listen: 'prerequest' | 'test';
  script: PostmanScript;
}

export interface PostmanScript {
  id?: string;
  type?: string;
  exec: string[];
}

export interface PostmanVariable {
  key: string;
  value: string;
  type?: string;
  disabled?: boolean;
  description?: string;
}

// Postman Environment types

export interface PostmanEnvironment {
  id?: string;
  name: string;
  values: PostmanEnvVariable[];
  _postman_variable_scope?: string;
  _postman_exported_at?: string;
  _postman_exported_using?: string;
}

export interface PostmanEnvVariable {
  key: string;
  value: string;
  type?: string;
  enabled?: boolean;
  description?: string;
}

// Internal types

export interface VariableScope {
  request: Record<string, string>;
  collection: Record<string, string>;
  environment: Record<string, string>;
  global: Record<string, string>;
}

export interface ExecutionResult {
  requestName: string;
  requestPath: string;
  method: string;
  url: string;
  status: number;
  statusText: string;
  responseTime: number;
  responseSize: number;
  responseHeaders: Record<string, string>;
  responseBody: any;
  testResults: TestResult[];
  error?: string;
  timestamp: string;
}

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export interface StoredCollection {
  id: string;
  filename: string;
  name: string;
  importedAt: string;
  collection: PostmanCollection;
}

export interface StoredEnvironment {
  id: string;
  filename: string;
  name: string;
  importedAt: string;
  environment: PostmanEnvironment;
}

export interface CollectionTreeNode {
  name: string;
  type: 'folder' | 'request';
  method?: string;
  path: string;
  children?: CollectionTreeNode[];
}
