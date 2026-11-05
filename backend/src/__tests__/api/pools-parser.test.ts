const mockDbQuery = jest.fn();
const mockGetBlocks = jest.fn(() => [] as any[]);
const mockRefreshCachedBlocks = jest.fn();
const mockGetUnknownPool = jest.fn();
const mockReplacePoolsWithUnknown = jest.fn();
const mockGetPoolByUniqueId = jest.fn();
const mockInsertNewMiningPool = jest.fn();
const mockRenameMiningPool = jest.fn();
const mockUpdateMiningPoolLink = jest.fn();
const mockUpdateMiningPoolTags = jest.fn();
const mockDeleteStalePools = jest.fn();
const mockGetPools = jest.fn();
const mockSavePool = jest.fn();
const mockUpdateDefinitionHash = jest.fn();
const mockMining = { reindexHashrateRequested: false };

jest.mock('../../database', () => ({
  __esModule: true,
  default: {
    query: mockDbQuery,
  },
}));

jest.mock('../../config', () => ({
  __esModule: true,
  default: {
    DATABASE: {
      ENABLED: true,
    },
    MEMPOOL: {
      NETWORK: 'testnet4',
    },
  },
}));

jest.mock('../../repositories/PoolsRepository', () => ({
  __esModule: true,
  default: {
    $getUnknownPool: mockGetUnknownPool,
    $replacePoolsWithUnknown: mockReplacePoolsWithUnknown,
    $getPoolByUniqueId: mockGetPoolByUniqueId,
    $insertNewMiningPool: mockInsertNewMiningPool,
    $renameMiningPool: mockRenameMiningPool,
    $updateMiningPoolLink: mockUpdateMiningPoolLink,
    $updateMiningPoolTags: mockUpdateMiningPoolTags,
    $deleteStalePools: mockDeleteStalePools,
    $getPools: mockGetPools,
  },
}));

jest.mock('../../api/disk-cache', () => ({
  __esModule: true,
  default: {
    $saveCacheToDisk: jest.fn(),
    setIgnoreBlocksCache: jest.fn(),
  },
}));

jest.mock('../../api/redis-cache', () => ({
  __esModule: true,
  default: {
    $updateBlocks: jest.fn(),
    setIgnoreBlocksCache: jest.fn(),
  },
}));

jest.mock('../../api/mining/mining', () => ({
  __esModule: true,
  default: mockMining,
}));

jest.mock('../../api/blocks', () => ({
  __esModule: true,
  default: {
    getBlocks: mockGetBlocks,
    $refreshCachedBlocks: mockRefreshCachedBlocks,
  },
}));

jest.mock('../../repositories/BlocksRepository', () => ({
  __esModule: true,
  default: {
    $savePool: mockSavePool,
    $updateDefinitionHash: mockUpdateDefinitionHash,
  },
}));

jest.mock('../../api/transaction-utils', () => ({
  __esModule: true,
  default: {
    // faithful copy of TransactionUtils.hex2ascii so coinbase tag matching
    // behaves like production
    hex2ascii: jest.fn((hex: string) => {
      let str = '';
      for (let i = 0; i < hex.length; i += 2) {
        str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
      }
      return str;
    }),
  },
}));

jest.mock('../../logger', () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
    err: jest.fn(),
    info: jest.fn(),
    notice: jest.fn(),
    warn: jest.fn(),
    tags: {
      mining: 'mining',
    },
  },
}));

import * as fs from 'fs';
import * as path from 'path';
import poolsParser from '../../api/pools-parser';
import { parseAuxPowParentCoinbase } from '../../utils/qbit-auxpow';
import { LUXOR_BLOCK_4214_HEADER } from '../fixtures/qbit-auxpow-headers';

const SHARED_AUXPOW_QBIT_ADDRESS = 'qb1zkq6x308cjzhn8ke945yzm9cu4yft98rgkv6qg50ndrsdy4gdl02qzvytm3';

function compactSize(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value >= 0xfd) {
    throw new Error(`test fixture CompactSize value out of range: ${value}`);
  }
  return value.toString(16).padStart(2, '0');
}

// Minimal valid CAuxPow serialization carrying real parent coinbase evidence.
// The fixture builder derives CompactSize lengths from the data and keeps the
// branches and parent header synthetic, avoiding multiple large raw headers.
function buildAuxPowHeader(parentCoinbaseRaw: string, parentOutputScripts: string[]): string {
  const serializedOutputs = parentOutputScripts.flatMap(script => [
    '0000000000000000',
    compactSize(script.length / 2),
    script,
  ]);
  return [
    '00e10520', '00'.repeat(76), // AuxPoW child header
    '01000000', '01', '00'.repeat(32), 'ffffffff', // parent tx version/input
    compactSize(parentCoinbaseRaw.length / 2), parentCoinbaseRaw, 'ffffffff',
    compactSize(parentOutputScripts.length), ...serializedOutputs,
    '00000000', // parent tx locktime
    '00', '00000000', // empty coinbase merkle branch and index
    '00', '00000000', // empty chain merkle branch and index
    '00'.repeat(80), // synthetic parent header
  ].join('');
}

const SHARED_AUXPOW_MINERS = [
  {
    definitionId: 5,
    databaseId: 9,
    name: 'AntPool',
    slug: 'antpool',
    link: 'https://www.antpool.com',
    height: 7883,
    blockHash: '373ffac217ec48755c908321909ebf8879963242802cbb386028aef4c8c4e542',
    qbitCoinbaseRaw: '02cb1e00',
    parentBlockHash: '0000000000000000003f336d5701057221a46a4e591bdf91f346b8b1716d6e22',
    parentCoinbaseRaw:
      '0306a20e1b4d696e656420627920416e74506f6f6c3930368e00dc016fd0c6d3' +
      'fabe6d6d1d0fa056668847904f5b35c67a624c4b84812edabb1214585f877cd8' +
      'ea2d1e6410000000000000000000aa548f03000000000000',
    parentAddresses: [
      '37jKPSmbEGwgfacCr2nayn1wTaqMAbA94Z',
      '39C7fxSzEACPjM78Z7xdPxhf7mKxJwvfMJ',
    ],
    registeredParentAddresses: ['39C7fxSzEACPjM78Z7xdPxhf7mKxJwvfMJ'],
    parentTags: ['Mined by AntPool'],
    parentOutputScripts: [
      'a91442402a28dd61f2718a4b27ae72a4791d5bbdade787',
      'a9145249bdf2c131d43995cff42e8feee293f79297a887',
    ],
  },
  {
    definitionId: 6,
    databaseId: 10,
    name: 'WhitePool',
    slug: 'whitepool',
    link: 'https://whitebit.com/mining-pool',
    height: 7957,
    blockHash: 'bd3434ea9cc6f43e691a09b513139815db06a07a8ed865728d0c872716b90897',
    qbitCoinbaseRaw: '02151f00',
    parentBlockHash: '000000000000000000162910398e05582032f03b3438d5933f6abd003f5b4529',
    parentCoinbaseRaw:
      '0309a20e115768697465506f6f6ce90015007c0b9ac8fabe6d6da75b2230297d' +
      'e2948c2180b011c322b8b1324c46d931796ee69c501b68d8a20f100000000000' +
      '00000000aa5b98b5000000000000',
    parentAddresses: ['3QmwRxUVQSobeKnNWSjtYmRbU2uxYQzRrG'],
    registeredParentAddresses: ['3QmwRxUVQSobeKnNWSjtYmRbU2uxYQzRrG'],
    parentTags: ['WhitePool'],
    parentOutputScripts: ['a914fd3938eda8ef5c62bdda522d8321d6ee6456a2c187'],
  },
  {
    definitionId: 7,
    databaseId: 11,
    name: 'BTC.com',
    slug: 'btccom',
    link: 'https://cloverpool.com',
    height: 7927,
    blockHash: '0754c76cb68966768c99783e8bc0f29a9b3b337113c654f87f75c1a15766cb8a',
    qbitCoinbaseRaw: '02f71e00',
    parentBlockHash: '0000000000000000002f19949d566fae860fff865938207c2f5372e7ba344296',
    parentCoinbaseRaw:
      '0308a20e11627463636f6d3935368f003a0276bd12a6fabe6d6d617c0be645b4' +
      '5ed98d0f78fbe509fb4c9975c17f3b24d7e82523372a8f0fbb69100000000000' +
      '00000000f7f08579000000000000',
    parentAddresses: [
      '3J1zSHERKN7FgsEjHeTcwG9tYE3GuMWTcM',
      '36cWgjEtxQSFgbHTJDw5AB96ZX7fJk1URd',
    ],
    registeredParentAddresses: ['36cWgjEtxQSFgbHTJDw5AB96ZX7fJk1URd'],
    parentTags: ['btccom'],
    parentOutputScripts: [
      'a914b318ac9dd6edf46e9a875498843633350ac27b8587',
      'a91435fe8eea72c226a327ef7136789304868fb59d2a87',
    ],
  },
  {
    definitionId: 8,
    databaseId: 12,
    name: 'Binance Pool',
    slug: 'binancepool',
    link: 'https://pool.binance.com',
    height: 7924,
    blockHash: 'c2e32d2f068de635b0db60809f24628c0cbd3132d4b06b808cba0c6a0729e8d4',
    qbitCoinbaseRaw: '02f41e00',
    parentBlockHash: '00000000000000000007144658bb07327b2d75fd3de9cf50550a6537ee0d4cc3',
    parentCoinbaseRaw:
      '0308a20e1062696e616e63652f8f002a00765642dcfabe6d6db2d16f4dcdd691' +
      '32d54d0e1fd6ec361d26160a8ae007a6fc4670fb86f0b7505e10000000000000' +
      '0000000b2565f80e0000000000',
    parentAddresses: [
      '35BpUGMm4Cod9dVWwdTJK1A4RDsCE3zTVC',
      '3G7jcEELKh38L6kaSV8K35pTqsh5bgZW2D',
    ],
    registeredParentAddresses: ['3G7jcEELKh38L6kaSV8K35pTqsh5bgZW2D'],
    parentTags: ['binance'],
    parentOutputScripts: [
      'a914265ae1340f5d442d099ffc27b443ffdba4bc034687',
      'a9149e3e8a50d9acb3ac7649625432e2207c25e0faf887',
    ],
  },
  {
    definitionId: 9,
    databaseId: 13,
    name: 'ULTIMUSPOOL',
    slug: 'ultimuspool',
    link: 'https://www.ultimuspool.com',
    height: 7925,
    blockHash: 'fa32fc824a061faa135d1814b7c9b104d6ac4f67f888adda1d98158a5dbc9c8c',
    qbitCoinbaseRaw: '02f51e00',
    parentBlockHash: '0000000000000000001c96db5dc59ef6d0ee790dec5db174fb33b541d2ba83d5',
    parentCoinbaseRaw:
      '0308a20e152f756c74696d75732f3738338f009e027660578c01fabe6d6d1c26' +
      '00c0d9d5f9512f23b17b010472bdbce10dabd3c657f53e9f4d8721c57f1f1000' +
      '000000000000000039dbf2cd000000000000',
    parentAddresses: [
      '36MbhpVScX6QV8hWwZ19xXLHXJfGoj8h1g',
      '3C9sAKXrBVpJVe3b738yik4LPHpPmceBgd',
    ],
    registeredParentAddresses: ['3C9sAKXrBVpJVe3b738yik4LPHpPmceBgd'],
    parentTags: ['/ultimus/'],
    parentOutputScripts: [
      'a914332c82217820c32fb9c107b67356cfdc8f8da6a687',
      'a91472c52c9c71c5f644cf6e712661710503e65e69ad87',
    ],
  },
].map(miner => ({
  ...miner,
  qbitAddress: SHARED_AUXPOW_QBIT_ADDRESS,
  header: buildAuxPowHeader(miner.parentCoinbaseRaw, miner.parentOutputScripts),
}));

