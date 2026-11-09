let PROXY_CONFIG = [];

PROXY_CONFIG.push(...[
  {
    context: ['/regtest/api/v1/**'],
    target: `http://127.0.0.1:8999`,
    secure: false,
    ws: true,
    changeOrigin: true,
    proxyTimeout: 30000,
    pathRewrite: {
        "^/regtest": ""
    },
  },
  {
    context: ['/regtest/api/**'],
    target: `http://127.0.0.1:8999`,
    secure: false,
    changeOrigin: true,
    proxyTimeout: 30000,
    pathRewrite: {
        "^/regtest/api/": "/api/v1/"
    },
  },
  {
    context: ['/api/v1/**'],
    target: `http://127.0.0.1:8999`,
    secure: false,
    ws: true,
    changeOrigin: true,
    proxyTimeout: 30000,
  },
  {
    context: ['/api/**'],
    target: `https://mempool.qbit.org`,
    secure: false,
    changeOrigin: true,
    proxyTimeout: 30000,
  }
]);

console.log(PROXY_CONFIG);

module.exports = PROXY_CONFIG;
