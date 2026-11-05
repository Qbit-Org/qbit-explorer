// Dev-server proxy for `npm run serve:parameterized`: proxy.conf.js with the
// explorer hosts taken from MEMPOOL_HOSTNAME (mainnet, default mempool.qbit.org)
// and MEMPOOL_TESTNET4_HOSTNAME (testnet4, default mempool-testnet.qbit.org),
// for example `MEMPOOL_HOSTNAME=mempool.qbit.org npm run serve:parameterized`.
// Set both when pointing at another deployment; the testnet4 host must serve
// its API at /api.
const PROXY_CONFIG = require('./proxy.conf');

const hosts = {
  'https://mempool.qbit.org': process.env.MEMPOOL_HOSTNAME || 'mempool.qbit.org',
  'https://mempool-testnet.qbit.org': process.env.MEMPOOL_TESTNET4_HOSTNAME || 'mempool-testnet.qbit.org',
};

PROXY_CONFIG.forEach((entry) => {
  if (hosts[entry.target]) {
    entry.target = `https://${hosts[entry.target]}`;
  }
});

module.exports = PROXY_CONFIG;