const SECPOOL_AUXPOW_MINER = {
  definitionId: 10,
  databaseId: 14,
  name: 'SECPOOL',
  slug: 'secpool',
  link: 'https://www.secpool.com',
  height: 8204,
  blockHash: 'f3a90f4e71e8c83d068e141762bb7ed46420136f05bf789c628ec7a1d1a9c686',
  qbitCoinbaseRaw: '020c2000',
  qbitAddress: 'qb1zgdwqjnwla8vtsal9vjckyyxa4nl85s75xq25wey6vn0t506l4hwqy0p2u9',
  parentBlockHash: '0000000000000000000352d5d7b05ef7f9f46b25d58f461b0af449b4af69e84f',
  parentCoinbaseRaw:
    '031ea20e20202020204d696e656420627920536563706f6f6c202020204f001e' +
    '06cf2cf36afabe6d6dee0911148c092fe14001d7a6532154865d99af0c4af383' +
    'dd7f6def15e682a9dc10000000000000000000215d5c442a0000000000',
  parentAddresses: [
    '3Eif1JfqeMERRsQHtvGEacNN9hhuvnsfe9',
    '3Awm3FNpmwrbvAFVThRUFqgpbVuqWisni9',
  ],
  registeredParentAddresses: ['3Awm3FNpmwrbvAFVThRUFqgpbVuqWisni9'],
  parentTags: ['Mined by SecPool'],
  parentOutputScripts: [
    'a9148ee90177614ecde53314fd67c46162f315852a0787',
    'a9146582f2551e2a47e1ae8b03fb666401ed7c4552ef87',
  ],
};

const POOLIN_AUXPOW_MINER = {
  definitionId: 11,
  databaseId: 15,
  name: 'Poolin',
  slug: 'poolin',
  link: 'https://www.poolin.com',
  height: 8388,
  blockHash: '1fac0b53ac229c0ef724e7c7492b9bd7767f135003bf464950efee1bc9a157ee',
  qbitCoinbaseRaw: '02c42000',
  qbitAddress: SHARED_AUXPOW_QBIT_ADDRESS,
  parentBlockHash: '000000000000000000011d0b6f044b679c768ff8c02a908110eac1bd7b642c9d',
  parentCoinbaseRaw:
    '032ba20e1a2f706f6f6c696e2e636f6d2f66702f393633e9018604fac86820fa' +
    'be6d6d423527ccd88267ad702dd7818ade466bc1b801d86f79e8ad3d25579fa' +
    '77fbfda100000000000000000009538d64f010000000000',
  parentAddresses: ['33TbzA5AMiTKUCmeVEdsnTj3GiVXuavCAH'],
  registeredParentAddresses: ['33TbzA5AMiTKUCmeVEdsnTj3GiVXuavCAH'],
  parentTags: ['/poolin.com/'],
  parentOutputScripts: ['a9141366dca425687186b9b54e27e4ed48163b5beb8087'],
};

const REDROCK_AUXPOW_MINER = {
  definitionId: 13,
  databaseId: 17,
  name: 'RedRock Pool',
  slug: 'redrockpool',
  link: 'https://redrock.pro/',
  height: 8770,
  blockHash: '8811335efc0fce401cb6483b65572444266515f911bda74aaf9b3b806c804e3f',
  qbitCoinbaseRaw: '02422200',
  qbitAddress: SHARED_AUXPOW_QBIT_ADDRESS,
  parentBlockHash: '00000000000000000003e4c7d2bfe8345e19782fd0e8d1e1c7c5b0e0f373a842',
  parentCoinbaseRaw:
    '035ca20e14526564526f636b20506f6f6ce9001f07a28340a8fabe6d6da9091' +
    'aa13ecfa2851d7139f461702c29bdefadb277a97634e88fdf72faa0ec1210000' +
    '0000000000000005aa8c098000000000000',
  parentAddresses: [
    '3F6LYG6o3iP42RrEGgSW4xiVu4i95qm7Ag',
    '3554kSaWNnP3B49Xyybert7gmxq2YSnfnx',
  ],
  registeredParentAddresses: ['3554kSaWNnP3B49Xyybert7gmxq2YSnfnx'],
  parentTags: ['RedRock'],
  parentOutputScripts: [
    'a9149302bdf47fb397e6539d208f4cc72751826a5dc087',
    'a9142513e32c3a27fab4fb7b37183350a36fe6fd585a87',
  ],
};

const CORNSWAP_MINER = {
  definitionId: 12,
  databaseId: 16,
  name: 'cornswap',
  slug: 'cornswap',
  link: 'https://cornswap.com',
  qbitAddress: 'qb1zskhyrmv4vnhha252y7vc9tp5vpenfelu4uxxjlqq8dnzrgy4atcskuvgv8',
  addressMatchMode: 'full_reward',
  preTagHeight: 390,
  preTagBlockHash: '00000000000000004154fd1cdd040105bb621bbdd4b0c2589735f5846303aed9',
  preTagCoinbaseRaw:
    '02860100040162586a04bf9246180c5e61586ab6030000000000000a636b706f6f6c172f716269742d6d696e696e672d626f6f7473747261702f',
  legacyHeight: 7697,
  legacyBlockHash: '000000000000000033747ccf5082fd8434ffb78cb276dd469034ba1a63ab0938',
  legacyCoinbaseRaw:
    '02111e00040bfb5e6a043ae73b220c41f45e6a0e137800000000010a636b706f6f6c0a2f436f726e537761702f',
  height: 8265,
  blockHash: '00000000000000005b53138d088360c18f5342ef3670373a973d7a3294bfa575',
  coinbaseRaw:
    '0249200004de705f6a04c917c80f0ca60b5f6a18000026000000030a636b706f6f6c11f09f8cbd20636f726e737761702e636f6d',
};

const HIMPOOL_MINER = {
  definitionId: 14,
  databaseId: 18,
  name: 'Himpool',
  slug: 'himpool',
  link: 'https://himpool.com/',
  qbitAddress: 'qb1z0sq5a2d9grg7hd4g8tagzsk8ylmn7jd0hwdaefxu7pu3runqsdgs70eant',
  height: 18307,
  blockHash: '000000000000000009606f0601274738864c4861837f260387acf6ba4edc3dc2',
  coinbaseRaw: '02834704f3b6686a00f000003a09004a03000000000748696d706f6f6c',
};

