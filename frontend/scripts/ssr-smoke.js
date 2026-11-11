#!/usr/bin/env node

// Starts the server-side rendering server that `npm run build:ssr` builds,
// checks that it renders the app at `/` and refuses hosts it doesn't allow,
// then stops it. Then starts it with a 1 ms render timeout and checks that
// it falls back to the page for the browser to render. Expects a build with
// the default allowed hosts.

const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');
const { setTimeout, clearTimeout } = require('timers');

const frontendRoot = path.resolve(__dirname, '..');
const START_TIMEOUT_MS = 60_000;
const REQUEST_TIMEOUT_MS = 60_000;

for (const file of ['server.run.js', 'dist/mempool/server/en-US/main.js', 'dist/mempool/browser/en-US/index.html']) {
  if (!fs.existsSync(path.join(frontendRoot, file))) {
    console.error(`${file} is missing: run npm run build:ssr first`);
    process.exit(1);
  }
}

function request(port, urlPath, host) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: urlPath, headers: { host } }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'] || '', headers: res.headers, body }));
    });
    req.setTimeout(REQUEST_TIMEOUT_MS, () => req.destroy(new Error(`GET ${urlPath} (Host: ${host}) timed out after ${REQUEST_TIMEOUT_MS / 1000} s`)));
    req.on('error', reject);
  });
}

// A request with the Host header exactly as given, which http.get can't
// send empty
function rawRequest(port, host) {
  return new Promise((resolve, reject) => {
    let data = '';
    const socket = net.connect(port, '127.0.0.1', () => socket.write(`GET / HTTP/1.1\r\nHost: ${host}\r\nConnection: close\r\n\r\n`));
    socket.setEncoding('utf8');
    socket.setTimeout(REQUEST_TIMEOUT_MS, () => socket.destroy(new Error(`GET / (Host: ${host}) timed out after ${REQUEST_TIMEOUT_MS / 1000} s`)));
    socket.on('data', (chunk) => data += chunk);
    socket.on('end', () => {
      const status = Number((/^HTTP\/1\.1 (\d{3})/.exec(data) || [])[1]);
      resolve({ status, body: data.slice(data.indexOf('\r\n\r\n') + 4) });
    });
    socket.on('error', reject);
  });
}

// The server starts on PORT=0 and logs the port the system gave it.
function listeningPort(server, output) {
  return new Promise((resolve, reject) => {
    let timer = null;
    const onData = () => {
      const match = output().match(/listening on port (\d+)/);
      if (match) {
        done(null, Number(match[1]));
      }
    };
    const onExit = (code, signal) => done(new Error(`the server exited before listening (${code ?? signal})`));
    const done = (error, port) => {
      clearTimeout(timer);
      server.stdout.off('data', onData);
      server.off('exit', onExit);
      if (error) {
        reject(error);
      } else {
        resolve(port);
      }
    };
    timer = setTimeout(() => done(new Error(`the server didn't listen within ${START_TIMEOUT_MS / 1000} s`)), START_TIMEOUT_MS);
    server.stdout.on('data', onData);
    server.on('exit', onExit);
  });
}

function stop(server) {
  if (server.exitCode !== null || server.signalCode !== null) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const kill = setTimeout(() => server.kill('SIGKILL'), 5_000);
    server.once('exit', () => { clearTimeout(kill); resolve(); });
    server.kill('SIGTERM');
  });
}

// Starts server.run.js on PORT=0, with the hosts the build allows rather
// than ones from this shell, and the given render timeout or the default.
async function startServer(servers, renderTimeoutMs) {
  const env = { ...process.env, PORT: '0' };
  delete env.NG_ALLOWED_HOSTS;
  delete env.SSR_RENDER_TIMEOUT_MS;
  if (renderTimeoutMs) {
    env.SSR_RENDER_TIMEOUT_MS = String(renderTimeoutMs);
  }
  const server = { process: spawn(process.execPath, ['server.run.js'], { cwd: frontendRoot, env, stdio: ['ignore', 'pipe', 'pipe'] }), log: '' };
  server.process.stdout.on('data', (chunk) => server.log += chunk);
  server.process.stderr.on('data', (chunk) => server.log += chunk);
  servers.push(server);
  server.port = await listeningPort(server.process, () => server.log);
  return server;
}

