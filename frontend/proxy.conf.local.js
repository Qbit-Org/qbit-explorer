let PROXY_CONFIG = [];

PROXY_CONFIG.push(...[
  {
    context: ['/regtest/api/v1/**'],
    target: `http://localhost:8999`,
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
    target: `http://localhost:8999`,
    secure: false,
    changeOrigin: true,
    proxyTimeout: 30000,
    pathRewrite: {
        "^/regtest/api/": "/api/v1/"
    },
  },
  {
    context: ['/api/v1/**'],
    target: `http://localhost:8999`,
    secure: false,
    ws: true,
    changeOrigin: true,
    proxyTimeout: 30000,
  },
  {
    context: ['/api/**'],
    target: `http://localhost:8999`,
    secure: false,
    changeOrigin: true,
    proxyTimeout: 30000,
    pathRewrite: {
        "^/api/": "/api/v1/"
    },
  }
]);

console.log(PROXY_CONFIG);

module.exports = PROXY_CONFIG;