const F2POOL_QBIT_ADDRESS = 'qb1zpyh3ygrlnrdzk5nrz0wh9usmeex2tfanq89p5yyvqj3pj4tuzlgs4hc5uh';
const F2POOL_PARENT_MARKER_ADDRESS = '1K6KoYC69NnafWJ7YgtrpwJxBLiijWqwa6';
const F2POOL_PARENT_PAYOUT_ADDRESS = '1AfCc4F9c4VTYSE31PUe2kUEKs6ZxiDjxm';
const F2POOL_PARENT_OUTPUT_SCRIPTS = [
  '76a914c6740a12d0a7d556f89782bf5faf0e12cf25a63988ac',
  '76a91469f2a01f4ff9e6ac24df9062e9828753474b348088ac',
];
const F2POOL_AUXPOW_BLOCKS = [
  {
    height: 19624,
    blockHash: 'ed70c156473166409f63a3cd11bf31fc34361f7d23aeec0c7f00a3c3a160f671',
    qbitCoinbaseRaw: '02a84c0fe4b883e5bda9e7a59ee4bb99e9b1bc205b323032362d30372d32395431313a31373a33392e3332323935313436365a5d00',
    parentCoinbaseRaw:
      '0361a60e2cfabe6d6d3f56cb66cebf3fe30ae6df217f5a2c2f84dbaa8a3c28a' +
      '8b29f54a488ed70940710000000f09f909f092f4632506f6f6c2f6400000000' +
      '000000000000000000000000000000000000000000000000000000000000000500278d3cff',
  },
  {
    height: 19631,
    blockHash: '2486c5ae13cb375f1182fee2790546c00c99fb367b46cb632d609aa01299a317',
    qbitCoinbaseRaw: '02af4c0fe4b883e5bda9e7a59ee4bb99e9b1bc205b323032362d30372d32395431313a32333a32332e3438393139313832315a5d00',
    parentCoinbaseRaw:
      '0362a60e2cfabe6d6d38af11c87e7983b00858d58d83cd30e7519a477be3c9d' +
      'e55af05e5f9481b406e10000000f09f909f092f4632506f6f6c2f6600000000' +
      '000000000000000000000000000000000000000000000000000000000000000500926a0000',
  },
  {
    height: 19637,
    blockHash: '339ddd11ad57db9ecc35d4e13a1c71f51097cc6aca9df6471b5136e9788a8a78',
    qbitCoinbaseRaw: '02b54c0fe4b883e5bda9e7a59ee4bb99e9b1bc205b323032362d30372d32395431313a33333a35382e3233353330303838355a5d00',
    parentCoinbaseRaw:
      '0364a60e2cfabe6d6deceb180c22419f66aff4bc52ccdedb0ccdf278bff18b506' +
      '3ae011c7dfa246c2c10000000f09f909f092f4632506f6f6c2f650000000000' +
      '0000000000000000000000000000000000000000000000000000000000000500611c3d60',
  },
  {
    height: 19654,
    blockHash: '57250335ab5e0794d795c7caa27f309b6b32977a8514467620b465e86d228ce9',
    qbitCoinbaseRaw: '02c64c0fe4b883e5bda9e7a59ee4bb99e9b1bc205b323032362d30372d32395431313a34393a32342e3339333338353836335a5d00',
    parentCoinbaseRaw:
      '0366a60e2cfabe6d6d94d68f1c4a9a4dbb1dd3022b60d0fcb992fdc8037af262' +
      'f940f68eacc4dba68910000000f09f909f092f4632506f6f6c2f730000000000' +
      '000000000000000000000000000000000000000000000000000000000000050008da5800',
  },
  {
    height: 19670,
    blockHash: '090aa3c9203449f4332ab9529d6acd2a6e5438313afd8dea1e6313a489b5a74c',
    qbitCoinbaseRaw: '02d64c0fe4b883e5bda9e7a59ee4bb99e9b1bc205b323032362d30372d32395431323a30353a34362e3436383935303530375a5d00',
    parentCoinbaseRaw:
      '0367a60e2cfabe6d6d46d202972cebfbe7a493fb06f0896e0e29562137d9e9c78' +
      'b15b212c0dede227010000000f09f909f092f4632506f6f6c2f730000000000' +
      '00000000000000000000000000000000000000000000000000000000000005004e416f00',
  },
  {
    height: 19671,
    blockHash: '0dbfa623a1220fa9309b2af95eb4f2b0414c0474cfe7ce38f02764df66e96e98',
    qbitCoinbaseRaw: '02d74c0fe4b883e5bda9e7a59ee4bb99e9b1bc205b323032362d30372d32395431323a30363a35392e3330373533313335395a5d00',
    parentCoinbaseRaw:
      '0367a60e2cfabe6d6d057565349f0df8fe3fca6c6208198ec4d6a9830f9de8ac4' +
      'c4bb71d0448009b3e10000000f09f909f092f4632506f6f6c2f6b0000000000' +
      '000000000000000000000000000000000000000000000000000000000000050070000000',
  },
  {
    height: 19673,
    blockHash: 'c1da3b7da1e40a6f6a6843d1b2e5cb5347c95f710d0ace3d9c99d03cc8de24ee',
    qbitCoinbaseRaw: '02d94c0fe4b883e5bda9e7a59ee4bb99e9b1bc205b323032362d30372d32395431323a30393a31382e3737333235393437345a5d00',
    parentCoinbaseRaw:
      '0367a60e2cfabe6d6db24b0a9d93fa00c088f45739dc2a062687f2974cefff2f6' +
      'e28252b201c064e3c10000000f09f909f092f4632506f6f6c2f660000000000' +
      '00000000000000000000000000000000000000000000000000000000000005009cba0000',
  },
  {
    height: 19678,
    blockHash: '49d2e7a34500144c0d48e6ad3d4e14341ebdd42c25b17309cf6ea9587e24d149',
    qbitCoinbaseRaw: '02de4c0fe4b883e5bda9e7a59ee4bb99e9b1bc205b323032362d30372d32395431323a31353a33312e3530353531343736325a5d00',
    parentCoinbaseRaw:
      '0368a60e2cfabe6d6d7eef3cfc2673460ee524241a50316dd89814de82c5faf5c4' +
      'c7a34fc3769b285710000000f09f909f092f4632506f6f6c2f640000000000' +
      '0000000000000000000000000000000000000000000000000000000000000500878a3644',
  },
].map(block => ({
  ...block,
  definitionId: 15,
  databaseId: 19,
  name: 'F2Pool',
  slug: 'f2pool',
  link: 'https://www.f2pool.com',
  qbitAddress: F2POOL_QBIT_ADDRESS,
  parentAddresses: [F2POOL_PARENT_MARKER_ADDRESS, F2POOL_PARENT_PAYOUT_ADDRESS],
  registeredParentAddresses: [F2POOL_PARENT_PAYOUT_ADDRESS],
  parentTags: ['/F2Pool/', '🐟'],
  header: buildAuxPowHeader(block.parentCoinbaseRaw, F2POOL_PARENT_OUTPUT_SCRIPTS),
}));
const F2POOL_MINER = F2POOL_AUXPOW_BLOCKS[0];

const PRISM_SHARED_PAYOUT = {
  height: 854,
  blockHash: '000000000000000037276dd95bb9954fbb642e762fe7d1a4f8d046e0c05cccb7',
  coinbaseRaw: '0256032f505249534d20506f6f6c2f0000001d189ace69f3c13001',
  otherAddress: 'qb1z86n7h76d2aumdgmu9vslp87n40ptznwftywpswgky3x3huhqcezquuav77',
};

// The pool's coinbase tag is /Qbit Pool/; its earlier /PRISM Pool/ stays. Every
// coinbase the pool builds also pays its 2% fee to the pool-fee address, which
// matches its blocks under any tag, the /Qbit Pool by Satflow/ ones included.
const QBIT_POOL_FEE_ADDRESS = 'qb1z7635znpv0ffehup3aq7dddzf6yuvvzwddad7aye7l64430rvq69q4zmcdh';
const QBIT_POOL = {
  name: 'Qbit Pool',
  slug: 'qbitpool',
  link: 'https://qbit.org/pool',
  addresses: [QBIT_POOL_FEE_ADDRESS],
  tags: ['/Qbit Pool/', '/PRISM Pool/'],
  // testnet4 block 36256's coinbase layout with the new tag substituted
  newTagCoinbaseRaw: '03a08d002f5162697420506f6f6c2f0001e81146de000000000000',
  newTagBlockHash: '33'.repeat(32),
  // the same layout with the tag the pool used for ten blocks before /Qbit Pool/
  satflowTagCoinbaseRaw: '03a08d002f5162697420506f6f6c20627920536174666c6f772f0001e81146de000000000000',
};

const AUXPOW_PARENT_MINERS = [
  ...SHARED_AUXPOW_MINERS,
  {
    ...SECPOOL_AUXPOW_MINER,
    header: buildAuxPowHeader(
      SECPOOL_AUXPOW_MINER.parentCoinbaseRaw,
      SECPOOL_AUXPOW_MINER.parentOutputScripts
    ),
  },
  {
    ...POOLIN_AUXPOW_MINER,
    header: buildAuxPowHeader(
      POOLIN_AUXPOW_MINER.parentCoinbaseRaw,
      POOLIN_AUXPOW_MINER.parentOutputScripts
    ),
  },
  {
    ...REDROCK_AUXPOW_MINER,
    header: buildAuxPowHeader(
      REDROCK_AUXPOW_MINER.parentCoinbaseRaw,
      REDROCK_AUXPOW_MINER.parentOutputScripts
    ),
  },
];

describe('PoolsParser qbit empty pool set', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDbQuery.mockResolvedValue([[{ name: 'Unknown' }]]);
    mockGetUnknownPool.mockResolvedValue({ id: 0, uniqueId: 0, name: 'Unknown', slug: 'unknown' });
    mockMining.reindexHashrateRequested = false;
  });

  test('accepts an empty qbit pools object and clears stale pool definitions', async () => {
    poolsParser.setMiningPools({ pools: [] });

    await poolsParser.migratePoolsJson('qbit-empty-v1');

    expect(poolsParser.miningPools).toEqual([]);
    expect(mockReplacePoolsWithUnknown).toHaveBeenCalledWith(0, 'qbit-empty-v1');
    expect(mockMining.reindexHashrateRequested).toBe(true);
  });

  test('keeps upstream array pools compatible', () => {
    poolsParser.setMiningPools([
      {
        id: 1,
        name: 'Example Pool',
        link: 'https://example.com',
        tags: ['/Example/'],
        addresses: ['tq1example'],
      },
    ]);

    expect(poolsParser.miningPools).toEqual([
      {
        id: 1,
        name: 'Example Pool',
        link: 'https://example.com',
        regexes: ['/Example/'],
        addresses: ['tq1example'],
        addressMatchMode: 'any',
        parentRegexes: [],
        parentAddresses: [],
        slug: 'examplepool',
      },
    ]);
  });

  test('normalizes AuxPoW parent-chain identifiers', () => {
    poolsParser.setMiningPools([
      {
        id: 2,
        name: 'Parent Pool',
        link: 'https://parent.example',
        tags: [],
        addresses: [],
        parentTags: ['Parent Tech'],
        parentAddresses: ['1ParentBtcAddress'],
      },
    ]);

    expect(poolsParser.miningPools).toEqual([
      {
        id: 2,
        name: 'Parent Pool',
        link: 'https://parent.example',
        regexes: [],
        addresses: [],
        addressMatchMode: 'any',
        parentRegexes: ['Parent Tech'],
        parentAddresses: ['1ParentBtcAddress'],
        slug: 'parentpool',
      },
    ]);
  });
});

