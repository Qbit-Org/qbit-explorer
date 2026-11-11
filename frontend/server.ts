// zone.js/node, as in Angular's own SSR template: the browser build doesn't
// patch Node's I/O, so an API error during a render escaped Angular's error
// handler and crashed the server
import 'zone.js/node';
import './src/resources/config.js';
// index.html loads customize.js after config.js; render with it too
import './src/resources/customize.js';

import { CommonEngine } from '@angular/ssr/node';
import * as express from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as domino from 'domino';

import { isIPv6 } from 'net';
import { join } from 'path';
import { AppServerModule } from './src/main.server';
import { APP_BASE_HREF } from '@angular/common';
import { existsSync } from 'fs';

import { ResizeObserver } from './shims';

// Hosts to render pages for. Angular resolves relative URLs against the
// request's Host header, so this keeps a forged one from pointing the
// server's requests elsewhere. NG_ALLOWED_HOSTS is Angular's own setting:
// comma-separated hostnames, where `*.example.com` covers example.com's
// subdomains. Without it, the server renders for localhost, 127.0.0.1 and
// the frontend config's PROD_DOMAINS, with their subdomains.
function hostList(hosts: unknown): string[] {
  return (Array.isArray(hosts) ? hosts : String(hosts ?? '').split(','))
    .map((host) => String(host).trim().toLowerCase()).filter(Boolean);
}
const allowedHosts = hostList(process.env.NG_ALLOWED_HOSTS);
if (allowedHosts.length === 0) {
  const prodDomains = hostList(global.__env?.PROD_DOMAINS);
  allowedHosts.push('localhost', '127.0.0.1', ...prodDomains.flatMap((domain) => [domain, `*.${domain}`]));
}
// CommonEngine reads NG_ALLOWED_HOSTS itself, ahead of its allowedHosts
// option, so it gets this list there too: lowercase, and never empty
process.env.NG_ALLOWED_HOSTS = allowedHosts.join(',');
// eslint-disable-next-line no-console
console.log(`Rendering pages for ${allowedHosts.join(', ')}`);

const commonEngine = new CommonEngine({ allowedHosts });

// CommonEngine waits until the app is stable, so a timer left running would
// hold the request open forever. After SSR_RENDER_TIMEOUT_MS, 5 seconds by
// default, the server sends the page for the browser to render instead.
const configuredRenderTimeout = Number(process.env.SSR_RENDER_TIMEOUT_MS);
const renderTimeoutMs = Number.isFinite(configuredRenderTimeout) && configuredRenderTimeout > 0 ? configuredRenderTimeout : 5_000;

// A Host header that holds a host and nothing else: a hostname, an IPv4
// address or a bracketed IPv6 address, then an optional port from 1 to
// 65535. Which hosts may render is NG_ALLOWED_HOSTS's job.
function isHostAndPort(host: string | undefined): boolean {
  const match = /^(?:[A-Za-z0-9._-]+|\[([0-9A-Fa-f:.]+)\])(?::(\d{1,5}))?$/.exec(host ?? '');
  if (!match || (match[1] !== undefined && !isIPv6(match[1]))) {
    return false;
  }
  return match[2] === undefined || (Number(match[2]) >= 1 && Number(match[2]) <= 65535);
}

const template = fs.readFileSync(path.join(process.cwd(), 'dist/mempool/browser/en-US/', 'index.html')).toString();
const win = domino.createWindow(template);

// @ts-ignore
win.__env = global.__env;

// @ts-ignore
win.matchMedia = (media) => {
  return {
    media,
    matches: true,
  };
};

// @ts-ignore
win.setTimeout = (fn) => { fn(); };
win.document.body.scrollTo = (() => {});
// domino throws NotYetImplemented on document.referrer, which StateService reads
Object.defineProperty(win.document, 'referrer', { value: '' });
win['ResizeObserver'] = ResizeObserver;
// @ts-ignore
global['window'] = win;
// @ts-ignore
global['document'] = win.document;
// @ts-ignore
global['history'] = { state: { } };
// @ts-ignore
Object.defineProperty(global, 'navigator', {
  value: win.navigator,
  writable: true
});

