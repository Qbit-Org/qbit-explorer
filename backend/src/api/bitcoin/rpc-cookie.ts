import { readFileSync } from 'fs';

interface RpcCookieSettings {
  COOKIE: boolean;
  COOKIE_PATH: string;
}

interface RpcSettings {
  MEMPOOL: { USE_SECOND_NODE_FOR_MINFEE: boolean };
  CORE_RPC: RpcCookieSettings;
  SECOND_CORE_RPC: RpcCookieSettings;
}

function rpcCookieProblem(section: string, rpc: RpcCookieSettings): string | null {
  if (!rpc.COOKIE) {
    return null;
  }
  const consequence = `RPC calls fail until then: with ${section}.COOKIE true, the backend doesn't fall back to the password.`;
  if (!rpc.COOKIE_PATH) {
    return `${section}.COOKIE is true but ${section}.COOKIE_PATH is empty. Set ${section}.COOKIE_PATH to the cookie file `
      + `qbitd writes (rpccookiefile in qbit.conf), or set ${section}.COOKIE to false to use ${section}.USERNAME and `
      + `${section}.PASSWORD. ${consequence}`;
  }
  try {
    readFileSync(rpc.COOKIE_PATH);
    return null;
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      return `${section}.COOKIE is true but qbitd's RPC cookie ${rpc.COOKIE_PATH} doesn't exist. Start qbitd, and check `
        + `that ${section}.COOKIE_PATH is where it writes the cookie (rpccookiefile in qbit.conf). ${consequence}`;
    }
    if (code === 'EACCES') {
      return `${section}.COOKIE is true but the backend's user can't read qbitd's RPC cookie ${rpc.COOKIE_PATH} (EACCES). `
        + 'Add the user to the group that owns the cookie, qbit in production/README.md, which needs '
        + `rpccookieperms=group in qbit.conf, and start the backend again from a new login. ${consequence}`;
    }
    return `${section}.COOKIE is true but the backend can't read qbitd's RPC cookie ${rpc.COOKIE_PATH} `
      + `(${code || (e instanceof Error ? e.message : e)}). Check ${section}.COOKIE_PATH. ${consequence}`;
  }
}

/**
 * The startup errors for RPC cookie settings the backend can't use: each names
 * the setting, the path and the fix. SECOND_CORE_RPC counts only when the
 * backend uses the second node.
 */
export function rpcCookieProblems(config: RpcSettings): string[] {
  const sections: [string, RpcCookieSettings][] = [['CORE_RPC', config.CORE_RPC]];
  if (config.MEMPOOL.USE_SECOND_NODE_FOR_MINFEE) {
    sections.push(['SECOND_CORE_RPC', config.SECOND_CORE_RPC]);
  }
  return sections
    .map(([section, rpc]) => rpcCookieProblem(section, rpc))
    .filter((problem): problem is string => problem !== null);
}