// The server writes its log asynchronously, so give a line a moment to arrive.
async function waitForLog(server, pattern) {
  const deadline = Date.now() + 5_000;
  while (!pattern.test(server.log) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return pattern.test(server.log);
}

function check(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

// Angular marks a page it rendered on the server. Without the mark, the
// server sent index.html for the browser to render.
function isRendered(page) {
  return page.status === 200 && /<app-root[^>]*\sng-server-context="ssr"/.test(page.body);
}

async function main() {
  const servers = [];
  try {
    const { port } = await startServer(servers);
    const host = `localhost:${port}`;

    // an allowed host, with a port
    const started = Date.now();
    const page = await request(port, '/', host);
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    check(page.status === 200, `GET / answered ${page.status}, not 200`);
    check(page.type.startsWith('text/html'), `GET / answered ${page.type}, not text/html`);
    check(isRendered(page), 'GET / sent the unrendered index.html: <app-root> has no ng-server-context="ssr"');
    // the routed page itself, not just an empty <router-outlet>
    check(page.body.includes('<app-master-page'), 'GET / rendered <app-root> without the page layout (<app-master-page>)');
    check(!page.body.includes('id="qbit-preboot"'), 'GET / still has the pre-boot skeleton from index.html');
    // the qbit.org header and footer styles read these custom properties
    check(/<style id="qbit-design-tokens">:root\{[^}]*--qbit-paper:/.test(page.body), 'GET / has no qbit design tokens (<style id="qbit-design-tokens">)');
    console.log(`GET / for Host ${host} rendered the app: ${page.status}, ${Buffer.byteLength(page.body)} bytes, ${seconds} s`);

    const refused = await request(port, '/', 'example.com');
    check(refused.status === 400, `GET / for Host example.com answered ${refused.status}, not 400`);
    console.log(`GET / for Host example.com, which isn't allowed: ${refused.status}`);

    // Host headers that hold more than a host and port, or nothing
    for (const badHost of [`example.com@localhost:${port}`, 'localhost/tx/abc', '']) {
      const bad = await rawRequest(port, badHost);
      check(bad.status === 400 && bad.body.startsWith('Bad Request: the Host header'), `GET / for Host "${badHost}" answered ${bad.status}, not the 400 for a malformed Host`);
    }
    // an IPv6 literal is a host: the allowlist, not the Host check, refuses it
    const ipv6 = await rawRequest(port, `[::1]:${port}`);
    check(ipv6.status === 400 && ipv6.body.includes('URL with hostname "[::1]" is not allowed'), `GET / for Host [::1] answered ${ipv6.status} without the allowlist's refusal`);
    console.log('Host headers: 400 for example.com@localhost, localhost/tx/abc and an empty one; [::1] reaches the allowlist');

    const asset = await request(port, '/favicon.ico', host);
    check(asset.status === 200, `GET /favicon.ico answered ${asset.status}, not 200`);
    const missing = await request(port, '/missing.js', host);
    check(missing.status === 404, `GET /missing.js answered ${missing.status}, not 404`);
    // a file extension inside a page's path doesn't make it a static file
    const pagePath = await request(port, '/x.json/page', host);
    check(isRendered(pagePath), `GET /x.json/page answered ${pagePath.status} without a rendered page`);
    console.log(`Static files: ${asset.status} for /favicon.ico, ${missing.status} for /missing.js; /x.json/page rendered`);

    // A render that takes longer than SSR_RENDER_TIMEOUT_MS gets the page for
    // the browser to render, which no cache should keep, and a log line.
    const slow = await startServer(servers, 1);
    const fallback = await request(slow.port, '/', `localhost:${slow.port}`);
    check(fallback.status === 200 && !isRendered(fallback) && fallback.body.includes('id="qbit-preboot"'), `GET / with a 1 ms render timeout answered ${fallback.status} without the page for the browser to render`);
    check(fallback.headers['cache-control'] === 'no-store', `GET / with a 1 ms render timeout answered Cache-Control: ${fallback.headers['cache-control']}, not no-store`);
    check(await waitForLog(slow, /SSR: \/ didn't render within 1 ms/), 'the server logged no line for the render that timed out');
    console.log(`Render timeout: ${fallback.status} with the page for the browser to render, Cache-Control: ${fallback.headers['cache-control']}, and a log line`);
  } catch (error) {
    console.error(`SSR smoke failed: ${error.message}`);
    for (const server of servers) {
      console.error(`--- server output (port ${server.port}) ---`);
      console.error(server.log.split('\n').slice(-200).join('\n'));
    }
    process.exitCode = 1;
  } finally {
    await Promise.all(servers.map((server) => stop(server.process)));
  }
}

main();
