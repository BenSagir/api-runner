# API Runner — Local Postman-Compatible API Testing Tool

A local API testing tool that imports and runs Postman Collection v2.1 and Environment files without modification.

## Features

- **Import** Postman collections (v2.1) and environments as-is
- **Browse** requests in a tree view with folders and nested folders
- **Run** single requests, folders, or entire collections sequentially
- **Variables** — full Postman variable resolution: `{{variableName}}` across URL, headers, body, and scripts
- **Variable scopes** — request, collection, environment, global (resolved in order)
- **Scripts** — pre-request and test scripts executed in a sandboxed VM with `pm.*` APIs
- **Auth** — Bearer, Basic, API Key (inherited from collection/folder/request)
- **Persistence** — environment and collection variables persist across runs
- **History** — every run is saved locally

## Supported `pm` Script APIs

```js
pm.environment.get(key)
pm.environment.set(key, value)
pm.collectionVariables.get(key)
pm.collectionVariables.set(key, value)
pm.globals.get(key)
pm.globals.set(key, value)
pm.variables.get(key)   // resolves across all scopes
pm.variables.set(key, value)
pm.response.json()
pm.response.code
pm.test(name, fn)
pm.expect(value).to.equal(expected)
```

## Quick Start

```bash
# Install all dependencies
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# Run (starts backend on :3001 and frontend on :5173)
npm run dev
```

Then open **http://localhost:5173** in your browser.

## Usage

1. Click **Import Collection** → select a Postman v2.1 collection JSON file
2. Click **Import Environment** → select a Postman environment JSON file
3. Select an environment from the dropdown in the header
4. Browse requests in the sidebar tree
5. Click a request to inspect headers, body, auth, and scripts
6. Click **Send** to run a single request, or **▶** on a folder to run all requests in it
7. Click **Run All** to run the entire collection sequentially
8. View results, response bodies, headers, and test results in the main panel
9. Click **Edit Env** to modify environment variables

## Project Structure

```
/api-runner
  /backend
    /src
      /engine
        types.ts              # Postman + internal type definitions
        collectionLoader.ts   # Import, list, tree, item lookup
        environmentLoader.ts  # Import, list, edit environments
        variableResolver.ts   # {{variable}} resolution across scopes
        scriptRuntime.ts      # Sandboxed VM for pm.* scripts
        requestExecutor.ts    # Execute single request via Axios
        collectionRunner.ts   # Run collection/folder sequentially
        historyManager.ts     # Run history persistence
      server.ts               # Express API server
  /frontend
    /src
      api.ts                  # Axios API client
      App.tsx                 # Main app component
      /components
        Sidebar.tsx           # Collection list + request tree
        RequestDetail.tsx     # Request inspector (headers, body, auth, scripts)
        ResponsePanel.tsx     # Response viewer (body, headers, tests)
        EnvironmentEditor.tsx # Edit environment variables
        RunResults.tsx        # Collection run results + summary
  /data
    /collections              # Imported collection JSON files
    /environments             # Imported environment JSON files
    /variables                # Persisted variable overrides
    /history                  # Run history
```

## Technology Stack

| Layer    | Tech                     |
|----------|--------------------------|
| Backend  | Node.js, Express, TypeScript |
| Frontend | React, Vite, TypeScript  |
| HTTP     | Axios                    |
| Scripts  | Node.js VM (sandboxed)   |
