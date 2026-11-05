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

## Translations

The language menu offers English only. The other `src/locale/messages.<lang>.xlf` files are inherited from upstream mempool, whose volunteer translators are credited in the [upstream frontend README](https://github.com/mempool/mempool/blob/v3.3.1/frontend/README.md#translators), and have not been updated for qbit. This project does not pull translations from upstream's Transifex project. See [`CONTRIBUTING.md`](../CONTRIBUTING.md#translations) for the translation policy.