describe('PoolsParser qbit vendored pool definitions', () => {
  const deezyAddress = 'qb1zsgjp00kl4ghjkhsmernut7x5vpx4xsf0mf8eedjftdssf0hqneyqtcdeez';
  const loadVendoredPools = (): any =>
    JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../pools-qbit.json'), 'utf8'));

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('vendored pool definitions are well-formed', () => {
    const vendored = loadVendoredPools();

    expect(Array.isArray(vendored.pools)).toBe(true);
    const uniqueIds = new Set<number>();
    for (const pool of vendored.pools) {
      expect(typeof pool.id).toBe('number');
      expect(pool.id).not.toBe(0); // 0 is reserved for the Unknown pool
      expect(uniqueIds.has(pool.id)).toBe(false);
      uniqueIds.add(pool.id);
      expect(typeof pool.name).toBe('string');
      expect(typeof pool.link).toBe('string');
      expect(Array.isArray(pool.addresses)).toBe(true);
      expect(Array.isArray(pool.tags)).toBe(true);
      expect(['any', 'full_reward']).toContain(pool.addressMatchMode ?? 'any');
      const parentAddresses = pool.parentAddresses ?? [];
      const parentTags = pool.parentTags ?? [];
      expect(Array.isArray(parentAddresses)).toBe(true);
      expect(Array.isArray(parentTags)).toBe(true);
      expect(pool.addresses.length + pool.tags.length + parentAddresses.length + parentTags.length).toBeGreaterThan(0);
      for (const tag of [...pool.tags, ...parentTags]) {
        expect(() => new RegExp(tag, 'i')).not.toThrow();
      }
      for (const address of parentAddresses) {
        // parent-chain payout addresses are Bitcoin mainnet, never qbit
        expect(address).not.toMatch(/^(qb1|tq1|qbrt1|Q|S)/);
      }
    }
  });

  test('keeps attributing legacy /PRISM Pool/ coinbases such as testnet4 block 36256', () => {
    poolsParser.setMiningPools(loadVendoredPools());

    // coinbaseRaw of 0000000000001c1865d21ae41fa83d4b87934ea8af7e6460c2262efa2c3a759f,
    // which decodes to '\x03\xa0\x8d\x00/PRISM Pool/\x00\x01\xe8\x11F\xde...'
    const coinbaseRaw = '03a08d002f505249534d20506f6f6c2f0001e81146de000000000000';
    const match = poolsParser.matchBlockMiner(coinbaseRaw, [], poolsParser.miningPools);

    expect(match).toBeDefined();
    expect(match?.name).toBe(QBIT_POOL.name);
    expect(match?.slug).toBe(QBIT_POOL.slug);
  });

  test('matches the /Qbit Pool/ coinbase tag', () => {
    poolsParser.setMiningPools(loadVendoredPools());

    expect(Buffer.from(QBIT_POOL.newTagCoinbaseRaw, 'hex').toString('latin1')).toContain('/Qbit Pool/');
    const match = poolsParser.matchBlockMiner(QBIT_POOL.newTagCoinbaseRaw, [], poolsParser.miningPools);

    expect(match).toBeDefined();
    expect(match?.id).toBe(1);
    expect(match?.name).toBe(QBIT_POOL.name);
    expect(match?.slug).toBe(QBIT_POOL.slug);
    expect(match?.link).toBe(QBIT_POOL.link);
    expect(match?.regexes).toEqual(QBIT_POOL.tags);
  });

  test('matches a block under the earlier /Qbit Pool by Satflow/ tag by the pool-fee address', () => {
    poolsParser.setMiningPools(loadVendoredPools());

    expect(Buffer.from(QBIT_POOL.satflowTagCoinbaseRaw, 'hex').toString('latin1')).toContain('/Qbit Pool by Satflow/');
    // the tag is no longer in the definition: alone, it matches no pool
    expect(poolsParser.matchBlockMiner(QBIT_POOL.satflowTagCoinbaseRaw, [], poolsParser.miningPools)).toBeUndefined();
    // the coinbase's 2% fee output to the pool-fee address does
    const match = poolsParser.matchBlockMiner(QBIT_POOL.satflowTagCoinbaseRaw, [QBIT_POOL_FEE_ADDRESS], poolsParser.miningPools);

    expect(match?.id).toBe(1);
    expect(match?.slug).toBe(QBIT_POOL.slug);
  });

  test('matches an untagged coinbase that pays the pool-fee address', () => {
    poolsParser.setMiningPools(loadVendoredPools());

    const match = poolsParser.matchBlockMiner('', [QBIT_POOL_FEE_ADDRESS], poolsParser.miningPools);

    expect(match?.id).toBe(1);
    expect(match?.addresses).toEqual(QBIT_POOL.addresses);
  });

  test('matches Luxor from its qbit coinbase payout address', () => {
    poolsParser.setMiningPools(loadVendoredPools());

    const match = poolsParser.matchBlockMiner(
      '',
      ['qb1zn9wxf7450m2gv70j5jje2sl68r3qm38ksjpfuhlppra2k02su0hqkgq8x7'],
      poolsParser.miningPools
    );

    expect(match).toBeDefined();
    expect(match?.name).toBe('Luxor');
    expect(match?.slug).toBe('luxor');
  });

  test('matches deezy from its qbit coinbase payout address', () => {
    poolsParser.setMiningPools(loadVendoredPools());

    const match = poolsParser.matchBlockMiner('', [deezyAddress], poolsParser.miningPools);

    expect(match).toBeDefined();
    expect(match?.name).toBe('deezy');
    expect(match?.slug).toBe('deezy');
  });

  test('matches LuckyPool.IO from the coinbase scriptsig of qbit block 1526', () => {
    poolsParser.setMiningPools(loadVendoredPools());

    // coinbaseRaw of 0000000000000000019f24c27a0cef0567b8068f10251d86098365d3b414f066,
    // which decodes to '\x02\xf6\x05\x10\xe1\xbf]\xb4\x00.../LuckyPool-Qbit/'
    const coinbaseRaw = '02f60510e1bf5db4000000000000002f4c75636b79506f6f6c2d516269742f';
    const match = poolsParser.matchBlockMiner(coinbaseRaw, [], poolsParser.miningPools);

    expect(match).toBeDefined();
    expect(match?.name).toBe('LuckyPool.IO');
    expect(match?.slug).toBe('luckypoolio');
  });

  test('matches Himpool from the coinbase scriptsig of qbit block 18307', () => {
    poolsParser.setMiningPools(loadVendoredPools());

    // coinbaseRaw of 000000000000000009606f0601274738864c4861837f260387acf6ba4edc3dc2;
    // the terminal push decodes to the pool's stable `Himpool` marker.
    const match = poolsParser.matchBlockMiner(
      HIMPOOL_MINER.coinbaseRaw,
      [HIMPOOL_MINER.qbitAddress],
      poolsParser.miningPools
    );

    expect(match).toBeDefined();
    expect(match?.name).toBe(HIMPOOL_MINER.name);
    expect(match?.slug).toBe(HIMPOOL_MINER.slug);
  });

  test.each(F2POOL_AUXPOW_BLOCKS)(
    'matches F2Pool from the child and parent coinbase tags of qbit block $height',
    (miner) => {
      poolsParser.setMiningPools(loadVendoredPools());

      // The qbit scriptsig carries UTF-8 `七彩神仙鱼`; no payout-address
      // fallback is supplied here, so this assertion exercises tag decoding.
      const childMatch = poolsParser.matchBlockMiner(
        miner.qbitCoinbaseRaw,
        [],
        poolsParser.miningPools
      );
      expect(childMatch?.name).toBe(miner.name);
      expect(childMatch?.slug).toBe(miner.slug);

      const parentCoinbase = parseAuxPowParentCoinbase(miner.header);
      expect(parentCoinbase).toEqual(expect.objectContaining({
        scriptsig: miner.parentCoinbaseRaw,
        addresses: miner.parentAddresses,
      }));

      // Remove the identifying child evidence to prove the embedded `🐟` and
      // `/F2Pool/` parent fingerprints independently attribute the block.
      const parentMatch = poolsParser.matchBlockMiner(
        '02761000',
        [],
        poolsParser.miningPools,
        parentCoinbase
      );
      expect(parentMatch?.name).toBe(miner.name);
      expect(parentMatch?.slug).toBe(miner.slug);
    }
  );

  test('matches F2Pool from its qbit payout address', () => {
    poolsParser.setMiningPools(loadVendoredPools());

    const match = poolsParser.matchBlockMiner(
      '',
      [F2POOL_QBIT_ADDRESS],
      poolsParser.miningPools
    );

    expect(match?.name).toBe(F2POOL_MINER.name);
    expect(match?.slug).toBe(F2POOL_MINER.slug);
  });

  test.each([
    ['fish emoji', 'f09f909f'],
    ['name', '2f4632506f6f6c2f'],
  ])('matches F2Pool from its isolated parent %s tag', (_label, scriptsig) => {
    poolsParser.setMiningPools(loadVendoredPools());

    const match = poolsParser.matchBlockMiner('02761000', [], poolsParser.miningPools, {
      scriptsig,
      addresses: [],
      parentBlockHash: '00'.repeat(32),
    });

    expect(match?.name).toBe(F2POOL_MINER.name);
  });

  test('matches only F2Pool substantive parent payouts, not its 546-sat marker', () => {
    poolsParser.setMiningPools(loadVendoredPools());

    const payoutMatch = poolsParser.matchBlockMiner('02761000', [], poolsParser.miningPools, {
      scriptsig: '0361a60e',
      addresses: [F2POOL_PARENT_PAYOUT_ADDRESS],
      parentBlockHash: '00'.repeat(32),
    });
    const markerMatch = poolsParser.matchBlockMiner('02761000', [], poolsParser.miningPools, {
      scriptsig: '0361a60e',
      addresses: [F2POOL_PARENT_MARKER_ADDRESS],
      parentBlockHash: '00'.repeat(32),
    });

    expect(payoutMatch?.name).toBe(F2POOL_MINER.name);
    expect(markerMatch).toBeUndefined();
  });

  test.each([
    {
      height: CORNSWAP_MINER.legacyHeight,
      coinbaseRaw: CORNSWAP_MINER.legacyCoinbaseRaw,
    },
    {
      height: CORNSWAP_MINER.height,
      coinbaseRaw: CORNSWAP_MINER.coinbaseRaw,
    },
  ])('matches cornswap from the coinbase tag of qbit block $height', ({ coinbaseRaw }) => {
    poolsParser.setMiningPools(loadVendoredPools());

    const match = poolsParser.matchBlockMiner(coinbaseRaw, [], poolsParser.miningPools);

    expect(match).toBeDefined();
    expect(match?.name).toBe(CORNSWAP_MINER.name);
    expect(match?.slug).toBe(CORNSWAP_MINER.slug);
  });

  test('backfills a pre-tag cornswap block whose full reward pays the registered address', () => {
    poolsParser.setMiningPools(loadVendoredPools());

    const match = poolsParser.matchBlockMiner(
      CORNSWAP_MINER.preTagCoinbaseRaw,
      [CORNSWAP_MINER.qbitAddress],
      poolsParser.miningPools,
      null,
      [{ scriptpubkey_address: CORNSWAP_MINER.qbitAddress, value: 21_000_000_000 }]
    );

    expect(match?.name).toBe(CORNSWAP_MINER.name);
  });

  test('uses the sole stored coinbase recipient to backfill historical full rewards', () => {
    poolsParser.setMiningPools(loadVendoredPools());

    const match = poolsParser.matchBlockMiner(
      CORNSWAP_MINER.preTagCoinbaseRaw,
      [CORNSWAP_MINER.qbitAddress],
      poolsParser.miningPools
    );

    expect(match?.name).toBe(CORNSWAP_MINER.name);
  });

  test('does not infer a full reward when historical recipient data is missing', () => {
    poolsParser.setMiningPools(loadVendoredPools());

    const match = poolsParser.matchBlockMiner(
      CORNSWAP_MINER.preTagCoinbaseRaw,
      [],
      poolsParser.miningPools
    );

    expect(match).toBeUndefined();
  });

  test('does not identify cornswap from a partial coinbase payout', () => {
    poolsParser.setMiningPools(loadVendoredPools());

    const match = poolsParser.matchBlockMiner(
      '02761000',
      [CORNSWAP_MINER.qbitAddress, PRISM_SHARED_PAYOUT.otherAddress],
      poolsParser.miningPools,
      null,
      [
        { scriptpubkey_address: CORNSWAP_MINER.qbitAddress, value: 397_675_044 },
        { scriptpubkey_address: PRISM_SHARED_PAYOUT.otherAddress, value: 20_602_324_956 },
      ]
    );

    expect(match).toBeUndefined();
  });

  test('does not identify cornswap when another positive payout has no decoded address', () => {
    poolsParser.setMiningPools(loadVendoredPools());

    const match = poolsParser.matchBlockMiner(
      CORNSWAP_MINER.preTagCoinbaseRaw,
      [CORNSWAP_MINER.qbitAddress],
      poolsParser.miningPools,
      null,
      [
        { scriptpubkey_address: CORNSWAP_MINER.qbitAddress, value: 20_000_000_000 },
        { value: 1_000_000_000 },
      ]
    );

    expect(match).toBeUndefined();
  });

  test('ignores zero-value addressed outputs when checking a full reward', () => {
    poolsParser.setMiningPools(loadVendoredPools());

    const match = poolsParser.matchBlockMiner(
      CORNSWAP_MINER.preTagCoinbaseRaw,
      [CORNSWAP_MINER.qbitAddress, PRISM_SHARED_PAYOUT.otherAddress],
      poolsParser.miningPools,
      null,
      [
        { scriptpubkey_address: CORNSWAP_MINER.qbitAddress, value: 21_000_000_000 },
        { scriptpubkey_address: PRISM_SHARED_PAYOUT.otherAddress, value: 0 },
      ]
    );

    expect(match?.name).toBe(CORNSWAP_MINER.name);
  });

  test('keeps a Prism-tagged full payout attributed to Prism regardless of pool order', () => {
    poolsParser.setMiningPools(loadVendoredPools());
    const cornswap = poolsParser.miningPools.find(pool => pool.name === CORNSWAP_MINER.name);
    const prism = poolsParser.miningPools.find(pool => pool.slug === QBIT_POOL.slug);
    expect(prism.regexes).toContain('/PRISM Pool/');
    expect(Buffer.from(PRISM_SHARED_PAYOUT.coinbaseRaw, 'hex').toString('latin1')).toContain('/PRISM Pool/');

    const match = poolsParser.matchBlockMiner(
      PRISM_SHARED_PAYOUT.coinbaseRaw,
      [CORNSWAP_MINER.qbitAddress],
      [cornswap, prism],
      null,
      [{ scriptpubkey_address: CORNSWAP_MINER.qbitAddress, value: 21_000_000_000 }]
    );

    expect(match?.name).toBe(QBIT_POOL.name);
  });

  test('does not match an unrelated coinbase scriptsig', () => {
    poolsParser.setMiningPools(loadVendoredPools());

    // ascii payload 'some other miner'
    const coinbaseRaw = '0102736f6d65206f74686572206d696e6572';
    const match = poolsParser.matchBlockMiner(coinbaseRaw, [], poolsParser.miningPools);

    expect(match).toBeUndefined();
  });

  test('matches Luxor from the AuxPoW parent coinbase of qbit block 4214', () => {
    poolsParser.setMiningPools(loadVendoredPools());

    // qbit mainnet block 196368e129d102606180225fe67baee0ede4f82fc192e0f71f3305ac0c36a9bf
    // pays an unregistered qbit address and its qbit coinbase (02761000) has
    // no tag; only the embedded Bitcoin parent coinbase identifies the pool
    // via the `Powered by Luxor Tech-` tag and the 32BfKjh… payout address
    const parentCoinbase = parseAuxPowParentCoinbase(LUXOR_BLOCK_4214_HEADER);
    expect(parentCoinbase).not.toBeNull();

    const match = poolsParser.matchBlockMiner(
      '02761000',
      ['qb1zgxwrmumwzvyk0jawp708eat70dzdrhyz80q83vypp9r8cj7e9ucqlwfe8r'],
      poolsParser.miningPools,
      parentCoinbase
    );

    expect(match).toBeDefined();
    expect(match?.name).toBe('Luxor');
    expect(match?.slug).toBe('luxor');
  });

  test('matches Luxor from a parent payout address without a parent coinbase tag', () => {
    poolsParser.setMiningPools(loadVendoredPools());

    const match = poolsParser.matchBlockMiner('02761000', [], poolsParser.miningPools, {
      scriptsig: '036ea00e',
      addresses: ['32BfKjhByDSxx3BM5vUkQ3NQq9csZR6nt6'],
      parentBlockHash: '00'.repeat(32),
    });

    expect(match?.name).toBe('Luxor');
  });

  test.each(AUXPOW_PARENT_MINERS)(
    'matches $name only from the AuxPoW parent evidence of qbit block $height',
    (miner) => {
      poolsParser.setMiningPools(loadVendoredPools());

      // Template-provider qbit reward addresses are not pool-specific parent
      // evidence, so they remain unregistered and cannot identify a pool.
      expect(poolsParser.matchBlockMiner(
        miner.qbitCoinbaseRaw,
        [miner.qbitAddress],
        poolsParser.miningPools
      )).toBeUndefined();

      const parentCoinbase = parseAuxPowParentCoinbase(miner.header);
      expect(parentCoinbase).toEqual(expect.objectContaining({
        scriptsig: miner.parentCoinbaseRaw,
        addresses: miner.parentAddresses,
      }));

      const match = poolsParser.matchBlockMiner(
        miner.qbitCoinbaseRaw,
        [miner.qbitAddress],
        poolsParser.miningPools,
        parentCoinbase
      );

      expect(match).toBeDefined();
      expect(match?.name).toBe(miner.name);
      expect(match?.slug).toBe(miner.slug);
    }
  );

  test('prefers qbit-side identifiers over AuxPoW parent evidence', () => {
    poolsParser.setMiningPools(loadVendoredPools());

    // hypothetical qbit coinbase tagged by LuckyPool on work whose Bitcoin
    // template came from Luxor: the qbit-side tag must win
    const match = poolsParser.matchBlockMiner(
      '2f4c75636b79506f6f6c2d516269742f', // '/LuckyPool-Qbit/'
      [],
      poolsParser.miningPools,
      parseAuxPowParentCoinbase(LUXOR_BLOCK_4214_HEADER)
    );

    expect(match?.name).toBe('LuckyPool.IO');
  });

  test('does not match qbit-side identifiers against the parent coinbase', () => {
    poolsParser.setMiningPools(loadVendoredPools());

    // a parent coinbase carrying LuckyPool's qbit tag and Luxor's qbit payout
    // address must not attribute: parent evidence only matches parent fields
    const match = poolsParser.matchBlockMiner('02761000', [], poolsParser.miningPools, {
      scriptsig: '2f4c75636b79506f6f6c2d516269742f',
      addresses: ['qb1zn9wxf7450m2gv70j5jje2sl68r3qm38ksjpfuhlppra2k02su0hqkgq8x7'],
      parentBlockHash: '00'.repeat(32),
    });

    expect(match).toBeUndefined();
  });

  test('does not match parent identifiers against the qbit coinbase', () => {
    poolsParser.setMiningPools(loadVendoredPools());

    // 'Powered by Luxor Tech-' spoofed inside a qbit coinbase scriptsig; the
    // 'Luxor Tech' pattern only applies to AuxPoW parent coinbases
    const match = poolsParser.matchBlockMiner(
      '506f7765726564206279204c75786f7220546563682d',
      [],
      poolsParser.miningPools
    );

    expect(match).toBeUndefined();
  });
});