// The server draws no frames, so requestAnimationFrame callbacks never run.
// The block graphs call it, and Node doesn't have it.
global['requestAnimationFrame'] = (): number => 0;
global['cancelAnimationFrame'] = (): void => undefined;

global['localStorage'] = {
  getItem: () => '',
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
  length: 0,
  key: () => '',
};

// The Express app is exported so that it can be used by serverless Functions.
export function app(locale: string): express.Express {
  const server = express();
  const distFolder = join(process.cwd(), `dist/mempool/browser/${locale}`);
  const indexHtml = join(distFolder, 'index.html');

  server.set('view engine', 'html');
  server.set('views', distFolder);

  // static file handler so we send HTTP 404 to nginx
  server.get(/\.(?:css|js|json|ico|webmanifest|png|jpg|jpeg|svg|mp4)$/i, express.static(distFolder, { maxAge: '1y', fallthrough: false }));
  // handle page routes
  server.get('/{*path}', (req, res, next) => {
    const { protocol, originalUrl, baseUrl, headers } = req;
    const url = `${protocol}://${headers.host}${originalUrl}`;

    // CommonEngine checks only the hostname it parses from this URL, so
    // `Host: example.com@localhost` would pass as localhost, and
    // `Host: localhost/tx/abc` would render another page than the one asked
    // for. A Host that doesn't parse, such as an empty one, would end in a 500.
    if (!isHostAndPort(headers.host) || !URL.canParse(url)) {
      res.status(400).type('text/plain').send('Bad Request: the Host header must be a hostname or IP address, with an optional port.\n');
      return;
    }

    const rendered = commonEngine
      .render({
        bootstrap: AppServerModule,
        documentFilePath: indexHtml,
        url,
        publicPath: distFolder,
        providers: [{ provide: APP_BASE_HREF, useValue: baseUrl }],
      });
    let renderTimer: ReturnType<typeof setTimeout>;
    const timedOut = new Promise<null>((resolve) => {
      renderTimer = setTimeout(() => resolve(null), renderTimeoutMs);
    });
    Promise.race([rendered, timedOut])
      .then((html) => {
        if (html === null) {
          // The render goes on in the background; only this answer is bounded.
          // eslint-disable-next-line no-console
          console.error(`SSR: ${originalUrl} didn't render within ${renderTimeoutMs} ms, so it was sent for the browser to render`);
          res.set('Cache-Control', 'no-store').sendFile(indexHtml);
          return;
        }
        res.send(html);
      })
      .catch((err) => {
        // CommonEngine rejects a host that NG_ALLOWED_HOSTS doesn't cover.
        // Answer 400, as Angular's newer engine does, not Express's 500.
        if (/ is not allowed\b/.test(String(err?.message))) {
          res.status(400).type('text/plain').send(`${err.message} See NG_ALLOWED_HOSTS.\n`);
          return;
        }
        next(err);
      })
      .finally(() => clearTimeout(renderTimer));
  });

  return server;
}


// only used for development mode
function run(): void {
  const port = process.env.PORT || 4000;

  // Start up the Node server
  const server = app('en-US');
  server.listen(port, (error?: Error) => {
    if (error) {
      throw error;
    }
    console.log(`Node Express server listening on port ${port}`);
  });
}

// Webpack will replace 'require' with '__webpack_require__'
// '__non_webpack_require__' is a proxy to Node 'require'
// The below code is to ensure that the server is run only when not requiring the bundle.
declare const __non_webpack_require__: NodeRequire;
const mainModule = __non_webpack_require__.main;
const moduleFilename = mainModule && mainModule.filename || '';
if (moduleFilename === __filename || moduleFilename.includes('iisnode')) {
  run();
}