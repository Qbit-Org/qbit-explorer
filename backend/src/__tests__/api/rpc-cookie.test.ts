import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { rpcCookieProblems } from '../../api/bitcoin/rpc-cookie';

describe('RPC cookie startup check', () => {
  let dir: string;
  let cookie: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rpc-cookie-'));
    cookie = path.join(dir, '.cookie');
    fs.writeFileSync(cookie, '__cookie__:abc');
  });

  afterEach(() => {
    fs.chmodSync(cookie, 0o600);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const settings = (coreRpc: object, secondCoreRpc: object = { COOKIE: false, COOKIE_PATH: '' }, secondNode = false) => ({
    MEMPOOL: { USE_SECOND_NODE_FOR_MINFEE: secondNode },
    CORE_RPC: { COOKIE: false, COOKIE_PATH: '', ...coreRpc },
    SECOND_CORE_RPC: { COOKIE: false, COOKIE_PATH: '', ...secondCoreRpc },
  });

  test('passes a readable cookie, and settings without one', () => {
    expect(rpcCookieProblems(settings({ COOKIE: true, COOKIE_PATH: cookie }))).toStrictEqual([]);
    // the password settings, including the empty path start.sh writes
    expect(rpcCookieProblems(settings({ COOKIE: false, COOKIE_PATH: '' }))).toStrictEqual([]);
    expect(rpcCookieProblems(settings({ COOKIE: false, COOKIE_PATH: path.join(dir, 'missing') }))).toStrictEqual([]);
  });

  test('names the setting and the fix when COOKIE_PATH is empty', () => {
    expect(rpcCookieProblems(settings({ COOKIE: true, COOKIE_PATH: '' }))).toStrictEqual([
      'CORE_RPC.COOKIE is true but CORE_RPC.COOKIE_PATH is empty. Set CORE_RPC.COOKIE_PATH to the cookie file qbitd writes '
        + '(rpccookiefile in qbit.conf), or set CORE_RPC.COOKIE to false to use CORE_RPC.USERNAME and CORE_RPC.PASSWORD. '
        + 'RPC calls fail until then: with CORE_RPC.COOKIE true, the backend doesn\'t fall back to the password.',
    ]);
  });

  test('names the path, the setting and the fix when the cookie is missing', () => {
    const missing = path.join(dir, 'missing', '.cookie');
    expect(rpcCookieProblems(settings({ COOKIE: true, COOKIE_PATH: missing }))).toStrictEqual([
      `CORE_RPC.COOKIE is true but qbitd's RPC cookie ${missing} doesn't exist. Start qbitd, and check that `
        + 'CORE_RPC.COOKIE_PATH is where it writes the cookie (rpccookiefile in qbit.conf). '
        + 'RPC calls fail until then: with CORE_RPC.COOKIE true, the backend doesn\'t fall back to the password.',
    ]);
  });

  // root reads any file, so it can't see this failure
  (process.getuid?.() === 0 ? test.skip : test)('names the path, the setting and the fix when the cookie is unreadable', () => {
    fs.chmodSync(cookie, 0o000);
    expect(rpcCookieProblems(settings({ COOKIE: true, COOKIE_PATH: cookie }))).toStrictEqual([
      `CORE_RPC.COOKIE is true but the backend's user can't read qbitd's RPC cookie ${cookie} (EACCES). Add the user to `
        + 'the group that owns the cookie, qbit in production/README.md, which needs rpccookieperms=group in qbit.conf, '
        + 'and start the backend again from a new login. '
        + 'RPC calls fail until then: with CORE_RPC.COOKIE true, the backend doesn\'t fall back to the password.',
    ]);
  });

  test('checks SECOND_CORE_RPC only when the backend uses the second node', () => {
    const second = { COOKIE: true, COOKIE_PATH: '' };
    expect(rpcCookieProblems(settings({}, second, false))).toStrictEqual([]);
    expect(rpcCookieProblems(settings({}, second, true))).toStrictEqual([
      'SECOND_CORE_RPC.COOKIE is true but SECOND_CORE_RPC.COOKIE_PATH is empty. Set SECOND_CORE_RPC.COOKIE_PATH to the '
        + 'cookie file qbitd writes (rpccookiefile in qbit.conf), or set SECOND_CORE_RPC.COOKIE to false to use '
        + 'SECOND_CORE_RPC.USERNAME and SECOND_CORE_RPC.PASSWORD. '
        + 'RPC calls fail until then: with SECOND_CORE_RPC.COOKIE true, the backend doesn\'t fall back to the password.',
    ]);
  });
});