describe('PoolsParser qbit non-empty pool migration', () => {
  const prismBlockHash = '0000000000001c1865d21ae41fa83d4b87934ea8af7e6460c2262efa2c3a759f';
  const prismCoinbaseRaw = '03a08d002f505249534d20506f6f6c2f0001e81146de000000000000';
  const luxorAuxpowBlockHash = '196368e129d102606180225fe67baee0ede4f82fc192e0f71f3305ac0c36a9bf';
  const luxorParentAddresses = '["1MkCDCzHpBsYQivp8MxjY5AkTGG1f2baoe","39bitUyBcUu3y3hRTtYprKbTp712t4ZWqK","32BfKjhByDSxx3BM5vUkQ3NQq9csZR6nt6"]';
  const luxorParentRegexes = '["/LUXOR/","Luxor Tech"]';
  const deezyAddress = 'qb1zsgjp00kl4ghjkhsmernut7x5vpx4xsf0mf8eedjftdssf0hqneyqtcdeez';
  const deezyBlockHash = '000000000000000064f7f50834e7cce35218dfc45f492a741a20081de89d866c';
  const exactMixedPayoutHash = '11'.repeat(32);
  const exactZeroValueHash = '22'.repeat(32);
  const currentSatflowPool = {
    id: 5, uniqueId: 1, name: QBIT_POOL.name, slug: QBIT_POOL.slug, link: QBIT_POOL.link,
    addresses: JSON.stringify(QBIT_POOL.addresses), regexes: JSON.stringify(QBIT_POOL.tags),
  };
  const currentDeezyPool = {
    id: 8, uniqueId: 4, name: 'deezy', slug: 'deezy', link: 'https://deezy.io',
    addresses: `["${deezyAddress}"]`, regexes: '[]',
  };
  const currentCornswapPool = {
    id: CORNSWAP_MINER.databaseId,
    uniqueId: CORNSWAP_MINER.definitionId,
    name: CORNSWAP_MINER.name,
    slug: CORNSWAP_MINER.slug,
    link: CORNSWAP_MINER.link,
    addresses: `["${CORNSWAP_MINER.qbitAddress}"]`,
    regexes: '["cornswap"]',
    address_match_mode: CORNSWAP_MINER.addressMatchMode,
    addressMatchMode: CORNSWAP_MINER.addressMatchMode,
  };
  const currentHimpoolPool = {
    id: HIMPOOL_MINER.databaseId,
    uniqueId: HIMPOOL_MINER.definitionId,
    name: HIMPOOL_MINER.name,
    slug: HIMPOOL_MINER.slug,
    link: HIMPOOL_MINER.link,
    addresses: '[]',
    regexes: '["Himpool"]',
  };
  const currentF2poolPool = {
    id: F2POOL_MINER.databaseId,
    uniqueId: F2POOL_MINER.definitionId,
    name: F2POOL_MINER.name,
    slug: F2POOL_MINER.slug,
    link: F2POOL_MINER.link,
    addresses: JSON.stringify([F2POOL_MINER.qbitAddress]),
    regexes: '["七彩神仙鱼"]',
    parent_addresses: JSON.stringify(F2POOL_MINER.registeredParentAddresses),
    parent_regexes: JSON.stringify(F2POOL_MINER.parentTags),
  };
  const currentAuxpowPools = AUXPOW_PARENT_MINERS.map(miner => ({
    id: miner.databaseId,
    uniqueId: miner.definitionId,
    name: miner.name,
    slug: miner.slug,
    link: miner.link,
    addresses: '[]',
    regexes: '[]',
    parent_addresses: JSON.stringify(miner.registeredParentAddresses),
    parent_regexes: JSON.stringify(miner.parentTags),
  }));

  const loadVendoredPools = (): any =>
    JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../pools-qbit.json'), 'utf8'));

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUnknownPool.mockResolvedValue({ id: 0, uniqueId: 0, name: 'Unknown', slug: 'unknown' });
    mockGetPoolByUniqueId.mockResolvedValue(null);
    mockInsertNewMiningPool.mockResolvedValue(undefined);
    mockDeleteStalePools.mockResolvedValue(0);
    mockGetPools.mockResolvedValue([
      { ...currentSatflowPool, parentAddresses: null, parentRegexes: null },
      {
        id: 6, uniqueId: 2, name: 'Luxor', slug: 'luxor',
        addresses: '["qb1zn9wxf7450m2gv70j5jje2sl68r3qm38ksjpfuhlppra2k02su0hqkgq8x7"]', regexes: '[]',
        parentAddresses: luxorParentAddresses, parentRegexes: luxorParentRegexes,
      },
      currentDeezyPool,
      ...currentAuxpowPools.map(pool => ({
        ...pool,
        parentAddresses: pool.parent_addresses,
        parentRegexes: pool.parent_regexes,
      })),
      currentCornswapPool,
      currentHimpoolPool,
      {
        ...currentF2poolPool,
        parentAddresses: currentF2poolPool.parent_addresses,
        parentRegexes: currentF2poolPool.parent_regexes,
      },
    ]);
    mockMining.reindexHashrateRequested = false;
    mockDbQuery.mockImplementation(async (sql: any) => {
      const text = typeof sql === 'string' ? sql : sql.sql;
      if (text.includes('SELECT name from pools')) {
        return [[{ name: 'Unknown' }]];
      }
      if (text.includes('FROM blocks')) {
        return [[
          { height: 36256, hash: prismBlockHash, coinbase_raw: prismCoinbaseRaw, coinbase_addresses: null },
          // mined after the rebrand but indexed before this definition shipped
          { height: 36257, hash: QBIT_POOL.newTagBlockHash, coinbase_raw: QBIT_POOL.newTagCoinbaseRaw, coinbase_addresses: null },
          // ascii payload 'some other miner' — matches no definition
          { height: 100, hash: 'unmatched-block-hash', coinbase_raw: '0102736f6d65206f74686572206d696e6572', coinbase_addresses: null },
          // AuxPoW block paying an unregistered qbit address; only its stored
          // header's parent coinbase (Powered by Luxor Tech-, 32BfKjh…)
          // identifies the pool
          {
            height: 4214, hash: luxorAuxpowBlockHash, coinbase_raw: '02761000',
            coinbase_addresses: '["qb1zgxwrmumwzvyk0jawp708eat70dzdrhyz80q83vypp9r8cj7e9ucqlwfe8r"]',
            header: LUXOR_BLOCK_4214_HEADER,
          },
          // Permissionless qbit block 7107 pays its P2MR coinbase reward to
          // deezy's registered address.
          {
            height: 7107, hash: deezyBlockHash, coinbase_raw: '',
            coinbase_addresses: `["${deezyAddress}"]`,
          },
          // The reported payout address is shared with bootstrap and Prism
          // coinbases; the operator's domain tag identifies this block.
          {
            height: CORNSWAP_MINER.height,
            hash: CORNSWAP_MINER.blockHash,
            coinbase_raw: CORNSWAP_MINER.coinbaseRaw,
            coinbase_addresses: `["${CORNSWAP_MINER.qbitAddress}"]`,
          },
          // Before Cornswap added its domain tag, the full bootstrap coinbase
          // reward went to the same operator-reported address.
          {
            height: CORNSWAP_MINER.preTagHeight,
            hash: CORNSWAP_MINER.preTagBlockHash,
            coinbase_raw: CORNSWAP_MINER.preTagCoinbaseRaw,
            coinbase_addresses: `["${CORNSWAP_MINER.qbitAddress}"]`,
          },
          // Exact evidence from the lazy indexer must override the lossy sole
          // address list on every later pool-definition migration.
          {
            height: CORNSWAP_MINER.preTagHeight + 1,
            hash: exactMixedPayoutHash,
            coinbase_raw: CORNSWAP_MINER.preTagCoinbaseRaw,
            coinbase_addresses: `["${CORNSWAP_MINER.qbitAddress}"]`,
            coinbase_payouts: JSON.stringify([
              { scriptpubkey_address: CORNSWAP_MINER.qbitAddress, value: 20_000_000_000 },
              { value: 1_000_000_000 },
            ]),
          },
          // Conversely, a zero-value foreign address is not a payout. The
          // exact positive-output list preserves the full-reward decision.
          {
            height: CORNSWAP_MINER.preTagHeight + 2,
            hash: exactZeroValueHash,
            coinbase_raw: CORNSWAP_MINER.preTagCoinbaseRaw,
            coinbase_addresses: `["${CORNSWAP_MINER.qbitAddress}","${PRISM_SHARED_PAYOUT.otherAddress}"]`,
            coinbase_payouts: JSON.stringify([
              { scriptpubkey_address: CORNSWAP_MINER.qbitAddress, value: 21_000_000_000 },
            ]),
          },
          // Prism only pays a split of its coinbase to the shared address.
          {
            height: PRISM_SHARED_PAYOUT.height,
            hash: PRISM_SHARED_PAYOUT.blockHash,
            coinbase_raw: PRISM_SHARED_PAYOUT.coinbaseRaw,
            coinbase_addresses: `["${PRISM_SHARED_PAYOUT.otherAddress}","${CORNSWAP_MINER.qbitAddress}"]`,
          },
          // These AuxPoW blocks have no identifying qbit-side evidence. Their
          // parent coinbase tags and substantive Bitcoin payouts identify the
          // individual parent template pools.
          ...AUXPOW_PARENT_MINERS.map(miner => ({
            height: miner.height,
            hash: miner.blockHash,
            coinbase_raw: miner.qbitCoinbaseRaw,
            coinbase_addresses: `["${miner.qbitAddress}"]`,
            header: miner.header,
          })),
          // F2Pool carries independent identifying tags on both chains plus a
          // stable qbit payout, so the definition import must backfill it too.
          {
            height: F2POOL_MINER.height,
            hash: F2POOL_MINER.blockHash,
            coinbase_raw: F2POOL_MINER.qbitCoinbaseRaw,
            coinbase_addresses: `["${F2POOL_MINER.qbitAddress}"]`,
            header: F2POOL_MINER.header,
          },
        ]];
      }
      return [[], []];
    });
  });

  test('imports the vendored definitions and re-attributes matching Unknown blocks from genesis', async () => {
    poolsParser.setMiningPools(loadVendoredPools());

    await poolsParser.migratePoolsJson('qbit-testsha');

    expect(mockReplacePoolsWithUnknown).not.toHaveBeenCalled();
    expect(mockInsertNewMiningPool).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, name: QBIT_POOL.name, regexes: QBIT_POOL.tags }),
      QBIT_POOL.slug
    );
    expect(mockInsertNewMiningPool).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 2,
        name: 'Luxor',
        addresses: ['qb1zn9wxf7450m2gv70j5jje2sl68r3qm38ksjpfuhlppra2k02su0hqkgq8x7'],
        parentAddresses: JSON.parse(luxorParentAddresses),
        parentRegexes: JSON.parse(luxorParentRegexes),
      }),
      'luxor'
    );
    expect(mockInsertNewMiningPool).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 3,
        name: 'LuckyPool.IO',
        regexes: ['/LuckyPool-Qbit/'],
      }),
      'luckypoolio'
    );
    expect(mockInsertNewMiningPool).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 4,
        name: 'deezy',
        addresses: [deezyAddress],
      }),
      'deezy'
    );
    expect(mockInsertNewMiningPool).toHaveBeenCalledWith(
      expect.objectContaining({
        id: CORNSWAP_MINER.definitionId,
        name: CORNSWAP_MINER.name,
        addresses: [CORNSWAP_MINER.qbitAddress],
        addressMatchMode: CORNSWAP_MINER.addressMatchMode,
        regexes: ['cornswap'],
      }),
      CORNSWAP_MINER.slug
    );
    expect(mockInsertNewMiningPool).toHaveBeenCalledWith(
      expect.objectContaining({
        id: HIMPOOL_MINER.definitionId,
        name: HIMPOOL_MINER.name,
        addresses: [],
        regexes: ['Himpool'],
      }),
      HIMPOOL_MINER.slug
    );
    expect(mockInsertNewMiningPool).toHaveBeenCalledWith(
      expect.objectContaining({
        id: F2POOL_MINER.definitionId,
        name: F2POOL_MINER.name,
        addresses: [F2POOL_MINER.qbitAddress],
        regexes: ['七彩神仙鱼'],
        parentAddresses: F2POOL_MINER.registeredParentAddresses,
        parentRegexes: F2POOL_MINER.parentTags,
      }),
      F2POOL_MINER.slug
    );
    for (const miner of AUXPOW_PARENT_MINERS) {
      expect(mockInsertNewMiningPool).toHaveBeenCalledWith(
        expect.objectContaining({
          id: miner.definitionId,
          name: miner.name,
          addresses: [],
          parentAddresses: miner.registeredParentAddresses,
          parentRegexes: miner.parentTags,
        }),
        miner.slug
      );
    }
    // stale pools purged, keeping Unknown (0) and the vendored ids
    expect(mockDeleteStalePools).toHaveBeenCalledWith([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], 0, 'qbit-testsha');
    // Unknown blocks re-matched from height 0, not the Bitcoin heights
    expect(mockDbQuery).toHaveBeenCalledWith(expect.stringContaining('FROM blocks'), [0, 0]);
    // both the legacy /PRISM Pool/ block and a /Qbit Pool/ block
    // get re-attributed to the renamed pool
    expect(mockSavePool).toHaveBeenCalledWith(prismBlockHash, 5);
    expect(mockSavePool).toHaveBeenCalledWith(QBIT_POOL.newTagBlockHash, 5);
    // the AuxPoW block gets re-attributed to Luxor via its parent coinbase
    expect(mockSavePool).toHaveBeenCalledWith(luxorAuxpowBlockHash, 6);
    // the deezy payout address re-attributes its previously Unknown block
    expect(mockSavePool).toHaveBeenCalledWith(deezyBlockHash, 8);
    // the Cornswap tag takes precedence over its shared payout address
    expect(mockSavePool).toHaveBeenCalledWith(CORNSWAP_MINER.blockHash, CORNSWAP_MINER.databaseId);
    // the sole-recipient full-reward rule backfills the operator-confirmed block
    expect(mockSavePool).toHaveBeenCalledWith(CORNSWAP_MINER.preTagBlockHash, CORNSWAP_MINER.databaseId);
    // exact negative evidence cannot be replaced by the historical singleton fallback
    expect(mockSavePool).not.toHaveBeenCalledWith(exactMixedPayoutHash, CORNSWAP_MINER.databaseId);
    // exact payouts ignore an addressed zero-value output on future rematches
    expect(mockSavePool).toHaveBeenCalledWith(exactZeroValueHash, CORNSWAP_MINER.databaseId);
    // Prism's explicit tag wins and its split payout is never claimed by Cornswap
    expect(mockSavePool).toHaveBeenCalledWith(PRISM_SHARED_PAYOUT.blockHash, 5);
    // each AuxPoW parent template gets its own pool from parent-chain evidence
    for (const miner of AUXPOW_PARENT_MINERS) {
      expect(mockSavePool).toHaveBeenCalledWith(miner.blockHash, miner.databaseId);
    }
    // F2Pool's UTF-8 qbit tag backfills its previously Unknown block
    expect(mockSavePool).toHaveBeenCalledWith(F2POOL_MINER.blockHash, F2POOL_MINER.databaseId);
    // the unmatched block stays on Unknown without a per-block update...
    expect(mockSavePool).not.toHaveBeenCalledWith('unmatched-block-hash', 0);
    // ...because all blocks get the new definition hash stamped in bulk
    expect(mockUpdateDefinitionHash).toHaveBeenCalledWith('qbit-testsha');
    expect(mockMining.reindexHashrateRequested).toBe(true);
  });

  test('refreshes the cached tip blocks after a definition change', async () => {
    poolsParser.setMiningPools(loadVendoredPools());

    await poolsParser.migratePoolsJson('qbit-testsha');

    // pool insertions changed attributions, so the tip cache (and its
    // disk/redis copies) must be re-synced from the reindexed rows
    expect(mockRefreshCachedBlocks).toHaveBeenCalledTimes(1);
  });

  test('propagates pool insert failures so the import can roll back', async () => {
    mockInsertNewMiningPool.mockRejectedValue(new Error('insert failed'));
    poolsParser.setMiningPools(loadVendoredPools());

    await expect(poolsParser.migratePoolsJson('qbit-testsha')).rejects.toThrow('insert failed');
    expect(mockSavePool).not.toHaveBeenCalled();
  });

  test('excludes skipped definitions from the stale-purge keep list', async () => {
    const vendored = loadVendoredPools();
    // a broken definition with no addresses and no tags is skipped by the
    // migration, so it must not shield a stale DB row with the same unique_id
    vendored.pools.push({ id: 99, name: 'Broken Pool', link: 'https://broken.example', addresses: [], tags: [] });
    poolsParser.setMiningPools(vendored);

    await poolsParser.migratePoolsJson('qbit-testsha');

    expect(mockInsertNewMiningPool).toHaveBeenCalledTimes(15);
    expect(mockDeleteStalePools).toHaveBeenCalledWith([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], 0, 'qbit-testsha');
  });

  test('re-indexes Unknown blocks even when pool definitions are already current', async () => {
    // recovery scenario: a previous partial import committed the pool row but
    // died before re-indexing, so the retry sees no definition changes
    mockGetPoolByUniqueId.mockImplementation(async (id: number) => {
      if (id === 1) {
        return currentSatflowPool;
      }
      if (id === 2) {
        return {
          id: 6, uniqueId: 2, name: 'Luxor', slug: 'luxor',
          link: 'https://mining.luxor.tech',
          addresses: '["qb1zn9wxf7450m2gv70j5jje2sl68r3qm38ksjpfuhlppra2k02su0hqkgq8x7"]',
          regexes: '[]',
          parent_addresses: luxorParentAddresses,
          parent_regexes: luxorParentRegexes,
        };
      }
      if (id === 3) {
        return {
          id: 7, uniqueId: 3, name: 'LuckyPool.IO', slug: 'luckypoolio',
          link: 'https://qbit.luckypool.io/', addresses: '[]', regexes: '["/LuckyPool-Qbit/"]',
        };
      }
      if (id === 4) {
        return currentDeezyPool;
      }
      if (id === CORNSWAP_MINER.definitionId) {
        return currentCornswapPool;
      }
      if (id === HIMPOOL_MINER.definitionId) {
        return currentHimpoolPool;
      }
      if (id === F2POOL_MINER.definitionId) {
        return currentF2poolPool;
      }
      return currentAuxpowPools.find(pool => pool.uniqueId === id) ?? null;
    });
    poolsParser.setMiningPools(loadVendoredPools());

    await poolsParser.migratePoolsJson('qbit-testsha');

    expect(mockInsertNewMiningPool).not.toHaveBeenCalled();
    expect(mockRenameMiningPool).not.toHaveBeenCalled();
    expect(mockUpdateMiningPoolTags).not.toHaveBeenCalled();
    // the Unknown re-index still runs and picks up the missed block
    expect(mockSavePool).toHaveBeenCalledWith(prismBlockHash, 5);
  });

  test('renames the Prism Pool row in place and re-attributes new-tag Unknown blocks', async () => {
    // Database as deployed before the rebrand: unique_id 1 is 'Prism Pool'
    // matching only /PRISM Pool/. Every other pool is already current.
    const legacyPrismRow = {
      id: 5, uniqueId: 1, name: 'Prism Pool', slug: 'prismpool',
      link: 'https://www.prismpool.io/', addresses: '[]', regexes: '["/PRISM Pool/"]',
    };
    mockGetPoolByUniqueId.mockImplementation(async (id: number) => {
      if (id === 1) {
        return legacyPrismRow;
      }
      if (id === 2) {
        return {
          id: 6, uniqueId: 2, name: 'Luxor', slug: 'luxor',
          link: 'https://mining.luxor.tech',
          addresses: '["qb1zn9wxf7450m2gv70j5jje2sl68r3qm38ksjpfuhlppra2k02su0hqkgq8x7"]',
          regexes: '[]',
          parent_addresses: luxorParentAddresses,
          parent_regexes: luxorParentRegexes,
        };
      }
      if (id === 3) {
        return {
          id: 7, uniqueId: 3, name: 'LuckyPool.IO', slug: 'luckypoolio',
          link: 'https://qbit.luckypool.io/', addresses: '[]', regexes: '["/LuckyPool-Qbit/"]',
        };
      }
      if (id === 4) {
        return currentDeezyPool;
      }
      if (id === CORNSWAP_MINER.definitionId) {
        return currentCornswapPool;
      }
      if (id === HIMPOOL_MINER.definitionId) {
        return currentHimpoolPool;
      }
      if (id === F2POOL_MINER.definitionId) {
        return currentF2poolPool;
      }
      return currentAuxpowPools.find(pool => pool.uniqueId === id) ?? null;
    });
    // Rows indexed by pool: the pool's own legacy block, and a block mined
    // with the new tag before this definition shipped, still on Unknown.
    mockDbQuery.mockImplementation(async (sql: any, params?: any[]) => {
      const text = typeof sql === 'string' ? sql : sql.sql;
      if (text.includes('SELECT name from pools')) {
        return [[{ name: 'Unknown' }]];
      }
      if (text.includes('FROM blocks')) {
        if (params?.[0] === 5) {
          return [[{ height: 36256, hash: prismBlockHash, coinbase_raw: prismCoinbaseRaw, coinbase_addresses: null }]];
        }
        if (params?.[0] === 0) {
          return [[
            { height: 36257, hash: QBIT_POOL.newTagBlockHash, coinbase_raw: QBIT_POOL.newTagCoinbaseRaw, coinbase_addresses: null },
            { height: 100, hash: 'unmatched-block-hash', coinbase_raw: '0102736f6d65206f74686572206d696e6572', coinbase_addresses: null },
          ]];
        }
      }
      return [[], []];
    });
    poolsParser.setMiningPools(loadVendoredPools());

    await poolsParser.migratePoolsJson('qbit-testsha');

    // same database row, renamed in place under the new slug: its block and
    // hashrate history stay with it
    expect(mockInsertNewMiningPool).not.toHaveBeenCalled();
    expect(mockRenameMiningPool).toHaveBeenCalledTimes(1);
    expect(mockRenameMiningPool).toHaveBeenCalledWith(5, QBIT_POOL.slug, QBIT_POOL.name);
    expect(mockUpdateMiningPoolLink).toHaveBeenCalledWith(5, QBIT_POOL.link);
    expect(mockUpdateMiningPoolTags).toHaveBeenCalledTimes(1);
    expect(mockUpdateMiningPoolTags).toHaveBeenCalledWith(5, QBIT_POOL.addresses, QBIT_POOL.tags, [], [], 'any');
    expect(mockDeleteStalePools).toHaveBeenCalledWith([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], 0, 'qbit-testsha');
    // the tag change re-indexes the pool's own blocks, then Unknown is re-matched
    expect(mockDbQuery).toHaveBeenCalledWith(expect.stringContaining('FROM blocks'), [5, 0]);
    expect(mockDbQuery).toHaveBeenCalledWith(expect.stringContaining('FROM blocks'), [0, 0]);
    // the legacy block still matches /PRISM Pool/ and is left in place
    expect(mockSavePool).not.toHaveBeenCalledWith(prismBlockHash, expect.anything());
    // the Unknown block carrying /Qbit Pool/ moves to the pool
    expect(mockSavePool).toHaveBeenCalledWith(QBIT_POOL.newTagBlockHash, 5);
    expect(mockSavePool).toHaveBeenCalledTimes(1);
    expect(mockUpdateDefinitionHash).toHaveBeenCalledWith('qbit-testsha');
    expect(mockRefreshCachedBlocks).toHaveBeenCalled();
    expect(mockMining.reindexHashrateRequested).toBe(true);
  });

  test('detects parent-identifier additions against NULL pre-migration columns', async () => {
    // upgraded database: the Luxor row predates the parent-chain columns, so
    // they are NULL while pools-qbit.json now carries the Bitcoin identifiers
    mockGetPoolByUniqueId.mockImplementation(async (id: number) => {
      if (id === 1) {
        return currentSatflowPool;
      }
      if (id === 2) {
        return {
          id: 6, uniqueId: 2, name: 'Luxor', slug: 'luxor',
          link: 'https://mining.luxor.tech',
          addresses: '["qb1zn9wxf7450m2gv70j5jje2sl68r3qm38ksjpfuhlppra2k02su0hqkgq8x7"]',
          regexes: '[]',
          parent_addresses: null,
          parent_regexes: null,
        };
      }
      if (id === 3) {
        return {
          id: 7, uniqueId: 3, name: 'LuckyPool.IO', slug: 'luckypoolio',
          link: 'https://qbit.luckypool.io/', addresses: '[]', regexes: '["/LuckyPool-Qbit/"]',
        };
      }
      if (id === 4) {
        return currentDeezyPool;
      }
      if (id === CORNSWAP_MINER.definitionId) {
        return currentCornswapPool;
      }
      return currentAuxpowPools.find(pool => pool.uniqueId === id) ?? null;
    });
    poolsParser.setMiningPools(loadVendoredPools());

    await poolsParser.migratePoolsJson('qbit-testsha');

    expect(mockUpdateMiningPoolTags).toHaveBeenCalledTimes(1);
    expect(mockUpdateMiningPoolTags).toHaveBeenCalledWith(
      6,
      ['qb1zn9wxf7450m2gv70j5jje2sl68r3qm38ksjpfuhlppra2k02su0hqkgq8x7'],
      [],
      JSON.parse(luxorParentAddresses),
      JSON.parse(luxorParentRegexes),
      'any'
    );
    // the retagged pool's blocks and the Unknown pool's blocks are re-indexed
    expect(mockSavePool).toHaveBeenCalledWith(luxorAuxpowBlockHash, 6);
  });

  test('detects address-only deletions against the raw stored value', async () => {
    // same tags as the vendored entry, but the DB row still has a payout
    // address that has been removed from pools-qbit.json
    mockGetPoolByUniqueId.mockImplementation(async (id: number) => {
      if (id === 1) {
        return { ...currentSatflowPool, addresses: '["tq1stale"]' };
      }
      if (id === 2) {
        return {
          id: 6, uniqueId: 2, name: 'Luxor', slug: 'luxor',
          link: 'https://mining.luxor.tech',
          addresses: '["qb1zn9wxf7450m2gv70j5jje2sl68r3qm38ksjpfuhlppra2k02su0hqkgq8x7"]',
          regexes: '[]',
          parent_addresses: luxorParentAddresses,
          parent_regexes: luxorParentRegexes,
        };
      }
      if (id === 3) {
        return {
          id: 7, uniqueId: 3, name: 'LuckyPool.IO', slug: 'luckypoolio',
          link: 'https://qbit.luckypool.io/', addresses: '[]', regexes: '["/LuckyPool-Qbit/"]',
        };
      }
      if (id === 4) {
        return currentDeezyPool;
      }
      if (id === CORNSWAP_MINER.definitionId) {
        return currentCornswapPool;
      }
      return currentAuxpowPools.find(pool => pool.uniqueId === id) ?? null;
    });
    poolsParser.setMiningPools(loadVendoredPools());

    await poolsParser.migratePoolsJson('qbit-testsha');

    expect(mockUpdateMiningPoolTags).toHaveBeenCalledWith(5, QBIT_POOL.addresses, QBIT_POOL.tags, [], [], 'any');
  });

  test('detects a full-reward address match mode change', async () => {
    mockGetPoolByUniqueId.mockImplementation(async (id: number) => {
      if (id === CORNSWAP_MINER.definitionId) {
        return {
          ...currentCornswapPool,
          address_match_mode: 'any',
          addressMatchMode: undefined,
        };
      }
      return null;
    });
    poolsParser.setMiningPools(loadVendoredPools());

    await poolsParser.migratePoolsJson('qbit-testsha');

    expect(mockUpdateMiningPoolTags).toHaveBeenCalledWith(
      CORNSWAP_MINER.databaseId,
      [CORNSWAP_MINER.qbitAddress],
      ['cornswap'],
      [],
      [],
      CORNSWAP_MINER.addressMatchMode
    );
  });

  test('reassigns non-matching blocks to Unknown when a colliding legacy pool row is retagged', async () => {
    // upgraded database: a legacy Bitcoin pool row already occupies unique_id 1
    mockGetPoolByUniqueId.mockImplementation(async (id: number) => id === 1 ? {
      id: 7, uniqueId: 1, name: 'Legacy Bitcoin Pool', slug: 'legacybitcoinpool',
      link: 'https://legacy.example', addresses: '[]', regexes: '["/ViaBTC/"]',
    } : null);
    mockDbQuery.mockImplementation(async (sql: any) => {
      const text = typeof sql === 'string' ? sql : sql.sql;
      if (text.includes('SELECT name from pools')) {
        return [[{ name: 'Unknown' }]];
      }
      if (text.includes('FROM blocks')) {
        // legacy block whose coinbase matches no current definition
        return [[{ height: 100, hash: 'legacy-block-hash', coinbase_raw: '0102736f6d65206f74686572206d696e6572', coinbase_addresses: null }]];
      }
      return [[], []];
    });
    poolsParser.setMiningPools(loadVendoredPools());

    await poolsParser.migratePoolsJson('qbit-testsha');

    // Prism is renamed/retagged instead of inserted; all other definitions
    // are inserted, and the non-matching legacy block falls back to Unknown.
    expect(mockInsertNewMiningPool).toHaveBeenCalledTimes(14);
    expect(mockInsertNewMiningPool).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2, name: 'Luxor' }),
      'luxor'
    );
    expect(mockInsertNewMiningPool).toHaveBeenCalledWith(
      expect.objectContaining({ id: 3, name: 'LuckyPool.IO' }),
      'luckypoolio'
    );
    expect(mockInsertNewMiningPool).toHaveBeenCalledWith(
      expect.objectContaining({ id: 4, name: 'deezy', addresses: [deezyAddress] }),
      'deezy'
    );
    expect(mockInsertNewMiningPool).toHaveBeenCalledWith(
      expect.objectContaining({
        id: CORNSWAP_MINER.definitionId,
        name: CORNSWAP_MINER.name,
        addresses: [CORNSWAP_MINER.qbitAddress],
        addressMatchMode: CORNSWAP_MINER.addressMatchMode,
        regexes: ['cornswap'],
      }),
      CORNSWAP_MINER.slug
    );
    for (const miner of AUXPOW_PARENT_MINERS) {
      expect(mockInsertNewMiningPool).toHaveBeenCalledWith(
        expect.objectContaining({
          id: miner.definitionId,
          name: miner.name,
          parentAddresses: miner.registeredParentAddresses,
        }),
        miner.slug
      );
    }
    expect(mockSavePool).toHaveBeenCalledWith('legacy-block-hash', 0);
  });
});
