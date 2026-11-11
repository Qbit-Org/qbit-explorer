# qbit Explorer Frontend

You can build and run the frontend and proxy to the public qbit explorer backend at https://mempool.qbit.org (for easier frontend development), or you can connect it to your own backend for a full development instance, custom deployment, etc.

Jump to a section in this doc:
- [Quick Setup for Frontend Development](#quick-setup-for-frontend-development)
- [Manual Frontend Setup](#manual-setup)
- [Translations](#translations)

## Quick Setup for Frontend Development

If you want to quickly improve the UI, fix typos, or make other updates that don't require any backend changes, you don't need to set up an entire backend—you can simply run the frontend locally and proxy to the mempool.qbit.org backend.

### 1. Clone the Repository

Get the latest explorer code:

```
git clone https://github.com/Qbit-Org/qbit-explorer
cd qbit-explorer/frontend
```

### 2. Configure qbit Defaults

Configure the frontend for the qbit mempool profile:

```
$ npm run config:defaults:mempool
```

### 3. Run the Frontend

_Use the Node.js version in the repository's `.nvmrc` and the npm that ships with it._

Install project dependencies and run the frontend server:

```
$ npm ci
$ MEMPOOL_HOSTNAME=mempool.qbit.org npm run serve:parameterized
```

The frontend will be available at http://localhost:4200/ and all API requests will be proxied to https://mempool.qbit.org.

### 4. Test

After making your changes, run the frontend checks that CI runs:

```
$ npm run lint
$ npm run smoke:qbit-scripts
$ npm run smoke:qbit-weight
$ npm run build
```

If all checks pass, submit your PR (see [`CONTRIBUTING.md`](../CONTRIBUTING.md)).

## Manual Setup

Set up the [backend](../backend/) first, if you haven't already.

### 1. Build the Frontend

_Use the Node.js version in the repository's `.nvmrc` and the npm that ships with it._

Build the frontend:

```
cd frontend
npm ci
npm run build
```

### 2. Run the Frontend

#### Development

To run your local frontend with your local backend:

```
npm run serve
```

#### Production

The `npm run build` command from step 1 above should have generated the site in `dist/mempool/browser/`. Put the contents of that directory onto your web server.

You will probably want to set up a reverse proxy, TLS, etc. There are sample nginx configuration files in the top level of the repository for reference, but note that support for such tasks is outside the scope of this project.

#### Server-side rendering

Instead of serving the static build, you can run a Node.js server that renders each page before sending it, so crawlers and link previews see the page's content:

```
npm run build:ssr
npm run serve:ssr
```

`build:ssr` runs `npm run build`, then builds the server into `dist/mempool/server/`. `serve:ssr` listens on port 4000, or on `PORT`. Put it behind your reverse proxy, and keep sending `/api`, including the WebSocket, to the backend.

A page waits for the API calls it makes while it renders. If it takes longer than `SSR_RENDER_TIMEOUT_MS`, an environment variable read at startup (5000 by default), the server sends the page for the browser to render instead, with `Cache-Control: no-store`, and logs its path.

The server renders pages only for the hostnames in `NG_ALLOWED_HOSTS`, Angular's environment variable, which it reads when it starts. List them without ports, separated by commas, such as `NG_ALLOWED_HOSTS=explorer.example.com,*.example.org`; `*.example.org` covers that domain's subdomains. A request for any other `Host` gets `400 Bad Request`, because the page's relative URLs resolve against that header, and so does a `Host` that holds anything but a hostname or IP address and an optional port. Without `NG_ALLOWED_HOSTS`, the server renders for `localhost`, `127.0.0.1`, and the domains in `PROD_DOMAINS` with their subdomains. That covers requests to the server itself, and a proxy that passes the server's address as `Host`. If your proxy passes the visitor's `Host` (`proxy_set_header Host $host;` in nginx), set `NG_ALLOWED_HOSTS` or `PROD_DOMAINS` to your site's hostnames. The server logs the list when it starts.

The server also reads these settings from `mempool-frontend-config.json`. It keeps the values set when it was built, so run `build:ssr` again after you change them.

- `NGINX_PROTOCOL`, `NGINX_HOSTNAME` and `NGINX_PORT`: where the server requests the API while it renders a page.
- `PROD_DOMAINS`: your site's domains, separated by commas, such as `"explorer.example.com"`.

## Translations

The language menu offers English only. The other `src/locale/messages.<lang>.xlf` files are inherited from upstream mempool, whose volunteer translators are credited in the [upstream frontend README](https://github.com/mempool/mempool/blob/v3.3.1/frontend/README.md#translators), and have not been updated for qbit. This project does not pull translations from upstream's Transifex project. See [`CONTRIBUTING.md`](../CONTRIBUTING.md#translations) for the translation policy.
