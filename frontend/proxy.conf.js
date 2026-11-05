// Dev-server proxy for `npm run serve:local-prod`, and the base of
// proxy.conf.parameterized.js: run the frontend locally against the public
// qbit explorers. qbit testnet4 has its own host, which serves its API at /api.
const PROXY_CONFIG = [
    {
        context: ['/testnet4/api/**'],
        target: "https://mempool-testnet.qbit.org",
        pathRewrite: { '^/testnet4': '' },
        ws: true,
        secure: false,
        changeOrigin: true
    },
    {
        context: ['*',
        '/api/**', '!/api/v1/ws'
        ],
        target: "https://mempool.qbit.org",
        ws: true,
        secure: false,
        changeOrigin: true
    },
    {
        context: ['/api/v1/ws'],
        target: "https://mempool.qbit.org",
        ws: true,
        secure: false,
        changeOrigin: true,
    },
    {
      context: ['/resources/mining-pools/**'],
      target: "https://mempool.qbit.org",
      secure: false,
      changeOrigin: true
    }
];

module.exports = PROXY_CONFIG;
