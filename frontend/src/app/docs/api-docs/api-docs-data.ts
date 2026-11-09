const bitcoinNetworks = ['', 'testnet', 'testnet4', 'signet'];
const liquidNetworks: string[] = [];
const miningTimeIntervals = '<code>24h</code>, <code>3d</code>, <code>1w</code>, <code>1m</code>, <code>3m</code>, <code>6m</code>, <code>1y</code>, <code>2y</code>, <code>3y</code>';

const emptyCodeSample = {
  esModule: [],
  commonJS: [],
  curl: [],
  response: ``
};

const showJsExamplesDefault = { '': true, 'testnet': true, 'signet': true, 'liquid': true, 'liquidtestnet': false };
const showJsExamplesDefaultFalse = { '': false, 'testnet': false, 'signet': false, 'liquid': false, 'liquidtestnet': false };

export const wsApiDocsData = [
  {
    type: 'category',
    category: 'general',
    fragment: 'general',
    title: 'General',
    showConditions: bitcoinNetworks.concat(liquidNetworks)
  },
  {
    type: 'endpoint',
    category: 'general',
    fragment: 'live-data',
    title: 'Live Data',
    description: {
      default: 'Subscribe to live data. Available: <code>blocks</code>, <code>mempool-block</code>, <code>live-2h-chart</code>, and <code>stats</code>.'
    },
    payload: '{ "action": "want", "data": ["mempool-blocks", "stats"] }',
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: false,
    codeExample: {
      default: {
        codeTemplate: {
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "mempool-blocks": [
    {
      "blockSize": 1801614,
      "blockVSize": 997936.5,
      "nTx": 3391,
      "totalFees": 8170664,
      "medianFee": 6.011217160720601,
      "feeRange": [
        4.584615384615384,
        5,
        5.100456621004566,
        6.002319288751449,
        7.235398230088496,
        10.377668308702791,
        200
      ]
    },
    ...
    {
      "blockSize": 198543075,
      "blockVSize": 101691348,
      "nTx": 249402,
      "totalFees": 135312667,
      "medianFee": 1.2559438783834156,
      "feeRange": [
        1.000685629033809,
        1.0020213063577312,
        1.0019080827758888,
        1.0227913345013278,
        1.1188648002395873,
        1.2559438783834156,
        1.4077952614964329,
        1.4079805737077244,
        1.5106880342499638,
        2.003440424869914,
        2.2713888268854894
      ]
    }
  ],
  "mempoolInfo": {
    "loaded": true,
    "size": 264505,
    "bytes": 108875402,
    "usage": 649908688,
    "total_fee": 1.61036575,
    "maxmempool": 300000000,
    "mempoolminfee": 0.00001858,
    "minrelaytxfee": 0.00001,
    "incrementalrelayfee": 0.00001,
    "unbroadcastcount": 0,
    "fullrbf": true
  },
  "vBytesPerSecond": 1651,
  "fees": {
    "fastestFee": 7,
    "halfHourFee": 6,
    "hourFee": 5,
    "economyFee": 4,
    "minimumFee": 2
  },
  "da": {
    "progressPercent": 32.49007936507937,
    "difficultyChange": 0.7843046881601534,
    "estimatedRetargetDate": 1735514828279,
    "remainingBlocks": 1361,
    "remainingTime": 811481279,
    "previousRetarget": 4.429396745461176,
    "previousTime": 1734312810,
    "nextRetargetHeight": 876960,
    "timeAvg": 596239,
    "adjustedTimeAvg": 596239,
    "timeOffset": 0,
    "expectedBlocks": 650.895
  }
}`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "mempool-blocks": [
    {
      "blockSize": 1009960,
      "blockVSize": 997827.25,
      "nTx": 3545,
      "totalFees": 2844117938,
      "medianFee": 2524.178404298769,
      "feeRange": [
        2010.9044259140476,
        2011.0887096774193,
        2011.2914608327453,
        2441.5893066980025,
        3541.35960591133,
        3936.6254416961133,
        6031.746031746032
      ]
    },
    ...
  ],
  "mempoolInfo": {
    "loaded": true,
    "size": 517666,
    "bytes": 168219654,
    "usage": 855583264,
    "total_fee": 133.53837564,
    "maxmempool": 4096000000,
    "mempoolminfee": 0.00001,
    "minrelaytxfee": 0.00001,
    "incrementalrelayfee": 0.00001,
    "unbroadcastcount": 0,
    "fullrbf": true
  },
  "vBytesPerSecond": 358,
  "fees": {
    "fastestFee": 2525,
    "halfHourFee": 2268,
    "hourFee": 2082,
    "economyFee": 2,
    "minimumFee": 1
  },
  "da": {
    "progressPercent": 45.882936507936506,
    "difficultyChange": -51.21445794134847,
    "estimatedRetargetDate": 1736046916382,
    "remainingBlocks": 1091,
    "remainingTime": 1343241382,
    "previousRetarget": 255.61790932023905,
    "previousTime": 1733564813,
    "nextRetargetHeight": 3538080,
    "timeAvg": 1200000,
    "adjustedTimeAvg": 1231202,
    "timeOffset": 0,
    "expectedBlocks": 1898.1033333333332
  }
}`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{"mempool-blocks": [
    {
      "blockSize": 1009960,
      "blockVSize": 997827.25,
      "nTx": 3545,
      "totalFees": 2844117938,
      "medianFee": 2524.178404298769,
      "feeRange": [
        2010.9044259140476,
        2011.0887096774193,
        2011.2914608327453,
        2441.5893066980025,
        3541.35960591133,
        3936.6254416961133,
        6031.746031746032
      ]
    },
    ...
  ],
  "mempoolInfo": {
    "loaded": true,
    "size": 59,
    "bytes": 9834,
    "usage": 68832,
    "total_fee": 0.00013935,
    "maxmempool": 4096000000,
    "mempoolminfee": 0.00001,
    "minrelaytxfee": 0.00001,
    "incrementalrelayfee": 0.00001,
    "unbroadcastcount": 0,
    "fullrbf": true
  },
  "vBytesPerSecond": 28,
  "da": {
    "progressPercent": 68.60119047619048,
    "difficultyChange": -2.913529439274176,
    "estimatedRetargetDate": 1735095294116,
    "remainingBlocks": 633,
    "remainingTime": 391480116,
    "previousRetarget": 2.0685719720386118,
    "previousTime": 1733848494,
    "nextRetargetHeight": 227808,
    "timeAvg": 618452,
    "adjustedTimeAvg": 618452,
    "timeOffset": 0,
    "expectedBlocks": 1425.5333333333333
  },
  "fees": {
    "fastestFee": 1,
    "halfHourFee": 1,
    "hourFee": 1,
    "economyFee": 1,
    "minimumFee": 1
  },
}`
        },
        codeSampleLiquid: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "mempool-blocks": [
    {
      "blockSize": 27409,
      "blockVSize": 7675,
      "nTx": 2,
      "totalFees": 769,
      "medianFee": 0,
      "feeRange": [
        0.10012450036039577,
        0.10012450036039577,
        0.10012450036039577,
        0.10012450036039577,
        0.10012450036039577,
        0.10012450036039577,
        0.10012450036039577
      ]
    }
  ],
  "mempoolInfo": {
    "loaded": true,
    "size": 2,
    "bytes": 7676,
    "usage": 3568,
    "total_fee": 0.00000769,
    "maxmempool": 300000000,
    "mempoolminfee": 0.000001,
    "minrelaytxfee": 0.000001,
    "unbroadcastcount": 0
  },
  "vBytesPerSecond": 60,
  "fees": {
    "fastestFee": 0.1,
    "halfHourFee": 0.1,
    "hourFee": 0.1,
    "economyFee": 0.1,
    "minimumFee": 0.1
  },
  "da": {
    "progressPercent": 4.315476190476191,
    "difficultyChange": null,
    "estimatedRetargetDate": null,
    "remainingBlocks": 1929,
    "remainingTime": null,
    "previousRetarget": null,
    "previousTime": 1734698648,
    "nextRetargetHeight": 3173184,
    "timeAvg": 60448,
    "adjustedTimeAvg": null,
    "timeOffset": 0,
    "expectedBlocks": 8.765
  }
}`
        }
      }
    }
  },
  {
    type: 'category',
    category: 'addresses',
    fragment: 'addresses',
    title: 'Addresses',
    showConditions: bitcoinNetworks.concat(liquidNetworks)
  },
  {
    type: 'endpoint',
    category: 'addresses',
    fragment: 'track-address',
    title: 'Track Address',
    description: {
      default: 'Subscribe to a single address to receive live updates on new transactions having that address in input or output. <code>address-transactions</code> field contains new mempool transactions, and <code>block-transactions</code> contains new confirmed transactions.'
    },
    payload: '{ "track-address": "qb1zjrtrlj26qhlr0qze7x9fszx0aa8k268d48n3gmc097zjugk87qrsq9l22h" }',
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: false,
    codeExample: {
      default: {
        codeTemplate: {
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "block-transactions": [
    {
      "txid": "9d3ea0d131c45450c135d549b62032019bc47a80368e14edc72caf38f5a88033",
      "version": 1,
      "locktime": 0,
      "vin": [
        {
          "txid": "69da555a9c69788a3a081958457894e56b1ee6766bc72cecf881b1b4f327f78b",
          "vout": 0,
          "prevout": {
            "scriptpubkey": "a914c9848245ae4f5d5934b5cbdfb79e04cdd337470b87",
            "scriptpubkey_asm": "OP_HASH160 OP_PUSHBYTES_20 c9848245ae4f5d5934b5cbdfb79e04cdd337470b OP_EQUAL",
            "scriptpubkey_type": "p2sh",
            "scriptpubkey_address": "3L4YUynB4X44rJBY9CmiLMN8Wjti49JCYB",
            "value": 24962957
          },
          "scriptsig": "0048304502210099219ee0cd5da341650078e3c63885b3cc2211069f2551cf436e0100f421e1760220349b4ec284255b458d6da539fa17314e8330459e0a653c254f775d4ec8f32b3f0147304402203a8353c5ee76a2e266432e5f993f882e05725297e64c0833cf44719f7dda8d3b022058a2f72e7739efd21657b4943cac60a0a3c749e712787f0e85726da4c3adcf8e014c695221027f2a0df8e86535d08ca3e766a178f90c813d2dd1d55b0166e82518efbffb18c02103556a35844b517e2fc8216701e2e0a64dbcbe62ad420ac6dd73dc79e69efeb69521031ef21bd55171032b7aec21ec82932735fb986f1d4d8611feee62ab38acf4a6bb53ae",
          "scriptsig_asm": "OP_0 OP_PUSHBYTES_72 304502210099219ee0cd5da341650078e3c63885b3cc2211069f2551cf436e0100f421e1760220349b4ec284255b458d6da539fa17314e8330459e0a653c254f775d4ec8f32b3f01 OP_PUSHBYTES_71 304402203a8353c5ee76a2e266432e5f993f882e05725297e64c0833cf44719f7dda8d3b022058a2f72e7739efd21657b4943cac60a0a3c749e712787f0e85726da4c3adcf8e01 OP_PUSHDATA1 5221027f2a0df8e86535d08ca3e766a178f90c813d2dd1d55b0166e82518efbffb18c02103556a35844b517e2fc8216701e2e0a64dbcbe62ad420ac6dd73dc79e69efeb69521031ef21bd55171032b7aec21ec82932735fb986f1d4d8611feee62ab38acf4a6bb53ae",
          "is_coinbase": false,
          "sequence": 4294967295,
          "inner_redeemscript_asm": "OP_PUSHNUM_2 OP_PUSHBYTES_33 027f2a0df8e86535d08ca3e766a178f90c813d2dd1d55b0166e82518efbffb18c0 OP_PUSHBYTES_33 03556a35844b517e2fc8216701e2e0a64dbcbe62ad420ac6dd73dc79e69efeb695 OP_PUSHBYTES_33 031ef21bd55171032b7aec21ec82932735fb986f1d4d8611feee62ab38acf4a6bb OP_PUSHNUM_3 OP_CHECKMULTISIG"
        },
        ...
        {
          "txid": "43852d32c7ae6d362d446d090daa4d389f78ec77e6693f9248cd924dc0b1ecc3",
          "vout": 1,
          "prevout": {
            "scriptpubkey": "a914a3aff5f5765f167c1582fd85517ddde83174118187",
            "scriptpubkey_asm": "OP_HASH160 OP_PUSHBYTES_20 a3aff5f5765f167c1582fd85517ddde831741181 OP_EQUAL",
            "scriptpubkey_type": "p2sh",
            "scriptpubkey_address": "3GcWrnGFoNzbn1KaiP5czS5xPELdWcgDX2",
            "value": 1719827
          },
          "scriptsig": "0047304402205f83d22a0476158aa0986682c96ce2b2dab26c814968dba62905cdfeef1b3ac7022059438a3439bb18bd49242010c8a276ea6f1810d523042e679fa6679d60e89e0201483045022100eb085df09e0fb4894090a5f39b9f2188392f7ac2847ed8255629baffc7371f170220120463b91d6c4bb8968fb3eda9012b88d13d8ca71de28e7a64b1dd88282ff144014c69522103650083cbc9cd1da1224e0780bce1ee8abd5150c5252defd0edeccd3521610b282102510ab30a6a97464ef0d61f71ec8b1d2325f12934ff15ba73579bfd0ac5f4fc1a2102985b3be77f56a9a29c5f68d3c893d6c4d76ec8c07792f0291d375c29b71ee2f853ae",
          "scriptsig_asm": "OP_0 OP_PUSHBYTES_71 304402205f83d22a0476158aa0986682c96ce2b2dab26c814968dba62905cdfeef1b3ac7022059438a3439bb18bd49242010c8a276ea6f1810d523042e679fa6679d60e89e0201 OP_PUSHBYTES_72 3045022100eb085df09e0fb4894090a5f39b9f2188392f7ac2847ed8255629baffc7371f170220120463b91d6c4bb8968fb3eda9012b88d13d8ca71de28e7a64b1dd88282ff14401 OP_PUSHDATA1 522103650083cbc9cd1da1224e0780bce1ee8abd5150c5252defd0edeccd3521610b282102510ab30a6a97464ef0d61f71ec8b1d2325f12934ff15ba73579bfd0ac5f4fc1a2102985b3be77f56a9a29c5f68d3c893d6c4d76ec8c07792f0291d375c29b71ee2f853ae",
          "is_coinbase": false,
          "sequence": 4294967295,
          "inner_redeemscript_asm": "OP_PUSHNUM_2 OP_PUSHBYTES_33 03650083cbc9cd1da1224e0780bce1ee8abd5150c5252defd0edeccd3521610b28 OP_PUSHBYTES_33 02510ab30a6a97464ef0d61f71ec8b1d2325f12934ff15ba73579bfd0ac5f4fc1a OP_PUSHBYTES_33 02985b3be77f56a9a29c5f68d3c893d6c4d76ec8c07792f0291d375c29b71ee2f8 OP_PUSHNUM_3 OP_CHECKMULTISIG"
        }
      ],
      "vout": [
        {
          "scriptpubkey": "0014292fce548b228cd3df6334dd525fac62e7eb5f7a",
          "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_20 292fce548b228cd3df6334dd525fac62e7eb5f7a",
          "scriptpubkey_type": "v0_p2wpkh",
          "scriptpubkey_address": "bc1q9yhuu4yty2xd8hmrxnw4yhavvtn7khm62uw38p",
          "value": 57000
        },
        ...
        {
          "scriptpubkey": "0020e5c7c00d174631d2d1e365d6347b016fb87b6a0c08902d8e443989cb771fa7ec",
          "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_32 e5c7c00d174631d2d1e365d6347b016fb87b6a0c08902d8e443989cb771fa7ec",
          "scriptpubkey_type": "v0_p2wsh",
          "scriptpubkey_address": "bc1quhruqrghgcca950rvhtrg7cpd7u8k6svpzgzmrjy8xyukacl5lkq0r8l2d",
          "value": 17343523
        }
      ],
      "size": 5514,
      "weight": 22056,
      "sigops": 208,
      "fee": 44000,
      "status": {
        "confirmed": true,
        "block_height": 875602,
        "block_hash": "000000000000000000016c0639b6c1a34d6659c231aa2de5849ab3377ed75020",
        "block_time": 1734704791
      },
      "order": 864069877,
      "vsize": 5514,
      "adjustedVsize": 5514,
      "feePerVsize": 7.979688066739209,
      "adjustedFeePerVsize": 7.979688066739209,
      "effectiveFeePerVsize": 7.979688066739209,
      "firstSeen": 1734704590,
      "inputs": [],
      "cpfpDirty": false,
      "ancestors": [],
      "descendants": [],
      "bestDescendant": null,
      "position": {
        "block": 0,
        "vsize": 191567
      },
      "flags": 1099511659526
    }
  ]
}`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "block-transactions": [
    {
      "txid": "9d3ea0d131c45450c135d549b62032019bc47a80368e14edc72caf38f5a88033",
      "version": 1,
      "locktime": 0,
      "vin": [
        {
          "txid": "69da555a9c69788a3a081958457894e56b1ee6766bc72cecf881b1b4f327f78b",
          "vout": 0,
          "prevout": {
            "scriptpubkey": "a914c9848245ae4f5d5934b5cbdfb79e04cdd337470b87",
            "scriptpubkey_asm": "OP_HASH160 OP_PUSHBYTES_20 c9848245ae4f5d5934b5cbdfb79e04cdd337470b OP_EQUAL",
            "scriptpubkey_type": "p2sh",
            "scriptpubkey_address": "3L4YUynB4X44rJBY9CmiLMN8Wjti49JCYB",
            "value": 24962957
          },
          "scriptsig": "0048304502210099219ee0cd5da341650078e3c63885b3cc2211069f2551cf436e0100f421e1760220349b4ec284255b458d6da539fa17314e8330459e0a653c254f775d4ec8f32b3f0147304402203a8353c5ee76a2e266432e5f993f882e05725297e64c0833cf44719f7dda8d3b022058a2f72e7739efd21657b4943cac60a0a3c749e712787f0e85726da4c3adcf8e014c695221027f2a0df8e86535d08ca3e766a178f90c813d2dd1d55b0166e82518efbffb18c02103556a35844b517e2fc8216701e2e0a64dbcbe62ad420ac6dd73dc79e69efeb69521031ef21bd55171032b7aec21ec82932735fb986f1d4d8611feee62ab38acf4a6bb53ae",
          "scriptsig_asm": "OP_0 OP_PUSHBYTES_72 304502210099219ee0cd5da341650078e3c63885b3cc2211069f2551cf436e0100f421e1760220349b4ec284255b458d6da539fa17314e8330459e0a653c254f775d4ec8f32b3f01 OP_PUSHBYTES_71 304402203a8353c5ee76a2e266432e5f993f882e05725297e64c0833cf44719f7dda8d3b022058a2f72e7739efd21657b4943cac60a0a3c749e712787f0e85726da4c3adcf8e01 OP_PUSHDATA1 5221027f2a0df8e86535d08ca3e766a178f90c813d2dd1d55b0166e82518efbffb18c02103556a35844b517e2fc8216701e2e0a64dbcbe62ad420ac6dd73dc79e69efeb69521031ef21bd55171032b7aec21ec82932735fb986f1d4d8611feee62ab38acf4a6bb53ae",
          "is_coinbase": false,
          "sequence": 4294967295,
          "inner_redeemscript_asm": "OP_PUSHNUM_2 OP_PUSHBYTES_33 027f2a0df8e86535d08ca3e766a178f90c813d2dd1d55b0166e82518efbffb18c0 OP_PUSHBYTES_33 03556a35844b517e2fc8216701e2e0a64dbcbe62ad420ac6dd73dc79e69efeb695 OP_PUSHBYTES_33 031ef21bd55171032b7aec21ec82932735fb986f1d4d8611feee62ab38acf4a6bb OP_PUSHNUM_3 OP_CHECKMULTISIG"
        },
        ...
        {
          "txid": "43852d32c7ae6d362d446d090daa4d389f78ec77e6693f9248cd924dc0b1ecc3",
          "vout": 1,
          "prevout": {
            "scriptpubkey": "a914a3aff5f5765f167c1582fd85517ddde83174118187",
            "scriptpubkey_asm": "OP_HASH160 OP_PUSHBYTES_20 a3aff5f5765f167c1582fd85517ddde831741181 OP_EQUAL",
            "scriptpubkey_type": "p2sh",
            "scriptpubkey_address": "3GcWrnGFoNzbn1KaiP5czS5xPELdWcgDX2",
            "value": 1719827
          },
          "scriptsig": "0047304402205f83d22a0476158aa0986682c96ce2b2dab26c814968dba62905cdfeef1b3ac7022059438a3439bb18bd49242010c8a276ea6f1810d523042e679fa6679d60e89e0201483045022100eb085df09e0fb4894090a5f39b9f2188392f7ac2847ed8255629baffc7371f170220120463b91d6c4bb8968fb3eda9012b88d13d8ca71de28e7a64b1dd88282ff144014c69522103650083cbc9cd1da1224e0780bce1ee8abd5150c5252defd0edeccd3521610b282102510ab30a6a97464ef0d61f71ec8b1d2325f12934ff15ba73579bfd0ac5f4fc1a2102985b3be77f56a9a29c5f68d3c893d6c4d76ec8c07792f0291d375c29b71ee2f853ae",
          "scriptsig_asm": "OP_0 OP_PUSHBYTES_71 304402205f83d22a0476158aa0986682c96ce2b2dab26c814968dba62905cdfeef1b3ac7022059438a3439bb18bd49242010c8a276ea6f1810d523042e679fa6679d60e89e0201 OP_PUSHBYTES_72 3045022100eb085df09e0fb4894090a5f39b9f2188392f7ac2847ed8255629baffc7371f170220120463b91d6c4bb8968fb3eda9012b88d13d8ca71de28e7a64b1dd88282ff14401 OP_PUSHDATA1 522103650083cbc9cd1da1224e0780bce1ee8abd5150c5252defd0edeccd3521610b282102510ab30a6a97464ef0d61f71ec8b1d2325f12934ff15ba73579bfd0ac5f4fc1a2102985b3be77f56a9a29c5f68d3c893d6c4d76ec8c07792f0291d375c29b71ee2f853ae",
          "is_coinbase": false,
          "sequence": 4294967295,
          "inner_redeemscript_asm": "OP_PUSHNUM_2 OP_PUSHBYTES_33 03650083cbc9cd1da1224e0780bce1ee8abd5150c5252defd0edeccd3521610b28 OP_PUSHBYTES_33 02510ab30a6a97464ef0d61f71ec8b1d2325f12934ff15ba73579bfd0ac5f4fc1a OP_PUSHBYTES_33 02985b3be77f56a9a29c5f68d3c893d6c4d76ec8c07792f0291d375c29b71ee2f8 OP_PUSHNUM_3 OP_CHECKMULTISIG"
        }
      ],
      "vout": [
        {
          "scriptpubkey": "0014292fce548b228cd3df6334dd525fac62e7eb5f7a",
          "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_20 292fce548b228cd3df6334dd525fac62e7eb5f7a",
          "scriptpubkey_type": "v0_p2wpkh",
          "scriptpubkey_address": "bc1q9yhuu4yty2xd8hmrxnw4yhavvtn7khm62uw38p",
          "value": 57000
        },
        ...
        {
          "scriptpubkey": "0020e5c7c00d174631d2d1e365d6347b016fb87b6a0c08902d8e443989cb771fa7ec",
          "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_32 e5c7c00d174631d2d1e365d6347b016fb87b6a0c08902d8e443989cb771fa7ec",
          "scriptpubkey_type": "v0_p2wsh",
          "scriptpubkey_address": "bc1quhruqrghgcca950rvhtrg7cpd7u8k6svpzgzmrjy8xyukacl5lkq0r8l2d",
          "value": 17343523
        }
      ],
      "size": 5514,
      "weight": 22056,
      "sigops": 208,
      "fee": 44000,
      "status": {
        "confirmed": true,
        "block_height": 875602,
        "block_hash": "000000000000000000016c0639b6c1a34d6659c231aa2de5849ab3377ed75020",
        "block_time": 1734704791
      },
      "order": 864069877,
      "vsize": 5514,
      "adjustedVsize": 5514,
      "feePerVsize": 7.979688066739209,
      "adjustedFeePerVsize": 7.979688066739209,
      "effectiveFeePerVsize": 7.979688066739209,
      "firstSeen": 1734704590,
      "inputs": [],
      "cpfpDirty": false,
      "ancestors": [],
      "descendants": [],
      "bestDescendant": null,
      "position": {
        "block": 0,
        "vsize": 191567
      },
      "flags": 1099511659526
    }
  ]
}`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "block-transactions": [
    {
      "txid": "9d3ea0d131c45450c135d549b62032019bc47a80368e14edc72caf38f5a88033",
      "version": 1,
      "locktime": 0,
      "vin": [
        {
          "txid": "69da555a9c69788a3a081958457894e56b1ee6766bc72cecf881b1b4f327f78b",
          "vout": 0,
          "prevout": {
            "scriptpubkey": "a914c9848245ae4f5d5934b5cbdfb79e04cdd337470b87",
            "scriptpubkey_asm": "OP_HASH160 OP_PUSHBYTES_20 c9848245ae4f5d5934b5cbdfb79e04cdd337470b OP_EQUAL",
            "scriptpubkey_type": "p2sh",
            "scriptpubkey_address": "3L4YUynB4X44rJBY9CmiLMN8Wjti49JCYB",
            "value": 24962957
          },
          "scriptsig": "0048304502210099219ee0cd5da341650078e3c63885b3cc2211069f2551cf436e0100f421e1760220349b4ec284255b458d6da539fa17314e8330459e0a653c254f775d4ec8f32b3f0147304402203a8353c5ee76a2e266432e5f993f882e05725297e64c0833cf44719f7dda8d3b022058a2f72e7739efd21657b4943cac60a0a3c749e712787f0e85726da4c3adcf8e014c695221027f2a0df8e86535d08ca3e766a178f90c813d2dd1d55b0166e82518efbffb18c02103556a35844b517e2fc8216701e2e0a64dbcbe62ad420ac6dd73dc79e69efeb69521031ef21bd55171032b7aec21ec82932735fb986f1d4d8611feee62ab38acf4a6bb53ae",
          "scriptsig_asm": "OP_0 OP_PUSHBYTES_72 304502210099219ee0cd5da341650078e3c63885b3cc2211069f2551cf436e0100f421e1760220349b4ec284255b458d6da539fa17314e8330459e0a653c254f775d4ec8f32b3f01 OP_PUSHBYTES_71 304402203a8353c5ee76a2e266432e5f993f882e05725297e64c0833cf44719f7dda8d3b022058a2f72e7739efd21657b4943cac60a0a3c749e712787f0e85726da4c3adcf8e01 OP_PUSHDATA1 5221027f2a0df8e86535d08ca3e766a178f90c813d2dd1d55b0166e82518efbffb18c02103556a35844b517e2fc8216701e2e0a64dbcbe62ad420ac6dd73dc79e69efeb69521031ef21bd55171032b7aec21ec82932735fb986f1d4d8611feee62ab38acf4a6bb53ae",
          "is_coinbase": false,
          "sequence": 4294967295,
          "inner_redeemscript_asm": "OP_PUSHNUM_2 OP_PUSHBYTES_33 027f2a0df8e86535d08ca3e766a178f90c813d2dd1d55b0166e82518efbffb18c0 OP_PUSHBYTES_33 03556a35844b517e2fc8216701e2e0a64dbcbe62ad420ac6dd73dc79e69efeb695 OP_PUSHBYTES_33 031ef21bd55171032b7aec21ec82932735fb986f1d4d8611feee62ab38acf4a6bb OP_PUSHNUM_3 OP_CHECKMULTISIG"
        },
        ...
        {
          "txid": "43852d32c7ae6d362d446d090daa4d389f78ec77e6693f9248cd924dc0b1ecc3",
          "vout": 1,
          "prevout": {
            "scriptpubkey": "a914a3aff5f5765f167c1582fd85517ddde83174118187",
            "scriptpubkey_asm": "OP_HASH160 OP_PUSHBYTES_20 a3aff5f5765f167c1582fd85517ddde831741181 OP_EQUAL",
            "scriptpubkey_type": "p2sh",
            "scriptpubkey_address": "3GcWrnGFoNzbn1KaiP5czS5xPELdWcgDX2",
            "value": 1719827
          },
          "scriptsig": "0047304402205f83d22a0476158aa0986682c96ce2b2dab26c814968dba62905cdfeef1b3ac7022059438a3439bb18bd49242010c8a276ea6f1810d523042e679fa6679d60e89e0201483045022100eb085df09e0fb4894090a5f39b9f2188392f7ac2847ed8255629baffc7371f170220120463b91d6c4bb8968fb3eda9012b88d13d8ca71de28e7a64b1dd88282ff144014c69522103650083cbc9cd1da1224e0780bce1ee8abd5150c5252defd0edeccd3521610b282102510ab30a6a97464ef0d61f71ec8b1d2325f12934ff15ba73579bfd0ac5f4fc1a2102985b3be77f56a9a29c5f68d3c893d6c4d76ec8c07792f0291d375c29b71ee2f853ae",
          "scriptsig_asm": "OP_0 OP_PUSHBYTES_71 304402205f83d22a0476158aa0986682c96ce2b2dab26c814968dba62905cdfeef1b3ac7022059438a3439bb18bd49242010c8a276ea6f1810d523042e679fa6679d60e89e0201 OP_PUSHBYTES_72 3045022100eb085df09e0fb4894090a5f39b9f2188392f7ac2847ed8255629baffc7371f170220120463b91d6c4bb8968fb3eda9012b88d13d8ca71de28e7a64b1dd88282ff14401 OP_PUSHDATA1 522103650083cbc9cd1da1224e0780bce1ee8abd5150c5252defd0edeccd3521610b282102510ab30a6a97464ef0d61f71ec8b1d2325f12934ff15ba73579bfd0ac5f4fc1a2102985b3be77f56a9a29c5f68d3c893d6c4d76ec8c07792f0291d375c29b71ee2f853ae",
          "is_coinbase": false,
          "sequence": 4294967295,
          "inner_redeemscript_asm": "OP_PUSHNUM_2 OP_PUSHBYTES_33 03650083cbc9cd1da1224e0780bce1ee8abd5150c5252defd0edeccd3521610b28 OP_PUSHBYTES_33 02510ab30a6a97464ef0d61f71ec8b1d2325f12934ff15ba73579bfd0ac5f4fc1a OP_PUSHBYTES_33 02985b3be77f56a9a29c5f68d3c893d6c4d76ec8c07792f0291d375c29b71ee2f8 OP_PUSHNUM_3 OP_CHECKMULTISIG"
        }
      ],
      "vout": [
        {
          "scriptpubkey": "0014292fce548b228cd3df6334dd525fac62e7eb5f7a",
          "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_20 292fce548b228cd3df6334dd525fac62e7eb5f7a",
          "scriptpubkey_type": "v0_p2wpkh",
          "scriptpubkey_address": "bc1q9yhuu4yty2xd8hmrxnw4yhavvtn7khm62uw38p",
          "value": 57000
        },
        ...
        {
          "scriptpubkey": "0020e5c7c00d174631d2d1e365d6347b016fb87b6a0c08902d8e443989cb771fa7ec",
          "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_32 e5c7c00d174631d2d1e365d6347b016fb87b6a0c08902d8e443989cb771fa7ec",
          "scriptpubkey_type": "v0_p2wsh",
          "scriptpubkey_address": "bc1quhruqrghgcca950rvhtrg7cpd7u8k6svpzgzmrjy8xyukacl5lkq0r8l2d",
          "value": 17343523
        }
      ],
      "size": 5514,
      "weight": 22056,
      "sigops": 208,
      "fee": 44000,
      "status": {
        "confirmed": true,
        "block_height": 875602,
        "block_hash": "000000000000000000016c0639b6c1a34d6659c231aa2de5849ab3377ed75020",
        "block_time": 1734704791
      },
      "order": 864069877,
      "vsize": 5514,
      "adjustedVsize": 5514,
      "feePerVsize": 7.979688066739209,
      "adjustedFeePerVsize": 7.979688066739209,
      "effectiveFeePerVsize": 7.979688066739209,
      "firstSeen": 1734704590,
      "inputs": [],
      "cpfpDirty": false,
      "ancestors": [],
      "descendants": [],
      "bestDescendant": null,
      "position": {
        "block": 0,
        "vsize": 191567
      },
      "flags": 1099511659526
    }
  ]
}`
        },
        codeSampleLiquid: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "block-transactions": [
    {
      "txid": "9d3ea0d131c45450c135d549b62032019bc47a80368e14edc72caf38f5a88033",
      "version": 1,
      "locktime": 0,
      "vin": [
        {
          "txid": "69da555a9c69788a3a081958457894e56b1ee6766bc72cecf881b1b4f327f78b",
          "vout": 0,
          "prevout": {
            "scriptpubkey": "a914c9848245ae4f5d5934b5cbdfb79e04cdd337470b87",
            "scriptpubkey_asm": "OP_HASH160 OP_PUSHBYTES_20 c9848245ae4f5d5934b5cbdfb79e04cdd337470b OP_EQUAL",
            "scriptpubkey_type": "p2sh",
            "scriptpubkey_address": "3L4YUynB4X44rJBY9CmiLMN8Wjti49JCYB",
            "value": 24962957
          },
          "scriptsig": "0048304502210099219ee0cd5da341650078e3c63885b3cc2211069f2551cf436e0100f421e1760220349b4ec284255b458d6da539fa17314e8330459e0a653c254f775d4ec8f32b3f0147304402203a8353c5ee76a2e266432e5f993f882e05725297e64c0833cf44719f7dda8d3b022058a2f72e7739efd21657b4943cac60a0a3c749e712787f0e85726da4c3adcf8e014c695221027f2a0df8e86535d08ca3e766a178f90c813d2dd1d55b0166e82518efbffb18c02103556a35844b517e2fc8216701e2e0a64dbcbe62ad420ac6dd73dc79e69efeb69521031ef21bd55171032b7aec21ec82932735fb986f1d4d8611feee62ab38acf4a6bb53ae",
          "scriptsig_asm": "OP_0 OP_PUSHBYTES_72 304502210099219ee0cd5da341650078e3c63885b3cc2211069f2551cf436e0100f421e1760220349b4ec284255b458d6da539fa17314e8330459e0a653c254f775d4ec8f32b3f01 OP_PUSHBYTES_71 304402203a8353c5ee76a2e266432e5f993f882e05725297e64c0833cf44719f7dda8d3b022058a2f72e7739efd21657b4943cac60a0a3c749e712787f0e85726da4c3adcf8e01 OP_PUSHDATA1 5221027f2a0df8e86535d08ca3e766a178f90c813d2dd1d55b0166e82518efbffb18c02103556a35844b517e2fc8216701e2e0a64dbcbe62ad420ac6dd73dc79e69efeb69521031ef21bd55171032b7aec21ec82932735fb986f1d4d8611feee62ab38acf4a6bb53ae",
          "is_coinbase": false,
          "sequence": 4294967295,
          "inner_redeemscript_asm": "OP_PUSHNUM_2 OP_PUSHBYTES_33 027f2a0df8e86535d08ca3e766a178f90c813d2dd1d55b0166e82518efbffb18c0 OP_PUSHBYTES_33 03556a35844b517e2fc8216701e2e0a64dbcbe62ad420ac6dd73dc79e69efeb695 OP_PUSHBYTES_33 031ef21bd55171032b7aec21ec82932735fb986f1d4d8611feee62ab38acf4a6bb OP_PUSHNUM_3 OP_CHECKMULTISIG"
        },
        ...
        {
          "txid": "43852d32c7ae6d362d446d090daa4d389f78ec77e6693f9248cd924dc0b1ecc3",
          "vout": 1,
          "prevout": {
            "scriptpubkey": "a914a3aff5f5765f167c1582fd85517ddde83174118187",
            "scriptpubkey_asm": "OP_HASH160 OP_PUSHBYTES_20 a3aff5f5765f167c1582fd85517ddde831741181 OP_EQUAL",
            "scriptpubkey_type": "p2sh",
            "scriptpubkey_address": "3GcWrnGFoNzbn1KaiP5czS5xPELdWcgDX2",
            "value": 1719827
          },
          "scriptsig": "0047304402205f83d22a0476158aa0986682c96ce2b2dab26c814968dba62905cdfeef1b3ac7022059438a3439bb18bd49242010c8a276ea6f1810d523042e679fa6679d60e89e0201483045022100eb085df09e0fb4894090a5f39b9f2188392f7ac2847ed8255629baffc7371f170220120463b91d6c4bb8968fb3eda9012b88d13d8ca71de28e7a64b1dd88282ff144014c69522103650083cbc9cd1da1224e0780bce1ee8abd5150c5252defd0edeccd3521610b282102510ab30a6a97464ef0d61f71ec8b1d2325f12934ff15ba73579bfd0ac5f4fc1a2102985b3be77f56a9a29c5f68d3c893d6c4d76ec8c07792f0291d375c29b71ee2f853ae",
          "scriptsig_asm": "OP_0 OP_PUSHBYTES_71 304402205f83d22a0476158aa0986682c96ce2b2dab26c814968dba62905cdfeef1b3ac7022059438a3439bb18bd49242010c8a276ea6f1810d523042e679fa6679d60e89e0201 OP_PUSHBYTES_72 3045022100eb085df09e0fb4894090a5f39b9f2188392f7ac2847ed8255629baffc7371f170220120463b91d6c4bb8968fb3eda9012b88d13d8ca71de28e7a64b1dd88282ff14401 OP_PUSHDATA1 522103650083cbc9cd1da1224e0780bce1ee8abd5150c5252defd0edeccd3521610b282102510ab30a6a97464ef0d61f71ec8b1d2325f12934ff15ba73579bfd0ac5f4fc1a2102985b3be77f56a9a29c5f68d3c893d6c4d76ec8c07792f0291d375c29b71ee2f853ae",
          "is_coinbase": false,
          "sequence": 4294967295,
          "inner_redeemscript_asm": "OP_PUSHNUM_2 OP_PUSHBYTES_33 03650083cbc9cd1da1224e0780bce1ee8abd5150c5252defd0edeccd3521610b28 OP_PUSHBYTES_33 02510ab30a6a97464ef0d61f71ec8b1d2325f12934ff15ba73579bfd0ac5f4fc1a OP_PUSHBYTES_33 02985b3be77f56a9a29c5f68d3c893d6c4d76ec8c07792f0291d375c29b71ee2f8 OP_PUSHNUM_3 OP_CHECKMULTISIG"
        }
      ],
      "vout": [
        {
          "scriptpubkey": "0014292fce548b228cd3df6334dd525fac62e7eb5f7a",
          "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_20 292fce548b228cd3df6334dd525fac62e7eb5f7a",
          "scriptpubkey_type": "v0_p2wpkh",
          "scriptpubkey_address": "bc1q9yhuu4yty2xd8hmrxnw4yhavvtn7khm62uw38p",
          "value": 57000
        },
        ...
        {
          "scriptpubkey": "0020e5c7c00d174631d2d1e365d6347b016fb87b6a0c08902d8e443989cb771fa7ec",
          "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_32 e5c7c00d174631d2d1e365d6347b016fb87b6a0c08902d8e443989cb771fa7ec",
          "scriptpubkey_type": "v0_p2wsh",
          "scriptpubkey_address": "bc1quhruqrghgcca950rvhtrg7cpd7u8k6svpzgzmrjy8xyukacl5lkq0r8l2d",
          "value": 17343523
        }
      ],
      "size": 5514,
      "weight": 22056,
      "sigops": 208,
      "fee": 44000,
      "status": {
        "confirmed": true,
        "block_height": 875602,
        "block_hash": "000000000000000000016c0639b6c1a34d6659c231aa2de5849ab3377ed75020",
        "block_time": 1734704791
      },
      "order": 864069877,
      "vsize": 5514,
      "adjustedVsize": 5514,
      "feePerVsize": 7.979688066739209,
      "adjustedFeePerVsize": 7.979688066739209,
      "effectiveFeePerVsize": 7.979688066739209,
      "firstSeen": 1734704590,
      "inputs": [],
      "cpfpDirty": false,
      "ancestors": [],
      "descendants": [],
      "bestDescendant": null,
      "position": {
        "block": 0,
        "vsize": 191567
      },
      "flags": 1099511659526
    }
  ]
}`
        }
      }
    }
  },
  {
    type: 'endpoint',
    category: 'addresses',
    fragment: 'track-addresses',
    title: 'Track Addresses',
    description: {
      default: 'Subscribe to multiple addresses to receive live updates on new transactions having these addresses in input or output. Limits on the maximum number of tracked addresses may apply on this instance.'
    },
    payload: `{
  "track-addresses": [
    "qb1zjrtrlj26qhlr0qze7x9fszx0aa8k268d48n3gmc097zjugk87qrsq9l22h",
    "qb1z7635znpv0ffehup3aq7dddzf6yuvvzwddad7aye7l64430rvq69q4zmcdh"
  ]
}`,
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: false,
    codeExample: {
      default: {
        codeTemplate: {
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "multi-address-transactions": {
    "qb1z7635znpv0ffehup3aq7dddzf6yuvvzwddad7aye7l64430rvq69q4zmcdh": {
      "mempool": [],
      "confirmed": [
        {
          "txid": "1e4764f908f19b74284a889478b95d013c1bd36dc832dcb7eb36fe1801fed404",
          "version": 2,
          "locktime": 875625,
          "vin": [
            {
              "txid": "ce361fed5996aec6d440556383164e9e4e5b8be8c2a213c4b36ae711efda3b3f",
              "vout": 1,
              "prevout": {
                "scriptpubkey": "0014257ba1ebc987831dbe8ee560419282483bf68588",
                "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_20 257ba1ebc987831dbe8ee560419282483bf68588",
                "scriptpubkey_type": "v0_p2wpkh",
                "scriptpubkey_address": "bc1qy4a6r67fs7p3m05wu4syry5zfqaldpvg8vsqzz",
                "value": 1831200
              },
              "scriptsig": "",
              "scriptsig_asm": "",
              "witness": [
                "3044022028363f66fe74bdddf46d204cbf9844d4ef99d6fcb801f93f3ea1666ff51514340220058eb99790dd002323bd12afa0b62903cf72465d48c40cb11366dfa4eebbd87a01",
                "020e625e13a81995f29ee828e31500b8454bd0b115f84dfa07d994eecd733efffa"
              ],
              "is_coinbase": false,
              "sequence": 4294967294
            },
            ...
          ],
          "vout": [
            {
              "scriptpubkey": "0020949e53d22b4844b92076acb2414abbfd0a96171b87d91c55063269ee3ed1b1b6",
              "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_32 949e53d22b4844b92076acb2414abbfd0a96171b87d91c55063269ee3ed1b1b6",
              "scriptpubkey_type": "v0_p2wsh",
              "scriptpubkey_address": "bc1qjj09853tfpztjgrk4jeyzj4ml59fv9cmslv3c4gxxf57u0k3kxmqllx29y",
              "value": 2546637
            }
          ],
          "size": 351,
          "weight": 756,
          "sigops": 2,
          "fee": 4206,
          "status": {
            "confirmed": true,
            "block_height": 875626,
            "block_hash": "0000000000000000000086de1f4815ff0f7f0411d846301c5efa1e437130dc22",
            "block_time": 1734720142
          },
          "order": 81067521,
          "vsize": 189,
          "adjustedVsize": 189,
          "feePerVsize": 22.253968253968253,
          "adjustedFeePerVsize": 22.253968253968253,
          "effectiveFeePerVsize": 22.253968253968253,
          "firstSeen": 1734719830,
          "inputs": [],
          "cpfpDirty": false,
          "ancestors": [],
          "descendants": [],
          "bestDescendant": null,
          "position": {
            "block": 0,
            "vsize": 134866.5
          },
          "flags": 1099511640074
        }
      ],
      "removed": []
    }
  }
}`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "multi-address-transactions": {
    "qb1z7635znpv0ffehup3aq7dddzf6yuvvzwddad7aye7l64430rvq69q4zmcdh": {
      "mempool": [],
      "confirmed": [
        {
          "txid": "1e4764f908f19b74284a889478b95d013c1bd36dc832dcb7eb36fe1801fed404",
          "version": 2,
          "locktime": 875625,
          "vin": [
            {
              "txid": "ce361fed5996aec6d440556383164e9e4e5b8be8c2a213c4b36ae711efda3b3f",
              "vout": 1,
              "prevout": {
                "scriptpubkey": "0014257ba1ebc987831dbe8ee560419282483bf68588",
                "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_20 257ba1ebc987831dbe8ee560419282483bf68588",
                "scriptpubkey_type": "v0_p2wpkh",
                "scriptpubkey_address": "bc1qy4a6r67fs7p3m05wu4syry5zfqaldpvg8vsqzz",
                "value": 1831200
              },
              "scriptsig": "",
              "scriptsig_asm": "",
              "witness": [
                "3044022028363f66fe74bdddf46d204cbf9844d4ef99d6fcb801f93f3ea1666ff51514340220058eb99790dd002323bd12afa0b62903cf72465d48c40cb11366dfa4eebbd87a01",
                "020e625e13a81995f29ee828e31500b8454bd0b115f84dfa07d994eecd733efffa"
              ],
              "is_coinbase": false,
              "sequence": 4294967294
            },
            ...
          ],
          "vout": [
            {
              "scriptpubkey": "0020949e53d22b4844b92076acb2414abbfd0a96171b87d91c55063269ee3ed1b1b6",
              "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_32 949e53d22b4844b92076acb2414abbfd0a96171b87d91c55063269ee3ed1b1b6",
              "scriptpubkey_type": "v0_p2wsh",
              "scriptpubkey_address": "bc1qjj09853tfpztjgrk4jeyzj4ml59fv9cmslv3c4gxxf57u0k3kxmqllx29y",
              "value": 2546637
            }
          ],
          "size": 351,
          "weight": 756,
          "sigops": 2,
          "fee": 4206,
          "status": {
            "confirmed": true,
            "block_height": 875626,
            "block_hash": "0000000000000000000086de1f4815ff0f7f0411d846301c5efa1e437130dc22",
            "block_time": 1734720142
          },
          "order": 81067521,
          "vsize": 189,
          "adjustedVsize": 189,
          "feePerVsize": 22.253968253968253,
          "adjustedFeePerVsize": 22.253968253968253,
          "effectiveFeePerVsize": 22.253968253968253,
          "firstSeen": 1734719830,
          "inputs": [],
          "cpfpDirty": false,
          "ancestors": [],
          "descendants": [],
          "bestDescendant": null,
          "position": {
            "block": 0,
            "vsize": 134866.5
          },
          "flags": 1099511640074
        }
      ],
      "removed": []
    }
  }
}`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "multi-address-transactions": {
    "qb1z7635znpv0ffehup3aq7dddzf6yuvvzwddad7aye7l64430rvq69q4zmcdh": {
      "mempool": [],
      "confirmed": [
        {
          "txid": "1e4764f908f19b74284a889478b95d013c1bd36dc832dcb7eb36fe1801fed404",
          "version": 2,
          "locktime": 875625,
          "vin": [
            {
              "txid": "ce361fed5996aec6d440556383164e9e4e5b8be8c2a213c4b36ae711efda3b3f",
              "vout": 1,
              "prevout": {
                "scriptpubkey": "0014257ba1ebc987831dbe8ee560419282483bf68588",
                "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_20 257ba1ebc987831dbe8ee560419282483bf68588",
                "scriptpubkey_type": "v0_p2wpkh",
                "scriptpubkey_address": "bc1qy4a6r67fs7p3m05wu4syry5zfqaldpvg8vsqzz",
                "value": 1831200
              },
              "scriptsig": "",
              "scriptsig_asm": "",
              "witness": [
                "3044022028363f66fe74bdddf46d204cbf9844d4ef99d6fcb801f93f3ea1666ff51514340220058eb99790dd002323bd12afa0b62903cf72465d48c40cb11366dfa4eebbd87a01",
                "020e625e13a81995f29ee828e31500b8454bd0b115f84dfa07d994eecd733efffa"
              ],
              "is_coinbase": false,
              "sequence": 4294967294
            },
            ...
          ],
          "vout": [
            {
              "scriptpubkey": "0020949e53d22b4844b92076acb2414abbfd0a96171b87d91c55063269ee3ed1b1b6",
              "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_32 949e53d22b4844b92076acb2414abbfd0a96171b87d91c55063269ee3ed1b1b6",
              "scriptpubkey_type": "v0_p2wsh",
              "scriptpubkey_address": "bc1qjj09853tfpztjgrk4jeyzj4ml59fv9cmslv3c4gxxf57u0k3kxmqllx29y",
              "value": 2546637
            }
          ],
          "size": 351,
          "weight": 756,
          "sigops": 2,
          "fee": 4206,
          "status": {
            "confirmed": true,
            "block_height": 875626,
            "block_hash": "0000000000000000000086de1f4815ff0f7f0411d846301c5efa1e437130dc22",
            "block_time": 1734720142
          },
          "order": 81067521,
          "vsize": 189,
          "adjustedVsize": 189,
          "feePerVsize": 22.253968253968253,
          "adjustedFeePerVsize": 22.253968253968253,
          "effectiveFeePerVsize": 22.253968253968253,
          "firstSeen": 1734719830,
          "inputs": [],
          "cpfpDirty": false,
          "ancestors": [],
          "descendants": [],
          "bestDescendant": null,
          "position": {
            "block": 0,
            "vsize": 134866.5
          },
          "flags": 1099511640074
        }
      ],
      "removed": []
    }
  }
}`
        },
        codeSampleLiquid: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "multi-address-transactions": {
    "ex1qzq0h0wvnnh9xpd508fzxaft0nu9wjmdvzalu6f": {
      "mempool": [],
      "confirmed": [
        {
          "txid": "d61ad73b64895ccabd32816643554c676891bdb52da0fba2b37079e04c4c4b2c",
          "version": 2,
          "locktime": 3171528,
          "vin": [
            {
              "txid": "4847a0627952a0bcad6c8947d46a0e5b13eefbcfbf76246ea16a1a7c82bcc49b",
              "vout": 2,
              "prevout": {
                "scriptpubkey": "00144d72c2967e1a581c0e71e82d65e99523a9149d02",
                "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_20 4d72c2967e1a581c0e71e82d65e99523a9149d02",
                "scriptpubkey_type": "v0_p2wpkh",
                "scriptpubkey_address": "ex1qf4ev99n7rfvpcrn3aqkkt6v4yw53f8gznv9paa",
                "valuecommitment": "09af208bbc0b9809aff4368dee81f74f178f77f844e7dfc5d70615bc757fa8b2f9",
                "assetcommitment": "0a2ca17c42fadd887373c371e44cf49c6cd64c3081e23eef3275bdace0b8c674b5"
              },
              "scriptsig": "",
              "scriptsig_asm": "",
              "witness": [
                "30440220653c6e1bd3de5bd9a56cbb6eb246834724667a5c5d12dc07107edc7c72bd6634022008d1f770dc9ba624bb250bba3a5254aa633f01a9bcb2a85aedc5b251e338b7b301",
                "03fb2f0245e19f9e886fce54894558bbbcf50bf9576245e60a4c9780f7447eaf22"
              ],
              "is_coinbase": false,
              "sequence": 4294967294,
              "is_pegin": false
            },
            {
              "txid": "ea5f690853ece5549807862a153357092c4f7dbe10886b86b84f87a3201dd8dc",
              "vout": 0,
              "prevout": {
                "scriptpubkey": "0014a5996021b4001325b1aa85c3bf400516855a6e05",
                "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_20 a5996021b4001325b1aa85c3bf400516855a6e05",
                "scriptpubkey_type": "v0_p2wpkh",
                "scriptpubkey_address": "ex1q5kvkqgd5qqfjtvd2shpm7sq9z6z45ms9ma7ywz",
                "valuecommitment": "09f36fde0f51390cdf2ee6830b3c696569c3f9c5855ce26bd4f6d0280a83b86ecf",
                "assetcommitment": "0bfcd8fcfaebfa41b596a89aa55fbf2eaa8c383ec71e8d9d0d461ea645d8d1bc45"
              },
              "scriptsig": "",
              "scriptsig_asm": "",
              "witness": [
                "30440220033208f3e37c35009ba00472a67899222afbd5cc12b0d3906d2eec6f50a058510220607d4c5de43459e38158ee1cbe5e6a74c155041cecdbf961a077a952ee1e543601",
                "0394d6ecb2f5db9fdeb0f7ac5301ea148704fc6986fdb8181bddc1d2eec9e99c32"
              ],
              "is_coinbase": false,
              "sequence": 4294967294,
              "is_pegin": false
            },
            {
              "txid": "23e63b888d5da3ce1193bb4a74a0762d78904cfa7a6307ff47e91054d961208b",
              "vout": 2,
              "prevout": {
                "scriptpubkey": "00144990783e871e57fa2499f00c5f6f4ddc2602e7c8",
                "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_20 4990783e871e57fa2499f00c5f6f4ddc2602e7c8",
                "scriptpubkey_type": "v0_p2wpkh",
                "scriptpubkey_address": "ex1qfxg8s058retl5fye7qx97m6dmsnq9e7gq0dcee",
                "valuecommitment": "0816440695f0c47ce471c7e10a93d36aee4554b46ed269bfa8390dd9db69409537",
                "assetcommitment": "0a5a0eb7cab779cb6ce5d6517c73e244075eea15fbd54a7beb34710862aef58359"
              },
              "scriptsig": "",
              "scriptsig_asm": "",
              "witness": [
                "3044022051e5482a486f55cfd5ae25062b0252e13de9bfa11a9c7e5f608ac6e03c62dc8902201d2b47a27fc07999973ec44e4569b4b3fcc338b1c3977173cfeab9cccde0b3e301",
                "025991a68daafc95494019c228855999db8f19c872fd3f58bac6ff149db7b53cff"
              ],
              "is_coinbase": false,
              "sequence": 4294967294,
              "is_pegin": false
            },
            {
              "txid": "2bbeb9440d3c08a1d3cd9acf5959ee740a6a64ffcaa4aa2b43e30026a2a40334",
              "vout": 2,
              "prevout": {
                "scriptpubkey": "00144d72c2967e1a581c0e71e82d65e99523a9149d02",
                "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_20 4d72c2967e1a581c0e71e82d65e99523a9149d02",
                "scriptpubkey_type": "v0_p2wpkh",
                "scriptpubkey_address": "ex1qf4ev99n7rfvpcrn3aqkkt6v4yw53f8gznv9paa",
                "valuecommitment": "09d0c574d61d50065a2e398fb7252315b65176bf97de1d180d337f3aadfaa0e53e",
                "assetcommitment": "0b82ede6b9a6cb9505a7f6bcc76f72caa3228de193debf4e586d60baebeaef0ab5"
              },
              "scriptsig": "",
              "scriptsig_asm": "",
              "witness": [
                "3044022033ab9ea81a21b0f917792097ed69ab3724957a5e5d3a0430a0b2a16e0a74d8750220202859dc7e53998f5dc4b424321b7a711e3ff6517422a099504b337e30ec8acb01",
                "03fb2f0245e19f9e886fce54894558bbbcf50bf9576245e60a4c9780f7447eaf22"
              ],
              "is_coinbase": false,
              "sequence": 4294967294,
              "is_pegin": false
            }
          ],
          "vout": [
            {
              "scriptpubkey": "a914e185d1192f34d55ba3fbd15408168f339683d80287",
              "scriptpubkey_asm": "OP_HASH160 OP_PUSHBYTES_20 e185d1192f34d55ba3fbd15408168f339683d802 OP_EQUAL",
              "scriptpubkey_type": "p2sh",
              "scriptpubkey_address": "H3jyk9ipDU5efhHW9n52xCY78HNFAQTy78",
              "valuecommitment": "08f676101a27d784f1f89765ff33ad5a1e95ab2081da76b29ef97bdfaf309e1318",
              "assetcommitment": "0a115106f540daae5a0a7cf66dcf07a69dc2faffb917e82f340bcdfc7da143228b"
            },
            {
              "scriptpubkey": "0014101f77b9939dca60b68f3a446ea56f9f0ae96dac",
              "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_20 101f77b9939dca60b68f3a446ea56f9f0ae96dac",
              "scriptpubkey_type": "v0_p2wpkh",
              "scriptpubkey_address": "ex1qzq0h0wvnnh9xpd508fzxaft0nu9wjmdvzalu6f",
              "valuecommitment": "09bec5886710680e125b52ac99f6aee452984847cddc57abaa96eb8cc360f80104",
              "assetcommitment": "0adfd85f43988146c1878e98bc5e6206f368280cb03760c37e86ec0bd39005d0cd"
            },
            {
              "scriptpubkey": "00140fe27684e78285d508073f2b8a3a6c884515d1a9",
              "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_20 0fe27684e78285d508073f2b8a3a6c884515d1a9",
              "scriptpubkey_type": "v0_p2wpkh",
              "scriptpubkey_address": "ex1qpl38dp88s2za2zq88u4c5wnv3pz3t5dfha22k9",
              "valuecommitment": "08bef8c28296cf050802c943d46aa539d2f5280e9b9471db928746480815cf5457",
              "assetcommitment": "0a5a032f72df6fba7f1acd7230f44cdf41ce27926e48e262ffdfea18efd19e0439"
            },
            {
              "scriptpubkey": "",
              "scriptpubkey_asm": "",
              "scriptpubkey_type": "fee",
              "value": 394,
              "asset": "6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d"
            }
          ],
          "size": 13955,
          "weight": 15713,
          "sigops": 0,
          "fee": 394,
          "status": {
            "confirmed": true,
            "block_height": 3171530,
            "block_hash": "400270631b0f66d70cd6a045f36bb3f37c9076688fd496669d5da2a7245392d9",
            "block_time": 1734720368
          },
          "order": 743132236,
          "vsize": 3929,
          "adjustedVsize": 3928.25,
          "feePerVsize": 0.10029911538216763,
          "adjustedFeePerVsize": 0.10029911538216763,
          "effectiveFeePerVsize": 0.10027996945787732,
          "firstSeen": 1734720314,
          "inputs": [],
          "cpfpDirty": false,
          "ancestors": [],
          "descendants": [],
          "bestDescendant": null,
          "position": {
            "block": 0,
            "vsize": 6972.5
          },
          "flags": 1099511633962,
          "cpfpChecked": true,
          "cpfpUpdated": 1734720355424
        }
      ],
      "removed": []
    }
  }
}`
        }
      }
    }
  },
  {
    type: 'category',
    category: 'transactions',
    fragment: 'transactions',
    title: 'Transactions',
    showConditions: bitcoinNetworks.concat(liquidNetworks)
  },
  {
    type: 'endpoint',
    category: 'transactions',
    fragment: 'track-tx',
    title: 'Track Transaction',
    description: {
      default: 'Subscribe to a transaction to receive live updates on its confirmation status and position in the mempool.'
    },
    payload: '{ "track-tx": "8a4666c6d22ce74fa47e1c4fdb09af556a234cc6a606539a75caf66ba44a2d07" }',
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: false,
    codeExample: {
      default: {
        codeTemplate: {
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "txPosition": {
    "txid": [
      "8a4666c6d22ce74fa47e1c4fdb09af556a234cc6a606539a75caf66ba44a2d07"
    ],
    "position": {
      "block": 0,
      "vsize": 726868
    },
    "cpfp": {
      "ancestors": [
        {
          "txid": "d509a6b8f36149588f9f48dc25fa5e37fc00dee781aed6da1113066c56f04879",
          "fee": 605,
          "weight": 520
        }
      ],
      "bestDescendant": null,
      "descendants": [
        {
          "txid": "28d3c592a9a8103d53c784aa539908f4dc5f9c463e179f0eae5dc5f349bdb00f",
          "fee": 2501,
          "weight": 816
        }
      ],
      "effectiveFeePerVsize": 5.12063778580024,
      "sigops": 0,
      "adjustedVsize": 130
    }
  }
}`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "txPosition": {
    "txid": [
      "8a4666c6d22ce74fa47e1c4fdb09af556a234cc6a606539a75caf66ba44a2d07"
    ],
    "position": {
      "block": 0,
      "vsize": 726868
    },
    "cpfp": {
      "ancestors": [
        {
          "txid": "d509a6b8f36149588f9f48dc25fa5e37fc00dee781aed6da1113066c56f04879",
          "fee": 605,
          "weight": 520
        }
      ],
      "bestDescendant": null,
      "descendants": [
        {
          "txid": "28d3c592a9a8103d53c784aa539908f4dc5f9c463e179f0eae5dc5f349bdb00f",
          "fee": 2501,
          "weight": 816
        }
      ],
      "effectiveFeePerVsize": 5.12063778580024,
      "sigops": 0,
      "adjustedVsize": 130
    }
  }
}`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "txPosition": {
    "txid": [
      "8a4666c6d22ce74fa47e1c4fdb09af556a234cc6a606539a75caf66ba44a2d07"
    ],
    "position": {
      "block": 0,
      "vsize": 726868
    },
    "cpfp": {
      "ancestors": [
        {
          "txid": "d509a6b8f36149588f9f48dc25fa5e37fc00dee781aed6da1113066c56f04879",
          "fee": 605,
          "weight": 520
        }
      ],
      "bestDescendant": null,
      "descendants": [
        {
          "txid": "28d3c592a9a8103d53c784aa539908f4dc5f9c463e179f0eae5dc5f349bdb00f",
          "fee": 2501,
          "weight": 816
        }
      ],
      "effectiveFeePerVsize": 5.12063778580024,
      "sigops": 0,
      "adjustedVsize": 130
    }
  }
}`
        },
        codeSampleLiquid: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "txPosition": {
    "txid": [
      "8a4666c6d22ce74fa47e1c4fdb09af556a234cc6a606539a75caf66ba44a2d07"
    ],
    "position": {
      "block": 0,
      "vsize": 726868
    },
    "cpfp": {
      "ancestors": [
        {
          "txid": "d509a6b8f36149588f9f48dc25fa5e37fc00dee781aed6da1113066c56f04879",
          "fee": 605,
          "weight": 520
        }
      ],
      "bestDescendant": null,
      "descendants": [
        {
          "txid": "28d3c592a9a8103d53c784aa539908f4dc5f9c463e179f0eae5dc5f349bdb00f",
          "fee": 2501,
          "weight": 816
        }
      ],
      "effectiveFeePerVsize": 5.12063778580024,
      "sigops": 0,
      "adjustedVsize": 130
    }
  }
}`
        }
      }
    }
  },
  {
    type: 'endpoint',
    category: 'transactions',
    fragment: 'track-txs',
    title: 'Track Transactions',
    description: {
      default: 'Subscribe to multiple transactions to receive live updates on their status and position in the mempool. Limits on the maximum number of tracked transactions may apply on this instance.'
    },
    payload: `{
      "track-txs": [
        "8a4666c6d22ce74fa47e1c4fdb09af556a234cc6a606539a75caf66ba44a2d07",
        "941df06064c290b4627e92bdbf3bff7c0e97aab33e273c2a20404f9cfd21b607"
      ]
    }`,    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: false,
    codeExample: {
      default: {
        codeTemplate: {
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "tracked-txs": {
    "8a4666c6d22ce74fa47e1c4fdb09af556a234cc6a606539a75caf66ba44a2d07": {
      "position": {
        "block": 0,
        "vsize": 434494
      },
      "cpfp": {
        "ancestors": [
          {
            "txid": "d509a6b8f36149588f9f48dc25fa5e37fc00dee781aed6da1113066c56f04879",
            "fee": 605,
            "weight": 520
          }
        ],
        "bestDescendant": null,
        "descendants": [
          {
          "txid": "28d3c592a9a8103d53c784aa539908f4dc5f9c463e179f0eae5dc5f349bdb00f",
          "fee": 2501,
          "weight": 816
          }
        ],
        "effectiveFeePerVsize": 5.12063778580024,
        "sigops": 0,
        "adjustedVsize": 130
      }
    },
    "941df06064c290b4627e92bdbf3bff7c0e97aab33e273c2a20404f9cfd21b607": {
      "position": {
        "block": 2,
        "vsize": 932479.5
      }
    }
  }
}`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "tracked-txs": {
    "8a4666c6d22ce74fa47e1c4fdb09af556a234cc6a606539a75caf66ba44a2d07": {
      "position": {
        "block": 0,
        "vsize": 434494
      },
      "cpfp": {
        "ancestors": [
          {
            "txid": "d509a6b8f36149588f9f48dc25fa5e37fc00dee781aed6da1113066c56f04879",
            "fee": 605,
            "weight": 520
          }
        ],
        "bestDescendant": null,
        "descendants": [
          {
          "txid": "28d3c592a9a8103d53c784aa539908f4dc5f9c463e179f0eae5dc5f349bdb00f",
          "fee": 2501,
          "weight": 816
          }
        ],
        "effectiveFeePerVsize": 5.12063778580024,
        "sigops": 0,
        "adjustedVsize": 130
      }
    },
    "941df06064c290b4627e92bdbf3bff7c0e97aab33e273c2a20404f9cfd21b607": {
      "position": {
        "block": 2,
        "vsize": 932479.5
      }
    }
  }
}`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "tracked-txs": {
    "8a4666c6d22ce74fa47e1c4fdb09af556a234cc6a606539a75caf66ba44a2d07": {
      "position": {
        "block": 0,
        "vsize": 434494
      },
      "cpfp": {
        "ancestors": [
          {
            "txid": "d509a6b8f36149588f9f48dc25fa5e37fc00dee781aed6da1113066c56f04879",
            "fee": 605,
            "weight": 520
          }
        ],
        "bestDescendant": null,
        "descendants": [
          {
          "txid": "28d3c592a9a8103d53c784aa539908f4dc5f9c463e179f0eae5dc5f349bdb00f",
          "fee": 2501,
          "weight": 816
          }
        ],
        "effectiveFeePerVsize": 5.12063778580024,
        "sigops": 0,
        "adjustedVsize": 130
      }
    },
    "941df06064c290b4627e92bdbf3bff7c0e97aab33e273c2a20404f9cfd21b607": {
      "position": {
        "block": 2,
        "vsize": 932479.5
      }
    }
  }
}`
        },
        codeSampleLiquid: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "tracked-txs": {
    "8a4666c6d22ce74fa47e1c4fdb09af556a234cc6a606539a75caf66ba44a2d07": {
      "position": {
        "block": 0,
        "vsize": 434494
      },
      "cpfp": {
        "ancestors": [
          {
            "txid": "d509a6b8f36149588f9f48dc25fa5e37fc00dee781aed6da1113066c56f04879",
            "fee": 605,
            "weight": 520
          }
        ],
        "bestDescendant": null,
        "descendants": [
          {
          "txid": "28d3c592a9a8103d53c784aa539908f4dc5f9c463e179f0eae5dc5f349bdb00f",
          "fee": 2501,
          "weight": 816
          }
        ],
        "effectiveFeePerVsize": 5.12063778580024,
        "sigops": 0,
        "adjustedVsize": 130
      }
    },
    "941df06064c290b4627e92bdbf3bff7c0e97aab33e273c2a20404f9cfd21b607": {
      "position": {
        "block": 2,
        "vsize": 932479.5
      }
    }
  }
}`
        }
      }
    }
  },
  {
    type: 'category',
    category: 'mempool',
    fragment: 'mempool',
    title: 'Mempool',
    showConditions: bitcoinNetworks.concat(liquidNetworks)
  },
  {
    type: 'endpoint',
    category: 'mempool',
    fragment: 'track-mempool',
    title: 'Track Mempool',
    description: {
      default: 'Subscribe to new mempool events, such as new transactions entering the mempool. Available fields: <code>added</code>, <code>removed</code>, <code>mined</code>, <code>replaced</code>. <br> Because this is potentially a lot of data, consider using the <code>track-mempool-txids</code> endpoint described below instead.'
    },
    payload: '{ "track-mempool": true }',
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: false,
    codeExample: {
      default: {
        codeTemplate: {
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "mempool-transactions": {
    "sequence": 81419,
    "added": [
      {
        "txid": "6229c0784bc776be22a5ee84e0e3d9b8f9e17843f079a8444b03bdc98b77d229",
        "version": 2,
        "locktime": 0,
        "vin": [
          {
            "txid": "b4b324e3bff7ee0a7e664e8c03df1fe3a0bd53e5685ea6b10abb5f89ba1b2ead",
            "vout": 5,
            "prevout": {
              "scriptpubkey": "76a914b54afb58f0faa9d1bde2ed755bc56ef1e4a4e24188ac",
              "scriptpubkey_asm": "OP_DUP OP_HASH160 OP_PUSHBYTES_20 b54afb58f0faa9d1bde2ed755bc56ef1e4a4e241 OP_EQUALVERIFY OP_CHECKSIG",
              "scriptpubkey_type": "p2pkh",
              "scriptpubkey_address": "1HXb8YtsgBhFWdYezjd6bt7Dw4UGKyZo54",
              "value": 17000
            },
            "scriptsig": "4830450221008e9b91aae7b4705841c97dc99d6ab233f10ff9b97d7c139be08634d2f0f5f66f02205d67eae8c830ed0979e169403d13c0f43efd78edbb9a344390245f5a83649404012103cf9fad8b202384de9ef010129a62b8249920a6205fe53cc0efbea9eb0db595e7",
            "scriptsig_asm": "OP_PUSHBYTES_72 30450221008e9b91aae7b4705841c97dc99d6ab233f10ff9b97d7c139be08634d2f0f5f66f02205d67eae8c830ed0979e169403d13c0f43efd78edbb9a344390245f5a8364940401 OP_PUSHBYTES_33 03cf9fad8b202384de9ef010129a62b8249920a6205fe53cc0efbea9eb0db595e7",
            "is_coinbase": false,
            "sequence": 4294967293
          }
        ],
        "vout": [
          {
            "scriptpubkey": "76a91401603bd82a5d5a6e8c6df5d9ae662b9fc5db60f288ac",
            "scriptpubkey_asm": "OP_DUP OP_HASH160 OP_PUSHBYTES_20 01603bd82a5d5a6e8c6df5d9ae662b9fc5db60f2 OP_EQUALVERIFY OP_CHECKSIG",
            "scriptpubkey_type": "p2pkh",
            "scriptpubkey_address": "18GxdcLgNtRUc8v5TNJtPnvoi8jMVWxvb",
            "value": 10419
          },
          {
            "scriptpubkey": "76a914338ad842d236486627834bf9f5e182c7a8aa937188ac",
            "scriptpubkey_asm": "OP_DUP OP_HASH160 OP_PUSHBYTES_20 338ad842d236486627834bf9f5e182c7a8aa9371 OP_EQUALVERIFY OP_CHECKSIG",
            "scriptpubkey_type": "p2pkh",
            "scriptpubkey_address": "15hXntT6oUKNhtk4FWvuGPQJDX47wpbAaa",
            "value": 5396
          }
        ],
        "size": 226,
        "weight": 904,
        "sigops": 8,
        "fee": 1185,
        "status": {
          "confirmed": false
        },
        "order": 701659019,
        "vsize": 226,
        "adjustedVsize": 226,
        "feePerVsize": 5.243362831858407,
        "adjustedFeePerVsize": 5.243362831858407,
        "effectiveFeePerVsize": 5.243362831858407,
        "firstSeen": 1734893382,
        "uid": 429139,
        "inputs": [],
        "cpfpDirty": false,
        "ancestors": [],
        "descendants": [],
        "bestDescendant": null,
        "position": {
          "block": 0,
          "vsize": 125270
        },
        "flags": 1099511628809
      },
      ...
    ],
    "removed": [],
    "mined": [],
    "replaced": []
  }
}`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "mempool-transactions": {
    "sequence": 81419,
    "added": [
      {
        "txid": "6229c0784bc776be22a5ee84e0e3d9b8f9e17843f079a8444b03bdc98b77d229",
        "version": 2,
        "locktime": 0,
        "vin": [
          {
            "txid": "b4b324e3bff7ee0a7e664e8c03df1fe3a0bd53e5685ea6b10abb5f89ba1b2ead",
            "vout": 5,
            "prevout": {
              "scriptpubkey": "76a914b54afb58f0faa9d1bde2ed755bc56ef1e4a4e24188ac",
              "scriptpubkey_asm": "OP_DUP OP_HASH160 OP_PUSHBYTES_20 b54afb58f0faa9d1bde2ed755bc56ef1e4a4e241 OP_EQUALVERIFY OP_CHECKSIG",
              "scriptpubkey_type": "p2pkh",
              "scriptpubkey_address": "1HXb8YtsgBhFWdYezjd6bt7Dw4UGKyZo54",
              "value": 17000
            },
            "scriptsig": "4830450221008e9b91aae7b4705841c97dc99d6ab233f10ff9b97d7c139be08634d2f0f5f66f02205d67eae8c830ed0979e169403d13c0f43efd78edbb9a344390245f5a83649404012103cf9fad8b202384de9ef010129a62b8249920a6205fe53cc0efbea9eb0db595e7",
            "scriptsig_asm": "OP_PUSHBYTES_72 30450221008e9b91aae7b4705841c97dc99d6ab233f10ff9b97d7c139be08634d2f0f5f66f02205d67eae8c830ed0979e169403d13c0f43efd78edbb9a344390245f5a8364940401 OP_PUSHBYTES_33 03cf9fad8b202384de9ef010129a62b8249920a6205fe53cc0efbea9eb0db595e7",
            "is_coinbase": false,
            "sequence": 4294967293
          }
        ],
        "vout": [
          {
            "scriptpubkey": "76a91401603bd82a5d5a6e8c6df5d9ae662b9fc5db60f288ac",
            "scriptpubkey_asm": "OP_DUP OP_HASH160 OP_PUSHBYTES_20 01603bd82a5d5a6e8c6df5d9ae662b9fc5db60f2 OP_EQUALVERIFY OP_CHECKSIG",
            "scriptpubkey_type": "p2pkh",
            "scriptpubkey_address": "18GxdcLgNtRUc8v5TNJtPnvoi8jMVWxvb",
            "value": 10419
          },
          {
            "scriptpubkey": "76a914338ad842d236486627834bf9f5e182c7a8aa937188ac",
            "scriptpubkey_asm": "OP_DUP OP_HASH160 OP_PUSHBYTES_20 338ad842d236486627834bf9f5e182c7a8aa9371 OP_EQUALVERIFY OP_CHECKSIG",
            "scriptpubkey_type": "p2pkh",
            "scriptpubkey_address": "15hXntT6oUKNhtk4FWvuGPQJDX47wpbAaa",
            "value": 5396
          }
        ],
        "size": 226,
        "weight": 904,
        "sigops": 8,
        "fee": 1185,
        "status": {
          "confirmed": false
        },
        "order": 701659019,
        "vsize": 226,
        "adjustedVsize": 226,
        "feePerVsize": 5.243362831858407,
        "adjustedFeePerVsize": 5.243362831858407,
        "effectiveFeePerVsize": 5.243362831858407,
        "firstSeen": 1734893382,
        "uid": 429139,
        "inputs": [],
        "cpfpDirty": false,
        "ancestors": [],
        "descendants": [],
        "bestDescendant": null,
        "position": {
          "block": 0,
          "vsize": 125270
        },
        "flags": 1099511628809
      },
      ...
    ],
    "removed": [],
    "mined": [],
    "replaced": []
  }
}`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "mempool-transactions": {
    "sequence": 81419,
    "added": [
      {
        "txid": "6229c0784bc776be22a5ee84e0e3d9b8f9e17843f079a8444b03bdc98b77d229",
        "version": 2,
        "locktime": 0,
        "vin": [
          {
            "txid": "b4b324e3bff7ee0a7e664e8c03df1fe3a0bd53e5685ea6b10abb5f89ba1b2ead",
            "vout": 5,
            "prevout": {
              "scriptpubkey": "76a914b54afb58f0faa9d1bde2ed755bc56ef1e4a4e24188ac",
              "scriptpubkey_asm": "OP_DUP OP_HASH160 OP_PUSHBYTES_20 b54afb58f0faa9d1bde2ed755bc56ef1e4a4e241 OP_EQUALVERIFY OP_CHECKSIG",
              "scriptpubkey_type": "p2pkh",
              "scriptpubkey_address": "1HXb8YtsgBhFWdYezjd6bt7Dw4UGKyZo54",
              "value": 17000
            },
            "scriptsig": "4830450221008e9b91aae7b4705841c97dc99d6ab233f10ff9b97d7c139be08634d2f0f5f66f02205d67eae8c830ed0979e169403d13c0f43efd78edbb9a344390245f5a83649404012103cf9fad8b202384de9ef010129a62b8249920a6205fe53cc0efbea9eb0db595e7",
            "scriptsig_asm": "OP_PUSHBYTES_72 30450221008e9b91aae7b4705841c97dc99d6ab233f10ff9b97d7c139be08634d2f0f5f66f02205d67eae8c830ed0979e169403d13c0f43efd78edbb9a344390245f5a8364940401 OP_PUSHBYTES_33 03cf9fad8b202384de9ef010129a62b8249920a6205fe53cc0efbea9eb0db595e7",
            "is_coinbase": false,
            "sequence": 4294967293
          }
        ],
        "vout": [
          {
            "scriptpubkey": "76a91401603bd82a5d5a6e8c6df5d9ae662b9fc5db60f288ac",
            "scriptpubkey_asm": "OP_DUP OP_HASH160 OP_PUSHBYTES_20 01603bd82a5d5a6e8c6df5d9ae662b9fc5db60f2 OP_EQUALVERIFY OP_CHECKSIG",
            "scriptpubkey_type": "p2pkh",
            "scriptpubkey_address": "18GxdcLgNtRUc8v5TNJtPnvoi8jMVWxvb",
            "value": 10419
          },
          {
            "scriptpubkey": "76a914338ad842d236486627834bf9f5e182c7a8aa937188ac",
            "scriptpubkey_asm": "OP_DUP OP_HASH160 OP_PUSHBYTES_20 338ad842d236486627834bf9f5e182c7a8aa9371 OP_EQUALVERIFY OP_CHECKSIG",
            "scriptpubkey_type": "p2pkh",
            "scriptpubkey_address": "15hXntT6oUKNhtk4FWvuGPQJDX47wpbAaa",
            "value": 5396
          }
        ],
        "size": 226,
        "weight": 904,
        "sigops": 8,
        "fee": 1185,
        "status": {
          "confirmed": false
        },
        "order": 701659019,
        "vsize": 226,
        "adjustedVsize": 226,
        "feePerVsize": 5.243362831858407,
        "adjustedFeePerVsize": 5.243362831858407,
        "effectiveFeePerVsize": 5.243362831858407,
        "firstSeen": 1734893382,
        "uid": 429139,
        "inputs": [],
        "cpfpDirty": false,
        "ancestors": [],
        "descendants": [],
        "bestDescendant": null,
        "position": {
          "block": 0,
          "vsize": 125270
        },
        "flags": 1099511628809
      },
      ...
    ],
    "removed": [],
    "mined": [],
    "replaced": []
  }
}`
        },
        codeSampleLiquid: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "mempool-transactions": {
    "sequence": 81419,
    "added": [
      {
        "txid": "6229c0784bc776be22a5ee84e0e3d9b8f9e17843f079a8444b03bdc98b77d229",
        "version": 2,
        "locktime": 0,
        "vin": [
          {
            "txid": "b4b324e3bff7ee0a7e664e8c03df1fe3a0bd53e5685ea6b10abb5f89ba1b2ead",
            "vout": 5,
            "prevout": {
              "scriptpubkey": "76a914b54afb58f0faa9d1bde2ed755bc56ef1e4a4e24188ac",
              "scriptpubkey_asm": "OP_DUP OP_HASH160 OP_PUSHBYTES_20 b54afb58f0faa9d1bde2ed755bc56ef1e4a4e241 OP_EQUALVERIFY OP_CHECKSIG",
              "scriptpubkey_type": "p2pkh",
              "scriptpubkey_address": "1HXb8YtsgBhFWdYezjd6bt7Dw4UGKyZo54",
              "value": 17000
            },
            "scriptsig": "4830450221008e9b91aae7b4705841c97dc99d6ab233f10ff9b97d7c139be08634d2f0f5f66f02205d67eae8c830ed0979e169403d13c0f43efd78edbb9a344390245f5a83649404012103cf9fad8b202384de9ef010129a62b8249920a6205fe53cc0efbea9eb0db595e7",
            "scriptsig_asm": "OP_PUSHBYTES_72 30450221008e9b91aae7b4705841c97dc99d6ab233f10ff9b97d7c139be08634d2f0f5f66f02205d67eae8c830ed0979e169403d13c0f43efd78edbb9a344390245f5a8364940401 OP_PUSHBYTES_33 03cf9fad8b202384de9ef010129a62b8249920a6205fe53cc0efbea9eb0db595e7",
            "is_coinbase": false,
            "sequence": 4294967293
          }
        ],
        "vout": [
          {
            "scriptpubkey": "76a91401603bd82a5d5a6e8c6df5d9ae662b9fc5db60f288ac",
            "scriptpubkey_asm": "OP_DUP OP_HASH160 OP_PUSHBYTES_20 01603bd82a5d5a6e8c6df5d9ae662b9fc5db60f2 OP_EQUALVERIFY OP_CHECKSIG",
            "scriptpubkey_type": "p2pkh",
            "scriptpubkey_address": "18GxdcLgNtRUc8v5TNJtPnvoi8jMVWxvb",
            "value": 10419
          },
          {
            "scriptpubkey": "76a914338ad842d236486627834bf9f5e182c7a8aa937188ac",
            "scriptpubkey_asm": "OP_DUP OP_HASH160 OP_PUSHBYTES_20 338ad842d236486627834bf9f5e182c7a8aa9371 OP_EQUALVERIFY OP_CHECKSIG",
            "scriptpubkey_type": "p2pkh",
            "scriptpubkey_address": "15hXntT6oUKNhtk4FWvuGPQJDX47wpbAaa",
            "value": 5396
          }
        ],
        "size": 226,
        "weight": 904,
        "sigops": 8,
        "fee": 1185,
        "status": {
          "confirmed": false
        },
        "order": 701659019,
        "vsize": 226,
        "adjustedVsize": 226,
        "feePerVsize": 5.243362831858407,
        "adjustedFeePerVsize": 5.243362831858407,
        "effectiveFeePerVsize": 5.243362831858407,
        "firstSeen": 1734893382,
        "uid": 429139,
        "inputs": [],
        "cpfpDirty": false,
        "ancestors": [],
        "descendants": [],
        "bestDescendant": null,
        "position": {
          "block": 0,
          "vsize": 125270
        },
        "flags": 1099511628809
      },
      ...
    ],
    "removed": [],
    "mined": [],
    "replaced": []
  }
}`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'mempool',
    fragment: 'track-mempool-txids',
    title: 'Track Mempool Txids',
    description: {
      default: 'Low-bandwith substitute to the above command <code>track-mempool</code>: subscribe to new mempool events, such as new transactions entering the mempool, but only transaction IDs are returned to save bandwith. Available fields: <code>added</code>, <code>removed</code>, <code>mined</code>, <code>replaced</code>.'
    },
    payload: '{ "track-mempool-txids": true }',
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: false,
    codeExample: {
      default: {
        codeTemplate: {
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "mempool-txids": {
    "sequence": 79919,
    "added": [
      "4bbb648ab194aaaf9188bccc6efcdcbb59c8485115a7384972c8287782206a0f",
      "f7883f3784829d1e741e696bdceec488eeb53fe0b69b0eca574ac9f2e7e8e117",
      "784e8e3b182c29798660bf42befb5c6479148c7d90c0d6eea032b89418e7cc3b",
      "d3920a7be05269d859bd89b08a6546dc6d6dd523dbc5f7b62b9c0c5eedc43292",
      "de6078d584cb5f4a27c3f0bb3d8bbb16b3d5f8303237391f390d0ee9e84d0099",
      "39fcbd6e0ec0ad49405f19c72bb033f578147181b77dbe47044f80b0b7604ab5",
      "47ed060004fab3fb5fa4885008aa2cadbe3335655f1303231abfe89b4b0c9bd9"
    ],
    "removed": [],
    "mined": [],
    "replaced": []
  }
}`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "mempool-txids": {
    "sequence": 79919,
    "added": [
      "4bbb648ab194aaaf9188bccc6efcdcbb59c8485115a7384972c8287782206a0f",
      "f7883f3784829d1e741e696bdceec488eeb53fe0b69b0eca574ac9f2e7e8e117",
      "784e8e3b182c29798660bf42befb5c6479148c7d90c0d6eea032b89418e7cc3b",
      "d3920a7be05269d859bd89b08a6546dc6d6dd523dbc5f7b62b9c0c5eedc43292",
      "de6078d584cb5f4a27c3f0bb3d8bbb16b3d5f8303237391f390d0ee9e84d0099",
      "39fcbd6e0ec0ad49405f19c72bb033f578147181b77dbe47044f80b0b7604ab5",
      "47ed060004fab3fb5fa4885008aa2cadbe3335655f1303231abfe89b4b0c9bd9"
    ],
    "removed": [],
    "mined": [],
    "replaced": []
  }
}`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "mempool-txids": {
    "sequence": 79919,
    "added": [
      "4bbb648ab194aaaf9188bccc6efcdcbb59c8485115a7384972c8287782206a0f",
      "f7883f3784829d1e741e696bdceec488eeb53fe0b69b0eca574ac9f2e7e8e117",
      "784e8e3b182c29798660bf42befb5c6479148c7d90c0d6eea032b89418e7cc3b",
      "d3920a7be05269d859bd89b08a6546dc6d6dd523dbc5f7b62b9c0c5eedc43292",
      "de6078d584cb5f4a27c3f0bb3d8bbb16b3d5f8303237391f390d0ee9e84d0099",
      "39fcbd6e0ec0ad49405f19c72bb033f578147181b77dbe47044f80b0b7604ab5",
      "47ed060004fab3fb5fa4885008aa2cadbe3335655f1303231abfe89b4b0c9bd9"
    ],
    "removed": [],
    "mined": [],
    "replaced": []
  }
}`
        },
        codeSampleLiquid: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "mempool-txids": {
    "sequence": 79919,
    "added": [
      "4bbb648ab194aaaf9188bccc6efcdcbb59c8485115a7384972c8287782206a0f",
      "f7883f3784829d1e741e696bdceec488eeb53fe0b69b0eca574ac9f2e7e8e117",
      "784e8e3b182c29798660bf42befb5c6479148c7d90c0d6eea032b89418e7cc3b",
      "d3920a7be05269d859bd89b08a6546dc6d6dd523dbc5f7b62b9c0c5eedc43292",
      "de6078d584cb5f4a27c3f0bb3d8bbb16b3d5f8303237391f390d0ee9e84d0099",
      "39fcbd6e0ec0ad49405f19c72bb033f578147181b77dbe47044f80b0b7604ab5",
      "47ed060004fab3fb5fa4885008aa2cadbe3335655f1303231abfe89b4b0c9bd9"
    ],
    "removed": [],
    "mined": [],
    "replaced": []
  }
}`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'mempool',
    fragment: 'track-mempool-block',
    title: 'Track Mempool Block',
    description: {
      default: 'Subscribe to live mempool projected block template, index 0 being the first mempool block. <br> A full set of stripped transactions in that block is returned when the subscription starts, and deltas (removed and added transactions) are then sent every time the mempool changes.'
    },
    payload: '{ "track-mempool-block": 0 }',
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: false,
    codeExample: {
      default: {
        codeTemplate: {
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "projected-block-transactions": {
    "index": 0,
    "sequence": 80270,
    "delta": {
      "added": [
        [
          "172b34fb099d80f61b65d1c107c4f25665c8f50e30c1371b2e6fbced62991d58",
          2000,
          171.25,
          5942725,
          11.68,
          1099511631877,
          1734881537
        ],
        ...
      ],
      "removed": [
        "956a6eee382214631c3299e0410565e05fbd6328c89fa746efab6371705aca2a",
        ...
        ],
      "changed": []
    }
  }
}`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "projected-block-transactions": {
    "index": 0,
    "sequence": 80270,
    "delta": {
      "added": [
        [
          "172b34fb099d80f61b65d1c107c4f25665c8f50e30c1371b2e6fbced62991d58",
          2000,
          171.25,
          5942725,
          11.68,
          1099511631877,
          1734881537
        ],
        ...
      ],
      "removed": [
        "956a6eee382214631c3299e0410565e05fbd6328c89fa746efab6371705aca2a",
        ...
        ],
      "changed": []
    }
  }
}`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "projected-block-transactions": {
    "index": 0,
    "sequence": 80270,
    "delta": {
      "added": [
        [
          "172b34fb099d80f61b65d1c107c4f25665c8f50e30c1371b2e6fbced62991d58",
          2000,
          171.25,
          5942725,
          11.68,
          1099511631877,
          1734881537
        ],
        ...
      ],
      "removed": [
        "956a6eee382214631c3299e0410565e05fbd6328c89fa746efab6371705aca2a",
        ...
        ],
      "changed": []
    }
  }
}`
        },
        codeSampleLiquid: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "projected-block-transactions": {
    "index": 0,
    "sequence": 80270,
    "delta": {
      "added": [
        [
          "172b34fb099d80f61b65d1c107c4f25665c8f50e30c1371b2e6fbced62991d58",
          2000,
          171.25,
          5942725,
          11.68,
          1099511631877,
          1734881537
        ],
        ...
      ],
      "removed": [
        "956a6eee382214631c3299e0410565e05fbd6328c89fa746efab6371705aca2a",
        ...
        ],
      "changed": []
    }
  }
}`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'mempool',
    fragment: 'track-rbf',
    title: 'Track Mempool RBF Transactions',
    description: {
      default: 'Subscribe to new RBF events.'
    },
    payload: '{ "track-rbf": "all" }',
    showConditions: bitcoinNetworks,
    showJsExamples: false,
    codeExample: {
      default: {
        codeTemplate: {
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "rbfLatest": [
    {
      "tx": {
        "txid": "cc6cb210f7ec32660fe4d46984ef64b64143fb02dc7ed70578c32b5f338ef6d6",
        "fee": 8280,
        "vsize": 204,
        "value": 156397,
        "rate": 10,
        "time": 1734876576,
        "rbf": true,
        "fullRbf": false
      },
      "time": 1734876576,
      "fullRbf": false,
      "replaces": [
        {
          "tx": {
            "txid": "4e94c23e075cf9c2b4ccaf32e3652b8b1bfecca6726390ccab821417f23b0876",
            "fee": 4956,
            "vsize": 204,
            "value": 159721,
            "rate": 9,
            "time": 1734876204,
            "rbf": true,
            "fullRbf": false
          },
          "time": 1734876204,
          "fullRbf": false,
          "replaces": [
            {
              "tx": {
                "txid": "9624fe4f9a183dcea2e8c6b640394eecaec37363aec883a64358f6953fba3145",
                "fee": 1632,
                "vsize": 204,
                "value": 163045,
                "rate": 8,
                "time": 1734876081,
                "rbf": true
              },
              "time": 1734876081,
              "interval": 123,
              "fullRbf": false,
              "replaces": []
            }
          ],
          "interval": 372
        }
      ]
    },
    ...
  ]
}`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "rbfLatest": [
    {
      "tx": {
        "txid": "cc6cb210f7ec32660fe4d46984ef64b64143fb02dc7ed70578c32b5f338ef6d6",
        "fee": 8280,
        "vsize": 204,
        "value": 156397,
        "rate": 10,
        "time": 1734876576,
        "rbf": true,
        "fullRbf": false
      },
      "time": 1734876576,
      "fullRbf": false,
      "replaces": [
        {
          "tx": {
            "txid": "4e94c23e075cf9c2b4ccaf32e3652b8b1bfecca6726390ccab821417f23b0876",
            "fee": 4956,
            "vsize": 204,
            "value": 159721,
            "rate": 9,
            "time": 1734876204,
            "rbf": true,
            "fullRbf": false
          },
          "time": 1734876204,
          "fullRbf": false,
          "replaces": [
            {
              "tx": {
                "txid": "9624fe4f9a183dcea2e8c6b640394eecaec37363aec883a64358f6953fba3145",
                "fee": 1632,
                "vsize": 204,
                "value": 163045,
                "rate": 8,
                "time": 1734876081,
                "rbf": true
              },
              "time": 1734876081,
              "interval": 123,
              "fullRbf": false,
              "replaces": []
            }
          ],
          "interval": 372
        }
      ]
    },
    ...
  ]
}`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "rbfLatest": [
    {
      "tx": {
        "txid": "cc6cb210f7ec32660fe4d46984ef64b64143fb02dc7ed70578c32b5f338ef6d6",
        "fee": 8280,
        "vsize": 204,
        "value": 156397,
        "rate": 10,
        "time": 1734876576,
        "rbf": true,
        "fullRbf": false
      },
      "time": 1734876576,
      "fullRbf": false,
      "replaces": [
        {
          "tx": {
            "txid": "4e94c23e075cf9c2b4ccaf32e3652b8b1bfecca6726390ccab821417f23b0876",
            "fee": 4956,
            "vsize": 204,
            "value": 159721,
            "rate": 9,
            "time": 1734876204,
            "rbf": true,
            "fullRbf": false
          },
          "time": 1734876204,
          "fullRbf": false,
          "replaces": [
            {
              "tx": {
                "txid": "9624fe4f9a183dcea2e8c6b640394eecaec37363aec883a64358f6953fba3145",
                "fee": 1632,
                "vsize": 204,
                "value": 163045,
                "rate": 8,
                "time": 1734876081,
                "rbf": true
              },
              "time": 1734876081,
              "interval": 123,
              "fullRbf": false,
              "replaces": []
            }
          ],
          "interval": 372
        }
      ]
    },
    ...
  ]
}`
        },
        codeSampleLiquid: emptyCodeSample
      }
    }
  },
  {
    type: 'endpoint',
    category: 'mempool',
    fragment: 'track-full-rbf',
    title: 'Track Mempool Full RBF Transactions',
    description: {
      default: 'Subscribe to new Full RBF events.'
    },
    payload: '{ "track-rbf": "fullRbf" }',
    showConditions: bitcoinNetworks,
    showJsExamples: false,
    codeExample: {
      default: {
        codeTemplate: {
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "rbfLatest": [
    {
      "tx": {
        "txid": "ed9e1ec0e1635d465ee95c8872efff367d420fc2c4e624bada2c6e6e6c8e0629",
        "fee": 4123,
        "vsize": 587.75,
        "value": 25545,
        "rate": 7.014887282007656,
        "time": 1734876941,
        "rbf": false,
        "fullRbf": true
      },
      "time": 1734876941,
      "fullRbf": true,
      "replaces": [
        {
          "tx": {
            "txid": "495ad5d39d44286e99bc45d104605407325cd4790f842dc3287fbfdda8ee5795",
            "fee": 1178,
            "vsize": 587.25,
            "value": 28490,
            "rate": 2.0059599829714774,
            "time": 1734853572,
            "rbf": false,
            "fullRbf": true
          },
          "time": 1734853572,
          "fullRbf": true,
          "replaces": [
            {
              "tx": {
                "txid": "189751a7560a6c39deb9a93db2a27374842c646268d0007ba52aefa189833afa",
                "fee": 589,
                "vsize": 587.25,
                "value": 29079,
                "rate": 1.0029799914857387,
                "time": 1734781955,
                "rbf": false
              },
              "time": 1734781955,
              "interval": 71617,
              "fullRbf": true,
              "replaces": []
            }
          ],
          "interval": 23369
        }
      ]
    },
    ...
  ]
}`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "rbfLatest": [
    {
      "tx": {
        "txid": "ed9e1ec0e1635d465ee95c8872efff367d420fc2c4e624bada2c6e6e6c8e0629",
        "fee": 4123,
        "vsize": 587.75,
        "value": 25545,
        "rate": 7.014887282007656,
        "time": 1734876941,
        "rbf": false,
        "fullRbf": true
      },
      "time": 1734876941,
      "fullRbf": true,
      "replaces": [
        {
          "tx": {
            "txid": "495ad5d39d44286e99bc45d104605407325cd4790f842dc3287fbfdda8ee5795",
            "fee": 1178,
            "vsize": 587.25,
            "value": 28490,
            "rate": 2.0059599829714774,
            "time": 1734853572,
            "rbf": false,
            "fullRbf": true
          },
          "time": 1734853572,
          "fullRbf": true,
          "replaces": [
            {
              "tx": {
                "txid": "189751a7560a6c39deb9a93db2a27374842c646268d0007ba52aefa189833afa",
                "fee": 589,
                "vsize": 587.25,
                "value": 29079,
                "rate": 1.0029799914857387,
                "time": 1734781955,
                "rbf": false
              },
              "time": 1734781955,
              "interval": 71617,
              "fullRbf": true,
              "replaces": []
            }
          ],
          "interval": 23369
        }
      ]
    },
    ...
  ]
}`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "rbfLatest": [
    {
      "tx": {
        "txid": "ed9e1ec0e1635d465ee95c8872efff367d420fc2c4e624bada2c6e6e6c8e0629",
        "fee": 4123,
        "vsize": 587.75,
        "value": 25545,
        "rate": 7.014887282007656,
        "time": 1734876941,
        "rbf": false,
        "fullRbf": true
      },
      "time": 1734876941,
      "fullRbf": true,
      "replaces": [
        {
          "tx": {
            "txid": "495ad5d39d44286e99bc45d104605407325cd4790f842dc3287fbfdda8ee5795",
            "fee": 1178,
            "vsize": 587.25,
            "value": 28490,
            "rate": 2.0059599829714774,
            "time": 1734853572,
            "rbf": false,
            "fullRbf": true
          },
          "time": 1734853572,
          "fullRbf": true,
          "replaces": [
            {
              "tx": {
                "txid": "189751a7560a6c39deb9a93db2a27374842c646268d0007ba52aefa189833afa",
                "fee": 589,
                "vsize": 587.25,
                "value": 29079,
                "rate": 1.0029799914857387,
                "time": 1734781955,
                "rbf": false
              },
              "time": 1734781955,
              "interval": 71617,
              "fullRbf": true,
              "replaces": []
            }
          ],
          "interval": 23369
        }
      ]
    },
    ...
  ]
}`
        },
        codeSampleLiquid: emptyCodeSample
      }
    }
  },

];

export const restApiDocsData = [
  {
    type: 'category',
    category: 'general',
    fragment: 'general',
    title: 'General',
    showConditions: bitcoinNetworks,
  },
  {
    type: 'endpoint',
    category: 'general',
    httpRequestMethod: 'GET',
    fragment: 'get-difficulty-adjustment',
    title: 'GET Difficulty',
    description: {
      default: 'Returns the current qbit difficulty state. qbit retargets every block via ASERT (2h halflife), so there is no epoch progress or scheduled retarget; the payload reports the latest difficulty/target, the rolling average block interval over the last ~60 blocks, and the difficulty delta vs ~1440 blocks ago.'
    },
    urlString: '/v1/difficulty-adjustment',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          commonJS: `
        const { %{0}: { difficulty } } = mempoolJS();

        const difficultyAdjustment = await difficulty.getDifficultyAdjustment();

        document.getElementById("result").textContent = JSON.stringify(difficultyAdjustment, undefined, 2);
          `,
          esModule: `
  const { %{0}: { difficulty } } = mempoolJS();

  const difficultyAdjustment = await difficulty.getDifficultyAdjustment();
  console.log(difficultyAdjustment);
          `,
          curl: `/api/v1/difficulty-adjustment`,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  asertActive: true,
  currentBits: 486604799,
  currentTarget: "00000000ffff0000000000000000000000000000000000000000000000000000",
  currentDifficulty: 1.52,
  timeAvgMs: 61250,
  targetSpacingMs: 60000,
  change24h: 1.84,
  previousTime: 1752192000000,
  timeAvg: 61250,
  adjustedTimeAvg: 61250,
  timeOffset: 0
}`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  asertActive: true,
  currentBits: 486604799,
  currentTarget: "00000000ffff0000000000000000000000000000000000000000000000000000",
  currentDifficulty: 1.52,
  timeAvgMs: 61250,
  targetSpacingMs: 60000,
  change24h: 1.84,
  previousTime: 1752192000000,
  timeAvg: 61250,
  adjustedTimeAvg: 61250,
  timeOffset: 0
}`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  asertActive: true,
  currentBits: 486604799,
  currentTarget: "00000000ffff0000000000000000000000000000000000000000000000000000",
  currentDifficulty: 1.52,
  timeAvgMs: 61250,
  targetSpacingMs: 60000,
  change24h: 1.84,
  previousTime: 1752192000000,
  timeAvg: 61250,
  adjustedTimeAvg: 61250,
  timeOffset: 0
}`
        },
        codeSampleLiquid: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  asertActive: true,
  currentBits: 486604799,
  currentTarget: "00000000ffff0000000000000000000000000000000000000000000000000000",
  currentDifficulty: 1.52,
  timeAvgMs: 61250,
  targetSpacingMs: 60000,
  change24h: 1.84,
  previousTime: 1752192000000,
  timeAvg: 61250,
  adjustedTimeAvg: 61250,
  timeOffset: 0
}`
        }
      }
    }
  },
  {
    type: 'endpoint',
    category: 'general',
    httpRequestMethod: 'GET',
    fragment: 'get-price',
    title: 'GET Price',
    description: {
      default: 'Returns the latest QBT price denominated in main currencies.'
    },
    urlString: '/v1/prices',
    showConditions: [''],
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          commonJS: ``,
          esModule: ``,
          curl: `/api/v1/prices`,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  time: 1703252411,
  USD: 43753,
  EUR: 40545,
  GBP: 37528,
  CAD: 58123,
  CHF: 37438,
  AUD: 64499,
  JPY: 6218915
}`
        },
        codeSampleTestnet: emptyCodeSample,
        codeSampleSignet: emptyCodeSample,
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
      }
    }
  },
  {
    type: 'endpoint',
    category: 'general',
    httpRequestMethod: 'GET',
    fragment: 'get-historical-price',
    title: 'GET Historical Price',
    description: {
      default: 'Returns historical QBT prices denominated in main currencies. Available query parameters: <code>currency</code>, <code>timestamp</code>. If no parameter is provided, the full price history for all currencies is returned.'
    },
    urlString: '/v1/historical-price?currency=EUR&timestamp=1500000000',
    showConditions: [''],
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          commonJS: ``,
          esModule: ``,
          curl: `/api/v1/historical-price?currency=EUR&timestamp=1500000000`,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  prices: [
    {
      "time": 1499904000,
      "EUR": 1964,
      "USD": 2254.9
    }
  ],
  exchangeRates: {
    "USDEUR": 0.92,
    "USDGBP": 0.78,
    "USDCAD": 1.36,
    "USDCHF": 0.89,
    "USDAUD": 1.53,
    "USDJPY": 149.48
  }
}
`
        },
        codeSampleTestnet: emptyCodeSample,
        codeSampleSignet: emptyCodeSample,
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
      }
    }
  },
  {
    type: 'category',
    category: 'addresses',
    fragment: 'addresses',
    title: 'Addresses',
    showConditions: bitcoinNetworks.concat(liquidNetworks)
  },
  {
    type: 'endpoint',
    category: 'addresses',
    httpRequestMethod: 'GET',
    fragment: 'get-address',
    title: 'GET Address',
    description: {
      default: 'Returns details about an address. Available fields: <code>address</code>, <code>chain_stats</code>, and <code>mempool_stats</code>. <code>chain_stats</code> and <code>mempool_stats</code> each contain an object with <code>tx_count</code>, <code>funded_txo_count</code>, <code>funded_txo_sum</code>, <code>spent_txo_count</code>, and <code>spent_txo_sum</code>.'
    },
    urlString: '/address/:address',
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/address/%{1}`,
          commonJS: `
        const { %{0}: { addresses } } = mempoolJS();

        const address = '%{1}';
        const myAddress = await addresses.getAddress({ address });

        document.getElementById("result").textContent = JSON.stringify(myAddress, undefined, 2);
        `,
          esModule: `
  const { %{0}: { addresses } } = mempoolJS();

  const address = '%{1}';
  const myAddress = await addresses.getAddress({ address });
  console.log(myAddress);
          `,
        },
        codeSampleMainnet: {
          esModule: [`qb1zjrtrlj26qhlr0qze7x9fszx0aa8k268d48n3gmc097zjugk87qrsq9l22h`],
          commonJS: [`qb1zjrtrlj26qhlr0qze7x9fszx0aa8k268d48n3gmc097zjugk87qrsq9l22h`],
          curl: [`qb1zjrtrlj26qhlr0qze7x9fszx0aa8k268d48n3gmc097zjugk87qrsq9l22h`],
          response: `{
  address: "qb1zjrtrlj26qhlr0qze7x9fszx0aa8k268d48n3gmc097zjugk87qrsq9l22h",
  chain_stats: {
    funded_txo_count: 71,
    funded_txo_sum: 773647491,
    spent_txo_count: 70,
    spent_txo_sum: 770387671,
    tx_count: 71
  },
  mempool_stats: {
    funded_txo_count: 0,
    funded_txo_sum: 0,
    spent_txo_count: 0,
    spent_txo_sum: 0,
    tx_count: 0
  }
}`
        },
        codeSampleTestnet: {
          esModule: [`tq1z6ytlr3s5969w0wpz9mzkcwx57qv3ndjgkrhj98mt9zl8z7ja6y9qkglrns`],
          commonJS: [`tq1z6ytlr3s5969w0wpz9mzkcwx57qv3ndjgkrhj98mt9zl8z7ja6y9qkglrns`],
          curl: [`tq1z6ytlr3s5969w0wpz9mzkcwx57qv3ndjgkrhj98mt9zl8z7ja6y9qkglrns`],
          response: `{
  address: "tq1z6ytlr3s5969w0wpz9mzkcwx57qv3ndjgkrhj98mt9zl8z7ja6y9qkglrns",
  chain_stats: {
    funded_txo_count: 9,
    funded_txo_sum: 9957056,
    spent_txo_count: 0,
    spent_txo_sum: 0,
    tx_count: 9
  },
  mempool_stats: {
    funded_txo_count: 0,
    funded_txo_sum: 0,
    spent_txo_count: 0,
    spent_txo_sum: 0,
    tx_count: 0
  }
}`
        },
        codeSampleSignet: {
          esModule: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          commonJS: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          curl: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          response: `{
  address: "1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv",
  chain_stats: {
    funded_txo_count: 5,
    funded_txo_sum: 15007599040,
    spent_txo_count: 5,
    spent_txo_sum: 15007599040,
    tx_count: 7
  },
  mempool_stats: {
    funded_txo_count: 0,
    funded_txo_sum: 0,
    spent_txo_count: 0,
    spent_txo_sum: 0,
    tx_count: 0
  }
}`
        },
        codeSampleLiquid: {
          esModule: [`Go65t19hP2FuhBMYtgbdMDgdmEzNwh1i48`],
          commonJS: [`Go65t19hP2FuhBMYtgbdMDgdmEzNwh1i48`],
          curl: [`Go65t19hP2FuhBMYtgbdMDgdmEzNwh1i48`],
          response: `{
  address: "Go65t19hP2FuhBMYtgbdMDgdmEzNwh1i48",
  chain_stats: {
    funded_txo_count: 1,
    spent_txo_count: 1,
    tx_count: 2
  },
  mempool_stats: {
    funded_txo_count: 0,
    spent_txo_count: 0,
    tx_count: 0
  }
}`
        },
        codeSampleLiquidTestnet: {
          esModule: [`vjTwFjtVE7Fy9gjwQSxas9FkrqcnK1SeobPkdD9tghdNmCvxoXhSeCjpgD3ponKJukkD2BNPX25dZL48`],
          commonJS: [`vjTwFjtVE7Fy9gjwQSxas9FkrqcnK1SeobPkdD9tghdNmCvxoXhSeCjpgD3ponKJukkD2BNPX25dZL48`],
          curl: [`vjTwFjtVE7Fy9gjwQSxas9FkrqcnK1SeobPkdD9tghdNmCvxoXhSeCjpgD3ponKJukkD2BNPX25dZL48`],
          response: `{
  address: "vjTwFjtVE7Fy9gjwQSxas9FkrqcnK1SeobPkdD9tghdNmCvxoXhSeCjpgD3ponKJukkD2BNPX25dZL48",
  chain_stats: {
    funded_txo_count: 1,
    spent_txo_count: 0,
    tx_count: 1
  },
  mempool_stats: {
    funded_txo_count: 0,
    spent_txo_count: 0,
    tx_count: 0
  }
}`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'addresses',
    httpRequestMethod: 'GET',
    fragment: 'get-address-transactions',
    title: 'GET Address Transactions',
    description: {
      default: 'Get transaction history for the specified address/scripthash, sorted with newest first. Returns up to 50 mempool transactions plus the first 25 confirmed transactions. You can request more confirmed transactions using an <code>after_txid</code> query parameter.'
    },
    urlString: '/address/:address/txs',
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/address/%{1}/txs`,
          commonJS: `
        const { %{0}: { addresses } } = mempoolJS();

        const address = '%{1}';
        const addressTxs = await addresses.getAddressTxs({ address });

        document.getElementById("result").textContent = JSON.stringify(addressTxs, undefined, 2);
        `,
          esModule: `
  const { %{0}: { addresses } } = mempoolJS();

  const address = '%{1}';
  const addressTxs = await addresses.getAddressTxs({ address });
  console.log(addressTxs);
          `,
        },
        codeSampleMainnet: {
          esModule: [`qb1zjrtrlj26qhlr0qze7x9fszx0aa8k268d48n3gmc097zjugk87qrsq9l22h`],
          commonJS: [`qb1zjrtrlj26qhlr0qze7x9fszx0aa8k268d48n3gmc097zjugk87qrsq9l22h`],
          curl: [`qb1zjrtrlj26qhlr0qze7x9fszx0aa8k268d48n3gmc097zjugk87qrsq9l22h`],
          response: `[
  {
    txid: "053486685773077b30fcfeddd15e8d3e325502615a2cc173121d24631f78765b",
    version: 2,
    locktime: 0,
    vin: [ [Object] ],
    vout: [ [Object], [Object], [Object] ],
    size: 3924,
    weight: 3924,
    fee: 51394,
    status: {
      confirmed: true,
      block_height: 161388,
      block_hash: "0000000000000001375acbbf5381a88f9de4a13f9383ad3d03707b274f03b277",
      block_time: 1793833342
    }
  },
  ...
]`
        },
        codeSampleTestnet: {
          esModule: [`tq1z6ytlr3s5969w0wpz9mzkcwx57qv3ndjgkrhj98mt9zl8z7ja6y9qkglrns`],
          commonJS: [`tq1z6ytlr3s5969w0wpz9mzkcwx57qv3ndjgkrhj98mt9zl8z7ja6y9qkglrns`],
          curl: [`tq1z6ytlr3s5969w0wpz9mzkcwx57qv3ndjgkrhj98mt9zl8z7ja6y9qkglrns`],
          response: `[
    {
      txid: "264e3ae1eedd4f1ed900a9ff0bff0b6d59c27d6e1e7c9f7197be50e617441c96",
      version: 2,
      locktime: 0,
      vin: [ [Object] ],
      vout: [ [Object], [Object], ... ],
      size: 287672,
      weight: 287672,
      fee: 287672,
      status: {
        confirmed: true,
        block_height: 202344,
        block_hash: "a9855f9a4ef0aaa670e7821361d511288df5fd45ec672c80ce69c856fc5a6241",
        block_time: 1793833005
    }
  },
  ...
]`
        },
        codeSampleSignet: {
          esModule: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          commonJS: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          curl: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          response: `{
  address: "1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv",
  chain_stats: {
    funded_txo_count: 5,
    funded_txo_sum: 15007599040,
    spent_txo_count: 5,
    spent_txo_sum: 15007599040,
    tx_count: 7
  },
  mempool_stats: {
    funded_txo_count: 0,
    funded_txo_sum: 0,
    spent_txo_count: 0,
    spent_txo_sum: 0,
    tx_count: 0
  }
}`
        },
        codeSampleLiquid: {
          esModule: [`Go65t19hP2FuhBMYtgbdMDgdmEzNwh1i48`],
          commonJS: [`Go65t19hP2FuhBMYtgbdMDgdmEzNwh1i48`],
          curl: [`Go65t19hP2FuhBMYtgbdMDgdmEzNwh1i48`],
          response: `[
  {
    txid: "e792f305016fdce71ba4a9c3057279df2b67a7a3e6147b173847a8253ad531ed",
    version: 2,
    locktime: 1438076,
    vin: [Object],
    vout: [Object],
    size: 9205,
    weight: 10492,
    fee: 262,
    status: {
      confirmed: true,
      block_height: 1438078,
      block_hash: "1625ce898d2058f4e609af2e81908ce52eba77dde099667bea68360b5679d5df",
      block_time: 1628564158
    }
  },
  ...
]`
        },
        codeSampleLiquidTestnet: {
          esModule: [`vjTwFjtVE7Fy9gjwQSxas9FkrqcnK1SeobPkdD9tghdNmCvxoXhSeCjpgD3ponKJukkD2BNPX25dZL48`],
          commonJS: [`vjTwFjtVE7Fy9gjwQSxas9FkrqcnK1SeobPkdD9tghdNmCvxoXhSeCjpgD3ponKJukkD2BNPX25dZL48`],
          curl: [`vjTwFjtVE7Fy9gjwQSxas9FkrqcnK1SeobPkdD9tghdNmCvxoXhSeCjpgD3ponKJukkD2BNPX25dZL48`],
          response: `[
  {
    txid: "67108f445ae3a363452cf7f382f1b71e06126ab958673debbeaad6dab4831434",
    version: 2,
    locktime: 0,
    vin: [Object],
    vout: [Object],
    size: 8968,
    weight: 10063,
    fee: 260,
    status: {
      confirmed: true,
      block_height: 165253,
      block_hash: "c8b6233c3bc53b76cf3a629328c3e7826a749171a8b39b482daf73e0be266e09",
      block_time: 1641788900
    }
  },
  ...
]`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'addresses',
    httpRequestMethod: 'GET',
    fragment: 'get-address-transactions-chain',
    title: 'GET Address Transactions Chain',
    description: {
      default: 'Get confirmed transaction history for the specified address/scripthash, sorted with newest first. Returns 25 transactions per page. More can be requested by specifying the last txid seen by the previous query: <code>/address/:address/txs/chain/:last_seen_txid</code>.'
    },
    urlString: '/address/:address/txs/chain',
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/address/%{1}/txs/chain`,
          commonJS: `
        const { %{0}: { addresses } } = mempoolJS();

        const address = '%{1}';
        const addressTxsChain = await addresses.getAddressTxsChain({ address });

        document.getElementById("result").textContent = JSON.stringify(addressTxsChain, undefined, 2);
        `,
          esModule: `
  const { %{0}: { addresses } } = mempoolJS();

  const address = '%{1}';
  const addressTxsChain = await addresses.getAddressTxsChain({ address });
  console.log(addressTxsChain);
          `,
        },
        codeSampleMainnet: {
          esModule: [`qb1zjrtrlj26qhlr0qze7x9fszx0aa8k268d48n3gmc097zjugk87qrsq9l22h`],
          commonJS: [`qb1zjrtrlj26qhlr0qze7x9fszx0aa8k268d48n3gmc097zjugk87qrsq9l22h`],
          curl: [`qb1zjrtrlj26qhlr0qze7x9fszx0aa8k268d48n3gmc097zjugk87qrsq9l22h`],
          response: `[
  {
    "txid": "6efb9eb45c0bfc810bcb2a3a11bee258a93ec8f76035ce6d243ba0cc036f1151",
    "version": 2,
    "locktime": 0,
    "vin": [
      {
        "txid": "708a7f3cca31f5aafaeb86975604022cf0a5cbfce89656b56b798081711d5e48",
        "vout": 2,
        "prevout": {
          "scriptpubkey": "522090d63fc95a05fe378059f18a9808cfef4f6568eda9e7146f0f2f852e22c7f007",
          "scriptpubkey_asm": "OP_PUSHNUM_2 OP_PUSHBYTES_32 90d63fc95a05fe378059f18a9808cfef4f6568eda9e7146f0f2f852e22c7f007",
          "scriptpubkey_type": "v2_p2mr",
          "scriptpubkey_address": "qb1zjrtrlj26qhlr0qze7x9fszx0aa8k268d48n3gmc097zjugk87qrsq9l22h",
          "value": 6502485
        },
        "scriptsig": "",
        "scriptsig_asm": "",
        "witness": [
          "f6fae2f7e853f4e0d04701731bddac939592ca79b25a35c113ad81c76e4ab0e6...",
          ...
        ],
        "is_coinbase": false,
        "sequence": 4294967293,
        "inner_witnessscript_asm": "OP_PUSHBYTES_32 583e99acbe68d35478e2de0c81baa1f02a694f20e95ea7fdb84972a087bc493b OP_CHECKSIGPQC"
      }
    ],
    "vout": [
      {
        "scriptpubkey": "6a387b2270223a22716269742d3230222c226f70223a226d696e74222c227469636b223a224d454d45222c22616d74223a22323030303030227d",
        "scriptpubkey_asm": "OP_RETURN OP_PUSHBYTES_56 7b2270223a22716269742d3230222c226f7022...",
        "scriptpubkey_type": "op_return",
        "value": 0
      },
      ...
    ],
    "size": 3927,
    "weight": 3927,
    "vsize": 3927,
    "sigops": 0,
    "fee": 361587,
    "status": {
      "confirmed": true,
      "block_height": 168102,
      "block_hash": "00000000000000016fa098ad4e2cc08467b641089120f5125438c918133bfcf3",
      "block_time": 1794240259
    }
  },
  ...
]`
        },
        codeSampleTestnet: {
          esModule: [`tq1z6ytlr3s5969w0wpz9mzkcwx57qv3ndjgkrhj98mt9zl8z7ja6y9qkglrns`],
          commonJS: [`tq1z6ytlr3s5969w0wpz9mzkcwx57qv3ndjgkrhj98mt9zl8z7ja6y9qkglrns`],
          curl: [`tq1z6ytlr3s5969w0wpz9mzkcwx57qv3ndjgkrhj98mt9zl8z7ja6y9qkglrns`],
          response: `[
  {
    "txid": "ba2d67a7ae5d869170ecaf927383368d8cb52d2db01c7268df1f343bd24362fc",
    "version": 2,
    "locktime": 0,
    "vin": [
      {
        "txid": "5e7e1a93217029827e0829d5356951bdb887fc69efdea5919d039864b5888bc1",
        "vout": 0,
        "prevout": {
          "scriptpubkey": "5220ddba5296a1b1e1c2ab147327a5c0c55ed40a57e2d5ed2ce0f5524433b3825293",
          "scriptpubkey_asm": "OP_PUSHNUM_2 OP_PUSHBYTES_32 ddba5296a1b1e1c2ab147327a5c0c55ed40a57e2d5ed2ce0f5524433b3825293",
          "scriptpubkey_type": "v2_p2mr",
          "scriptpubkey_address": "tq1zmka9994pk8su92c5wvn6tsx9tm2q54lz6hkjec842fzr8vuz22fszzh956",
          "value": 23960
        },
        "scriptsig": "",
        "scriptsig_asm": "",
        "witness": [
          "0ed590cf0b59718f34ddd2da0d0762f641e69d4289594fe73e7700cd8fe11f9a...",
          ...
        ],
        "is_coinbase": false,
        "sequence": 4294967294,
        "inner_witnessscript_asm": "OP_PUSHBYTES_32 a11f4736edb8fcb41bcf307543c22efda1ebb7020e9c615c..."
      }
    ],
    "vout": [
      {
        "scriptpubkey": "5220d117f1c6142e8ae7b8222ec56c38d4f01919b648b0ef229f6b28be717a5dd10a",
        "scriptpubkey_asm": "OP_PUSHNUM_2 OP_PUSHBYTES_32 d117f1c6142e8ae7b8222ec56c38d4f01919b648b0ef229f6b28be717a5dd10a",
        "scriptpubkey_type": "v2_p2mr",
        "scriptpubkey_address": "tq1z6ytlr3s5969w0wpz9mzkcwx57qv3ndjgkrhj98mt9zl8z7ja6y9qkglrns",
        "value": 10000
      },
      ...
    ],
    "size": 3960,
    "weight": 3960,
    "vsize": 3960,
    "sigops": 0,
    "fee": 3960,
    "status": {
      "confirmed": true,
      "block_height": 202432,
      "block_hash": "0000000000004566ada8ed167de2f48c8c3f9cd9c3ce661df41c9cb82811388f",
      "block_time": 1793838527
    }
  },
  ...
]`
        },
        codeSampleSignet: {
          esModule: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          commonJS: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          curl: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          response: `{
  address: "1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv",
  chain_stats: {
    funded_txo_count: 765,
    funded_txo_sum: 87749875807,
    spent_txo_count: 765,
    spent_txo_sum: 87749875807,
    tx_count: 875
  },
  mempool_stats: {
    funded_txo_count: 0,
    funded_txo_sum: 0,
    spent_txo_count: 0,
    spent_txo_sum: 0,
    tx_count: 0
  }
}`
        },
        codeSampleLiquid: {
          esModule: [`Go65t19hP2FuhBMYtgbdMDgdmEzNwh1i48`],
          commonJS: [`Go65t19hP2FuhBMYtgbdMDgdmEzNwh1i48`],
          curl: [`Go65t19hP2FuhBMYtgbdMDgdmEzNwh1i48`],
          response: `[
  {
    txid: "e792f305016fdce71ba4a9c3057279df2b67a7a3e6147b173847a8253ad531ed",
    version: 2,
    locktime: 1438076,
    vin: [],
    vout: [],
    size: 9205,
    weight: 10492,
    fee: 262,
    status: {
      confirmed: true,
      block_height: 1438078,
      block_hash: "1625ce898d2058f4e609af2e81908ce52eba77dde099667bea68360b5679d5df",
      block_time: 1628564158
    }
  },
  ...
]`
        },
        codeSampleLiquidTestnet: {
          esModule: [`vjTwFjtVE7Fy9gjwQSxas9FkrqcnK1SeobPkdD9tghdNmCvxoXhSeCjpgD3ponKJukkD2BNPX25dZL48`],
          commonJS: [`vjTwFjtVE7Fy9gjwQSxas9FkrqcnK1SeobPkdD9tghdNmCvxoXhSeCjpgD3ponKJukkD2BNPX25dZL48`],
          curl: [`vjTwFjtVE7Fy9gjwQSxas9FkrqcnK1SeobPkdD9tghdNmCvxoXhSeCjpgD3ponKJukkD2BNPX25dZL48`],
          response: `[
  {
    txid: "67108f445ae3a363452cf7f382f1b71e06126ab958673debbeaad6dab4831434",
    version: 2,
    locktime: 0,
    vin: [],
    vout: [],
    size: 8968,
    weight: 10063,
    fee: 260,
    status: {
      confirmed: true,
      block_height: 165253,
      block_hash: "c8b6233c3bc53b76cf3a629328c3e7826a749171a8b39b482daf73e0be266e09",
      block_time: 1641788900
    }
  },
  ...
]`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'addresses',
    httpRequestMethod: 'GET',
    fragment: 'get-address-transactions-mempool',
    title: 'GET Address Transactions Mempool',
    description: {
      default: 'Get unconfirmed transaction history for the specified address/scripthash. Returns up to 50 transactions (no paging).'
    },
    urlString: '/address/:address/txs/mempool',
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/address/%{1}/txs/mempool`,
          commonJS: `
        const { %{0}: { addresses } } = mempoolJS();

        const address = '%{1}';
        const addressTxsMempool = await addresses.getAddressTxsMempool({ address });

        document.getElementById("result").textContent = JSON.stringify(addressTxsMempool, undefined, 2);
        `,
          esModule: `
  const { %{0}: { addresses } } = mempoolJS();

  const address = '%{1}';
  const addressTxsMempool = await addresses.getAddressTxsMempool({ address });
  console.log(addressTxsMempool);
          `,
        },
        codeSampleMainnet: {
          esModule: [`qb1zjrtrlj26qhlr0qze7x9fszx0aa8k268d48n3gmc097zjugk87qrsq9l22h`],
          commonJS: [`qb1zjrtrlj26qhlr0qze7x9fszx0aa8k268d48n3gmc097zjugk87qrsq9l22h`],
          curl: [`qb1zjrtrlj26qhlr0qze7x9fszx0aa8k268d48n3gmc097zjugk87qrsq9l22h`],
          response: `[]`
        },
        codeSampleTestnet: {
          esModule: [`tq1z6ytlr3s5969w0wpz9mzkcwx57qv3ndjgkrhj98mt9zl8z7ja6y9qkglrns`],
          commonJS: [`tq1z6ytlr3s5969w0wpz9mzkcwx57qv3ndjgkrhj98mt9zl8z7ja6y9qkglrns`],
          curl: [`tq1z6ytlr3s5969w0wpz9mzkcwx57qv3ndjgkrhj98mt9zl8z7ja6y9qkglrns`],
          response: `[]`
        },
        codeSampleSignet: {
          esModule: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          commonJS: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          curl: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          response: `[
  {
    txid: "16cd9bbc6b62313a22d16671fa559aec6bf581df8b5853d37775c84b0fddfa90",
    version: 2,
    locktime: 0,
    vin: [ [Object] ],
    vout: [ [Object], [Object] ],
    size: 226,
    weight: 904,
    fee: 6720,
    status: { confirmed: false }
  }
]`
        },
        codeSampleLiquid: {
          esModule: [`Go65t19hP2FuhBMYtgbdMDgdmEzNwh1i48`],
          commonJS: [`Go65t19hP2FuhBMYtgbdMDgdmEzNwh1i48`],
          curl: [`Go65t19hP2FuhBMYtgbdMDgdmEzNwh1i48`],
          response: `[
  {
    txid: "16cd9bbc6b62313a22d16671fa559aec6bf581df8b5853d37775c84b0fddfa90",
    version: 2,
    locktime: 0,
    vin: [ [Object] ],
    vout: [ [Object], [Object] ],
    size: 226,
    weight: 904,
    fee: 6720,
    status: { confirmed: false }
  }
]`
        },
        codeSampleLiquidTestnet: {
          esModule: [`928jXZPDqQAt5vzGvBXKWMKCS9vfCa9Rfu`],
          commonJS: [`928jXZPDqQAt5vzGvBXKWMKCS9vfCa9Rfu`],
          curl: [`928jXZPDqQAt5vzGvBXKWMKCS9vfCa9Rfu`],
          response: `[
  {
    txid: "3ab8bc068ee05c1114647dc5196b3b954b00e5af3b03d470d1ef8a8953737357",
    version: 2,
    locktime: 0,
    vin: [ [Object] ],
    vout: [ [Object], [Object] ],
    size: 14720,
    weight: 58880,
    fee: 1496,
    status: { confirmed: false }
  }
]`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'addresses',
    httpRequestMethod: 'GET',
    fragment: 'get-address-utxo',
    title: 'GET Address UTXO',
    description: {
      default: 'Get the list of unspent transaction outputs associated with the address/scripthash. Available fields: <code>txid</code>, <code>vout</code>, <code>value</code>, and <code>status</code> (with the status of the funding tx).',
      liquid: 'Get the list of unspent transaction outputs associated with the address/scripthash. Available fields: <code>txid</code>, <code>vout</code>, <code>value</code>, and <code>status</code> (with the status of the funding tx). There is also a <code>valuecommitment</code> field that may appear in place of <code>value</code>, plus the following additional fields: <code>asset</code>/<code>assetcommitment</code>, <code>nonce</code>/<code>noncecommitment</code>, <code>surjection_proof</code>, and <code>range_proof</code>.',
    },
    urlString: '/address/:address/utxo',
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/address/%{1}/utxo`,
          commonJS: `
        const { %{0}: { addresses } } = mempoolJS();

        const address = '%{1}';
        const addressTxsUtxo = await addresses.getAddressTxsUtxo({ address });

        document.getElementById("result").textContent = JSON.stringify(addressTxsUtxo, undefined, 2);
        `,
          esModule: `
  const { %{0}: { addresses } } = mempoolJS();

  const address = '%{1}';
  const addressTxsUtxo = await addresses.getAddressTxsUtxo({ address });
  console.log(addressTxsUtxo);
          `,
        },
        codeSampleMainnet: {
          esModule: [`qb1zjrtrlj26qhlr0qze7x9fszx0aa8k268d48n3gmc097zjugk87qrsq9l22h`],
          commonJS: [`qb1zjrtrlj26qhlr0qze7x9fszx0aa8k268d48n3gmc097zjugk87qrsq9l22h`],
          curl: [`qb1zjrtrlj26qhlr0qze7x9fszx0aa8k268d48n3gmc097zjugk87qrsq9l22h`],
          response: `[
  {
    txid: "053486685773077b30fcfeddd15e8d3e325502615a2cc173121d24631f78765b",
    vout: 2,
    status: {
      confirmed: true,
      block_height: 161388,
      block_hash: "0000000000000001375acbbf5381a88f9de4a13f9383ad3d03707b274f03b277",
      block_time: 1793833342
    },
    value: 3259820
  },
  ...
]`
        },
        codeSampleTestnet: {
          esModule: [`tq1z6ytlr3s5969w0wpz9mzkcwx57qv3ndjgkrhj98mt9zl8z7ja6y9qkglrns`],
          commonJS: [`tq1z6ytlr3s5969w0wpz9mzkcwx57qv3ndjgkrhj98mt9zl8z7ja6y9qkglrns`],
          curl: [`tq1z6ytlr3s5969w0wpz9mzkcwx57qv3ndjgkrhj98mt9zl8z7ja6y9qkglrns`],
          response: `[
  {
    txid: "a4f91b9b2afb7104d698fff4edb1de990caf554e37093bf4b1efc6447634f6f8",
    vout: 625,
    status: {
      confirmed: true,
      block_height: 202339,
      block_hash: "00000000000008e2c15b425074bfaee7871c5badbb83df7c0175691a6d7ee1fd",
      block_time: 1793832709
    },
    value: 10000
  },
  ...
]`
        },
        codeSampleSignet: {
          esModule: [`tb1pu8ysre22dcl6qy5m5w7mjwutw73w4u24slcdh4myq06uhr6q29dqwc3ckt`],
          commonJS: [`tb1pu8ysre22dcl6qy5m5w7mjwutw73w4u24slcdh4myq06uhr6q29dqwc3ckt`],
          curl: [`tb1pu8ysre22dcl6qy5m5w7mjwutw73w4u24slcdh4myq06uhr6q29dqwc3ckt`],
          response: `[
  {
    txid: "c56a054302df8f8f80c5ac6b86b24ed52bf41d64de640659837c56bc33d10c9e",
    vout: 0,
    status: {
      confirmed: true,
      block_height: 174923,
      block_hash: "000000750e335ff355be2e3754fdada30d107d7d916aef07e2f5d014bec845e5",
      block_time: 1703321003
    },
    value: 546
  },
  ...
]`
        },
        codeSampleLiquid: {
          esModule: [`GhkYnB1g6oNSqALtcHgpirYM65EuLZdaNg`],
          commonJS: [`GhkYnB1g6oNSqALtcHgpirYM65EuLZdaNg`],
          curl: [`GhkYnB1g6oNSqALtcHgpirYM65EuLZdaNg`],
          response: `[
  {
    txid: "067bac619cc67de7654bb3ee01ebcadf1e582980b3873478bac7d3931f06045f",
    vout: 1,
    status: {
      confirmed: true,
      block_height: 1471900,
      block_hash: "9408b32d41225cea32bace82aac1789a218e6592ab24de5793ca2138b876f536",
      block_time: 1630621258
    },
    valuecommitment: "0805015e56cbbf6cc494cb200615b7f8b781f0d640e4c96b4abdad356068f6346f",
    assetcommitment: "0a6bb828996381a61cb9f24610bea8a0c35efe388d39a993d369e08a6fc358e7dc",
    noncecommitment: "0282f3f01f06e43fb88bcd28e7e83c9c0d9cefc92c104a6e814810c100ec66b33d"
  }
]`,
        },
        codeSampleLiquidTestnet: {
          esModule: [`tex1q9f8nat57n93e8q0p6vddw9phew6u348uff8hqz`],
          commonJS: [`tex1q9f8nat57n93e8q0p6vddw9phew6u348uff8hqz`],
          curl: [`tex1q9f8nat57n93e8q0p6vddw9phew6u348uff8hqz`],
          response: `[
  {
    "txid": "b010ce1accf781234e9736243a33c5367ce76e3a12609cf70a80ad15679c57dd",
    "vout": 0,
    "status": {
      "confirmed": false
    },
    "valuecommitment": "087851b6faa9b97d3c87dba24d69456b4084c36529ca0bda8aebea3fca787ec298",
    "assetcommitment": "0b16b09f9987d7f7aaa8b6bd61f00e50b448ecb8b4ecf3623338b80e2533637848",
    "noncecommitment": "03ba8cf651bd77791ea6a208a9f7ab8482b1ea207e4e4b2e6e964ebd163f81afb7",
    "surjection_proof": "010001398a7d5ac645e45b27898ee4548b111c64cdf1850cf283dbdea89c3163d168d8...",
    "range_proof": "6033000000000000000116898801858209e1386655e803472959b95e706d47fca2bfad..."
  }
]`,
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'addresses',
    httpRequestMethod: 'GET',
    fragment: 'get-address-validate',
    title: 'GET Address Validation',
    description: {
      default: 'Returns whether an address is valid or not. Available fields: <code>isvalid</code> (boolean), <code>address</code> (string), <code>scriptPubKey</code> (string), <code>isscript</code> (boolean), <code>iswitness</code> (boolean), <code>witness_version</code> (numeric, optional), and <code>witness_program</code> (string, optional).',
    },
    urlString: '/v1/validate-address/:address',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/validate-address/%{1}`,
          commonJS: ``,
          esModule: ``,
        },
        codeSampleMainnet: {
          curl: [`qb1zjrtrlj26qhlr0qze7x9fszx0aa8k268d48n3gmc097zjugk87qrsq9l22h`],
          response: `{
  isvalid: true,
  address: "qb1zjrtrlj26qhlr0qze7x9fszx0aa8k268d48n3gmc097zjugk87qrsq9l22h",
  scriptPubKey: "522090d63fc95a05fe378059f18a9808cfef4f6568eda9e7146f0f2f852e22c7f007",
  isscript: true,
  iswitness: true,
  witness_version: 2,
  witness_program: "90d63fc95a05fe378059f18a9808cfef4f6568eda9e7146f0f2f852e22c7f007"
}`
        },
        codeSampleTestnet: {
          curl: [`tq1z6ytlr3s5969w0wpz9mzkcwx57qv3ndjgkrhj98mt9zl8z7ja6y9qkglrns`],
          response: `{
  isvalid: true,
  address: "tq1z6ytlr3s5969w0wpz9mzkcwx57qv3ndjgkrhj98mt9zl8z7ja6y9qkglrns",
  scriptPubKey: "5220d117f1c6142e8ae7b8222ec56c38d4f01919b648b0ef229f6b28be717a5dd10a",
  isscript: true,
  iswitness: true,
  witness_version: 2,
  witness_program: "d117f1c6142e8ae7b8222ec56c38d4f01919b648b0ef229f6b28be717a5dd10a"
}`
        },
        codeSampleSignet: {
          curl: [`tb1pu8ysre22dcl6qy5m5w7mjwutw73w4u24slcdh4myq06uhr6q29dqwc3ckt`],
          response: `{
  isvalid: true,
  address: "tb1pu8ysre22dcl6qy5m5w7mjwutw73w4u24slcdh4myq06uhr6q29dqwc3ckt",
  scriptPubKey: "5120e1c901e54a6e3fa0129ba3bdb93b8b77a2eaf15587f0dbd76403f5cb8f40515a",
  isscript: true,
  iswitness: true,
  witness_version: 1,
  witness_program: "e1c901e54a6e3fa0129ba3bdb93b8b77a2eaf15587f0dbd76403f5cb8f40515a"
}`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
      }
    }
  },
  {
    type: 'category',
    category: 'assets',
    fragment: 'assets',
    title: 'Assets',
    showConditions: liquidNetworks
  },
  {
    type: 'endpoint',
    category: 'assets',
    httpRequestMethod: 'GET',
    fragment: 'get-asset',
    title: 'GET Asset',
    description: {
      default: 'Returns information about a Liquid asset.'
    },
    urlString: '/asset/:asset_id',
    showConditions: liquidNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/asset/%{1}`,
          commonJS: `
        const { %{0}: { assets } } = mempoolJS();

        const asset_id = '%{1}';
        const asset = await assets.getAsset({ asset_id });

        document.getElementById("result").textContent = JSON.stringify(asset, undefined, 2);
        `,
          esModule: `
  const { %{0}: { assets } } = mempoolJS();

  const asset_id = '%{1}';
  const asset = await assets.getAsset({ asset_id });
  console.log(asset);
          `,
        },
        codeSampleMainnet: emptyCodeSample,
        codeSampleTestnet: emptyCodeSample,
        codeSampleSignet: emptyCodeSample,
        codeSampleLiquid: {
          esModule: [`6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d`],
          commonJS: [`6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d`],
          curl: [`6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d`],
          response: `{
  asset_id: "6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d",
  chain_stats: {
    tx_count: 3887,
    peg_in_count: 2557,
    peg_in_amount: 328822657766,
    peg_out_count: 1131,
    peg_out_amount: 7427922560,
    burn_count: 199,
    burned_amount: 516003151
  },
  mempool_stats: {
    tx_count: 0,
    peg_in_count: 0,
    peg_in_amount: 0,
    peg_out_count: 0,
    peg_out_amount: 0,
    burn_count: 0,
    burned_amount: 0
  }
}`,
        },
        codeSampleLiquidTestnet: {
          esModule: [`ac3e0ff248c5051ffd61e00155b7122e5ebc04fd397a0ecbdd4f4e4a56232926`],
          commonJS: [`ac3e0ff248c5051ffd61e00155b7122e5ebc04fd397a0ecbdd4f4e4a56232926`],
          curl: [`ac3e0ff248c5051ffd61e00155b7122e5ebc04fd397a0ecbdd4f4e4a56232926`],
          response: `{
  "asset_id": "ac3e0ff248c5051ffd61e00155b7122e5ebc04fd397a0ecbdd4f4e4a56232926",
  "issuance_txin": {...},
  "issuance_prevout": {...},
  "reissuance_token": "55fdb86a988b07242a7edbddb53f40b3742c0e863a769937018b31621708b14b",
  "contract_hash": "b3619fb6ebd502ba57c4c026e73d7ae430c32431ffe833a4867faa9dd89abd5b",
  "status": {...},
  "chain_stats": {
    "tx_count": 2,
    "issuance_count": 2,
    "issued_amount": 0,
    "burned_amount": 0,
    "has_blinded_issuances": true,
    "reissuance_tokens": null,
    "burned_reissuance_tokens": 0
  },
  "mempool_stats": {
    "tx_count": 0,
    "issuance_count": 0,
    "issued_amount": 0,
    "burned_amount": 0,
    "has_blinded_issuances": false,
    "reissuance_tokens": null,
    "burned_reissuance_tokens": 0
  },
  "contract": {...},
  "entity": {...},
  "precision": 8,
  "name": "Liquid CAD",
  "ticker": "LCAD"
}`,
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'assets',
    httpRequestMethod: 'GET',
    fragment: 'get-asset-transactions',
    title: 'GET Asset Transactions',
    description: {
      default: 'Returns transactions associated with the specified Liquid asset. For the network\'s native asset, returns a list of peg in, peg out, and burn transactions. For user-issued assets, returns a list of issuance, reissuance, and burn transactions. Does not include regular transactions transferring this asset.'
    },
    urlString: '/asset/:asset_id/txs[/mempool|/chain]',
    showConditions: liquidNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/asset/%{1}/txs`,
          commonJS: `
        const { %{0}: { assets } } = mempoolJS();

        const asset_id = '%{1}';
        const assetTxs = await assets.getAssetTxs({ asset_id, is_mempool: false });

        document.getElementById("result").textContent = JSON.stringify(assetTxs, undefined, 2);
        `,
          esModule: `
  const { %{0}: { assets } } = mempoolJS();

  const asset_id = '%{1}';
  const assetTxs = await assets.getAssetTxs({ asset_id, is_mempool: false });
  console.log(assetTxs);
          `,
        },
        codeSampleMainnet: emptyCodeSample,
        codeSampleTestnet: emptyCodeSample,
        codeSampleSignet: emptyCodeSample,
        codeSampleLiquid: {
          esModule: [`6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d`],
          commonJS: [`6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d`],
          curl: [`6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d`],
          response: `[
  {
    txid: "93fedcc996df43c94f9f12e24b4040b60d47d84ef7a9a66ef05c2e6f4059b685",
    version: 2,
    locktime: 0,
    vin: [],
    vout: [],
    size: 998,
    weight: 1484,
    fee: 42,
    status: {
      confirmed: true,
      block_height: 1471854,
      block_hash: "f113b64f6bc937fda6891fd9f1833d207312f986767aff91aea9649d87533250",
      block_time: 1630618498
    }
  },
  ...
]`,
        },
        codeSampleLiquidTestnet: {
          esModule: [`ac3e0ff248c5051ffd61e00155b7122e5ebc04fd397a0ecbdd4f4e4a56232926`],
          commonJS: [`ac3e0ff248c5051ffd61e00155b7122e5ebc04fd397a0ecbdd4f4e4a56232926`],
          curl: [`ac3e0ff248c5051ffd61e00155b7122e5ebc04fd397a0ecbdd4f4e4a56232926`],
          response: `[
  {
    txid: "34b9cd013ddf4d4b5e9d09502ca953034fd52a0679845ac8b9d54c63d857a488",
    version: 2,
    locktime: 140139,
    vin: [],
    vout: [],
    size: 17918,
    weight: 19721,
    fee: 493,
    status: {
      confirmed: true,
      block_height: 140140,
      block_hash: "c3a08178acf2bbafabda120930a0b270e762550d8a46e3e093de779ef459d29d",
      block_time: 1640279893
    }
  },
  ...
]`,
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'assets',
    httpRequestMethod: 'GET',
    fragment: 'get-asset-supply',
    title: 'GET Asset Supply',
    description: {
      default: 'Get the current total supply of the specified asset. For the native asset (LBTC), this is calculated as [chain,mempool]_stats.peg_in_amount - [chain,mempool]_stats.peg_out_amount - [chain,mempool]_stats.burned_amount. For issued assets, this is calculated as [chain,mempool]_stats.issued_amount - [chain,mempool]_stats.burned_amount. Not available for assets with blinded issuances. If /decimal is specified, returns the supply as a decimal according to the asset\'s divisibility. Otherwise, returned in base units.'
    },
    urlString: '/asset/:asset_id/supply[/decimal]',
    showConditions: liquidNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/asset/%{1}/supply`,
          commonJS: `
        const { %{0}: { assets } } = mempoolJS();

        const asset_id = '%{1}';
        const assetSupply = await assets.getAssetSupply({ asset_id, decimal: false });

        document.getElementById("result").textContent = JSON.stringify(assetSupply, undefined, 2);
        `,
          esModule: `
  const { %{0}: { assets } } = mempoolJS();

  const asset_id = '%{1}';
  const assetSupply = await assets.getAssetSupply({ asset_id, decimal: false });
  console.log(assetSupply);
          `,
        },
        codeSampleMainnet: emptyCodeSample,
        codeSampleTestnet: emptyCodeSample,
        codeSampleSignet: emptyCodeSample,
        codeSampleLiquid: {
          esModule: [`6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d`],
          commonJS: [`6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d`],
          curl: [`6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d`],
          response: `320878732055`,
        },
        codeSampleLiquidTestnet: {
          esModule: [`05aa9f02a06da37f2a0a572c49ac381499a16a643ad7c70c51ac94560778c92e`],
          commonJS: [`05aa9f02a06da37f2a0a572c49ac381499a16a643ad7c70c51ac94560778c92e`],
          curl: [`05aa9f02a06da37f2a0a572c49ac381499a16a643ad7c70c51ac94560778c92e`],
          response: `1000`,
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'assets',
    httpRequestMethod: 'GET',
    fragment: 'get-asset-icons',
    title: 'GET Asset Icons',
    description: {
      default: 'Get all the Asset IDs that have icons.'
    },
    urlString: '/v1/assets/icons',
    showConditions: liquidNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/assets/icons`,
          commonJS: `
        const { %{0}: { assets } } = mempoolJS();
        const assetsIcons = await assets.getAssetsIcons();
        document.getElementById("result").textContent = JSON.stringify(assetsIcons, undefined, 2);
        `,
          esModule: `
  const { %{0}: { assets } } = mempoolJS();
  const assetsIcons = await assets.getAssetsIcons();
  console.log(assetsIcons);
          `,
        },
        codeSampleLiquid: {
          esModule: [`6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d`],
          commonJS: [`6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d`],
          curl: [`6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d`],
          response: `[
  "6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d",
  "ce091c998b83c78bb71a632313ba3760f1763d9cfcffae02258ffa9865a37bd2"
  ...
]`,
        },
        codeSampleLiquidTestnet: emptyCodeSample,
      }
    }
  },
  {
    type: 'endpoint',
    category: 'assets',
    httpRequestMethod: 'GET',
    fragment: 'get-asset-icon',
    title: 'GET Asset Icon',
    description: {
      default: 'Get the icon of the specified asset.'
    },
    urlString: '/v1/asset/:asset_id/icon',
    showConditions: liquidNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        noWrap: true,
        codeTemplate: {
          curl: `/api/v1/asset/%{1}/icon`,
          commonJS: `<img src="https://liquid.place/api/v1/asset/%{1}/icon">`,
        },
        codeSampleLiquid: {
          esModule: [`6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d`],
          commonJS: [`6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d`],
          curl: [`6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d`],
          response: `PNG`,
        },
        codeSampleLiquidTestnet: {
          esModule: [`ac3e0ff248c5051ffd61e00155b7122e5ebc04fd397a0ecbdd4f4e4a56232926`],
          commonJS: [`ac3e0ff248c5051ffd61e00155b7122e5ebc04fd397a0ecbdd4f4e4a56232926`],
          curl: [`ac3e0ff248c5051ffd61e00155b7122e5ebc04fd397a0ecbdd4f4e4a56232926`],
          response: `PNG`,
        },
      }
    }
  },
  {
    type: 'category',
    category: 'blocks',
    fragment: 'blocks',
    title: 'Blocks',
    showConditions: bitcoinNetworks.concat(liquidNetworks)
  },
  {
    options: { electrsOnly: true },
    type: 'endpoint',
    category: 'blocks',
    httpRequestMethod: 'GET',
    fragment: 'get-block',
    title: 'GET Block',
    description: {
      default: 'Returns details about a block.',
    },
    urlString: '/block/:hash',
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/block/%{1}`,
          commonJS: `
        const { %{0}: { blocks } } = mempoolJS();

        const hash = '%{1}';
        const block = await blocks.getBlock({ hash });

        document.getElementById("result").textContent = JSON.stringify(block, undefined, 2);
        `,
          esModule: `
  const { %{0}: { blocks } } = mempoolJS();

  const hash = '%{1}';
  const block = await blocks.getBlock({ hash });
  console.log(block);
          `,
        },
        codeSampleMainnet: {
          esModule: ['00000000000000008451c8a192642a138f7ec4b84376341d7a5003335a2e9401'],
          commonJS: ['00000000000000008451c8a192642a138f7ec4b84376341d7a5003335a2e9401'],
          curl: ['00000000000000008451c8a192642a138f7ec4b84376341d7a5003335a2e9401'],
          response: `{
  "id": "00000000000000008451c8a192642a138f7ec4b84376341d7a5003335a2e9401",
  "height": 163891,
  "version": 652156928,
  "timestamp": 1793986989,
  "bits": 419590871,
  "nonce": 1019171885,
  "difficulty": 1754028339.970213,
  "merkle_root": "daf8162146ced27a0a0f57688fbe81b35ca3e1c0e370641dc8aadaf2d9ae682c",
  "tx_count": 5,
  "size": 10717,
  "weight": 10717,
  "previousblockhash": "000000000000000123c8defab7560e1959d52e62c2fafa6d5a435f41c60f889c",
  "mediantime": 1793986907,
  "extras": {
    "cadence": {
      "topBits": 1,
      "chainId": 14073,
      "isAuxpow": false,
      "signalBits": 0,
      "expectedChainId": 47,
      "chainIdMatchesExpected": null
    },
    "totalFees": 88536,
    "medianFee": 0,
    "feeRange": [
      1.2007299270072993,
      1.2007299270072993,
      ...
    ],
    "reward": 18394368603,
    "pool": {
      "id": 1,
      "name": "Qbit Pool",
      "slug": "qbitpool",
      "minerNames": null
    },
    "avgFee": 22134,
    "avgFeeRate": 8,
    "coinbaseRaw": "033380022f5162697420506f6f6c2f000e12451188d34fcd120000",
    "coinbaseAddress": "qb1z7635znpv0ffehup3aq7dddzf6yuvvzwddad7aye7l64430rvq69q4zmcdh",
    "coinbaseAddresses": [
      "qb1z7635znpv0ffehup3aq7dddzf6yuvvzwddad7aye7l64430rvq69q4zmcdh",
      "qb1zx9mjge324sgvj42dxrutjs44wal79ysd3kpexqxk5uq27m6lmufs3key9e",
      ...
    ],
    "coinbaseSignature": "OP_PUSHNUM_2 OP_PUSHBYTES_32 f6a3414c2c7a539bf031e83cd6b449d138c609cd6f5bee933efeab58bc6c068a",
    "coinbaseSignatureAscii": "\\u00033\\u0002/Qbit Pool/\\u0000\\u000e\\u0012E\\u0011ÓOÍ\\u0012\\u0000\\u0000",
    "avgTxSize": 1991.8,
    "totalInputs": 4,
    "totalOutputs": 51,
    "totalOutputAmt": 497225513,
    "medianFeeAmt": null,
    "feePercentiles": null,
    "segwitTotalTxs": 4,
    "segwitTotalSize": 9959,
    "segwitTotalWeight": 9959,
    "header": "0020df269c880fc6415f435a6dfafac2622ed559190e56b7fadec82301000000...",
    "auxpow": null,
    "utxoSetChange": 47,
    "utxoSetSize": null,
    "totalInputAmt": null,
    "virtualSize": 10717,
    "firstSeen": null,
    "orphans": [],
    "matchRate": null,
    "expectedFees": null,
    "expectedWeight": null
  }
}`
        },
        codeSampleTestnet: {
          esModule: ['0000000000004566ada8ed167de2f48c8c3f9cd9c3ce661df41c9cb82811388f'],
          commonJS: ['0000000000004566ada8ed167de2f48c8c3f9cd9c3ce661df41c9cb82811388f'],
          curl: ['0000000000004566ada8ed167de2f48c8c3f9cd9c3ce661df41c9cb82811388f'],
          response: `{
  "id": "0000000000004566ada8ed167de2f48c8c3f9cd9c3ce661df41c9cb82811388f",
  "height": 202432,
  "version": 536936448,
  "timestamp": 1793838527,
  "bits": 441912566,
  "nonce": 313421461,
  "difficulty": 192726.4657113559,
  "merkle_root": "a7ceac128021ee0e6d505a6b7aad497726a2863f5f363a9337d30501cd131729",
  "tx_count": 3,
  "size": 8149,
  "weight": 8149,
  "previousblockhash": "0000000000000a0d2a30aecf8abdcd55d2e9ea1b4cedafea6f131db742eeccb3",
  "mediantime": 1793838213,
  "extras": {
    "cadence": {
      "topBits": 1,
      "chainId": 8,
      "isAuxpow": false,
      "signalBits": 0,
      "expectedChainId": 31430,
      "chainIdMatchesExpected": null
    },
    "totalFees": 4926,
    "medianFee": 0,
    "feeRange": [
      0.25025906735751297,
      0.25025906735751297,
      ...
    ],
    "reward": 17599652094,
    "pool": {
      "id": 1,
      "name": "Qbit Pool",
      "slug": "qbitpool",
      "minerNames": null
    },
    "avgFee": 2463,
    "avgFeeRate": 0,
    "coinbaseRaw": "03c016032f505249534d20506f6f6c2f000080a9cb11000000000000",
    "coinbaseAddress": "tq1z6ej76x4syrxk8822qlq2lvf4y3hk0rmc42nsh8n6r775gjq050ssdn0vng",
    "coinbaseAddresses": [
      "tq1z6ej76x4syrxk8822qlq2lvf4y3hk0rmc42nsh8n6r775gjq050ssdn0vng",
      "tq1zgfhzn9y9lzpp8daz57mnwp3js2akvt3xyapjfvy6hzvvh7rt8tms70x96z"
    ],
    "coinbaseSignature": "OP_PUSHNUM_2 OP_PUSHBYTES_32 d665ed1ab020cd639d4a07c0afb135246f678f78aaa70b9e7a1fbd44480fa3e1",
    "coinbaseSignatureAscii": "\\u0003À\\u0016\\u0003/PRISM Pool/\\u0000\\u0000©Ë\\u0011\\u0000\\u0000\\u0000\\u0000\\u0000\\u0000",
    "avgTxSize": 2606.67,
    "totalInputs": 2,
    "totalOutputs": 7,
    "totalOutputAmt": 6200011306,
    "medianFeeAmt": null,
    "feePercentiles": null,
    "segwitTotalTxs": 2,
    "segwitTotalSize": 7820,
    "segwitTotalWeight": 7820,
    "header": "00000120b3ccee42b71d136feaafed4c1beae9d255cdbd8acfae302a0d0a0000...",
    "auxpow": null,
    "utxoSetChange": 5,
    "utxoSetSize": null,
    "totalInputAmt": null,
    "virtualSize": 8149,
    "firstSeen": null,
    "orphans": [],
    "matchRate": null,
    "expectedFees": null,
    "expectedWeight": null
  }
}`
        },
        codeSampleSignet: {
          esModule: ['000000ca66fab8083d4f0370d499c3d602e78af5fa69b2427cda15a3f0d96152'],
          commonJS: ['000000ca66fab8083d4f0370d499c3d602e78af5fa69b2427cda15a3f0d96152'],
          curl: ['000000ca66fab8083d4f0370d499c3d602e78af5fa69b2427cda15a3f0d96152'],
          response: `{
  id: "000000ca66fab8083d4f0370d499c3d602e78af5fa69b2427cda15a3f0d96152",
  height: 53745,
  version: 536870912,
  timestamp: 1630624390,
  tx_count: 1,
  size: 343,
  weight: 1264,
  merkle_root: "2c1984132841b9f98270274012b22beb7d4ade778cf058e9a44d38de5a111362",
  previousblockhash: "000001497bffdc2347656847647f343afc0eee441a849259335b8a1d79b6aa4a",
  mediantime: 1630621400,
  nonce: 19642021,
  bits: 503404179,
  difficulty: 0
}`
        },
        codeSampleLiquid: {
          esModule: [`86aefdd3cf7be8e5781f783fe5d80513e8b3f52f2f1ef61e8e056b7faffc4b78`],
          commonJS: [`86aefdd3cf7be8e5781f783fe5d80513e8b3f52f2f1ef61e8e056b7faffc4b78`],
          curl: [`86aefdd3cf7be8e5781f783fe5d80513e8b3f52f2f1ef61e8e056b7faffc4b78`],
          response: `{
  id: "86aefdd3cf7be8e5781f783fe5d80513e8b3f52f2f1ef61e8e056b7faffc4b78",
  height: 1471971,
  version: 570425344,
  timestamp: 1630625518,
  tx_count: 2,
  size: 10841,
  weight: 16913,
  merkle_root: "7e40735e103d6015c90d285d09b535498c0a26df9ca8118b1b4d68aaf80ccf48",
  previousblockhash: "944fa8ffd906b3531af95f3d9b052dfdef0b60657c3c8def2c3591384f083424",
  mediantime: 1630625218,
  ext: {
    challenge: "5b21026a2a106ec32c8a1e8052e5d02a7b0a150423dbd9b116fc48d46630ff6e6a05b92102791646a8b49c2740352b4495c118d876347bf47d0551c01c4332fdc2df526f1a2102888bda53a424466b0451627df22090143bbf7c060e9eacb1e38426f6b07f2ae12102aee8967150dee220f613de3b239320355a498808084a93eaf39a34dcd62024852102d46e9259d0a0bb2bcbc461a3e68f34adca27b8d08fbe985853992b4b104e27412102e9944e35e5750ab621e098145b8e6cf373c273b7c04747d1aa020be0af40ccd62102f9a9d4b10a6d6c56d8c955c547330c589bb45e774551d46d415e51cd9ad5116321033b421566c124dfde4db9defe4084b7aa4e7f36744758d92806b8f72c2e943309210353dcc6b4cf6ad28aceb7f7b2db92a4bf07ac42d357adf756f3eca790664314b621037f55980af0455e4fb55aad9b85a55068bb6dc4740ea87276dc693f4598db45fa210384001daa88dabd23db878dbb1ce5b4c2a5fa72c3113e3514bf602325d0c37b8e21039056d089f2fe72dbc0a14780b4635b0dc8a1b40b7a59106325dd1bc45cc70493210397ab8ea7b0bf85bc7fc56bb27bf85e75502e94e76a6781c409f3f2ec3d1122192103b00e3b5b77884bf3cae204c4b4eac003601da75f96982ffcb3dcb29c5ee419b92103c1f3c0874cfe34b8131af34699589aacec4093399739ae352e8a46f80a6f68375fae",
    solution: "00473045022100b572ef7e8a1c5a795d4ca46ab0221f0296ae081870ec25b3eb3f7db4a9e48d6102207863cfcae9776d3fee8fb2f05f06c879cf16c319b633f09cfac9bf041e662f31463044022056e41068e5448c897f80ef864fbbd71690af375afc33d9a52a12efd399a75c0202203f61333e193e0ff3da1ef15fa5c84c3852bd3b4f701e4bf4ebc0dcb68138d227473045022100af50aae198402aa45764a771d3ec23cf86037ea1e3bd682d09f262d057de1a2c02202f46b42ff1062117001af9689fce666bc50cfd479f63969e28670e26b747610f46304402201bb90d72cd58e5198b135828354e8fcc3e73238e412c6e2474f9d67676b12ceb022053f3a6cbeb85abc5e0bc18a83eeffe7785c382746f50c98a29743eb00d474f9e473045022100954d79ddb28c5682a3600cb4f76433f31606064717c700e5ea626807cfb169cf0220365e42d1d07bd8a65b5cb6e449a6bbd3684bf31f0f31ffe9aa13a1f145f28de2473045022100e8a6566fbd8e2829ac24c02ff78794f0122d828e9c1989ed8c077013a2834c6d022016b6833665bbe9ca930247600694f90d40aeb9880fdf95ef62b553efb516997f473045022100c0dca22bfc3a3f64f1ac221796ecd052c153e03732e696ce891be4998c6ae34a0220650ff2e1af0cf3318e249e358738d69de91ebdc81535234a30bdbc4361edc08246304402205f0db67365c3667b93cbcfaa2e5a26a4dbab15a5e39196008fd84b61de358f89022035d5bca676b62028e17f962ef7a33b9f34534f02f3d1ac57b65a666f6d33b3fa473045022100ae711c250c7e4a9d7795e96a4209d05f2b4866473aa2a35b8478b9e3eec883800220514db41ba950cf089cce8fd71cfc41454c80005c2c57401da0e2fb3ce96097bc473045022100bfc416e16fb246cc21a3729359bcf9a752643f4c57190493418dab5df33ff8190220289600af6dc32bffb000f984c8c37f137841e1738c701e05c0a08be53e5eb62b473045022100accf30feb32423e20ddaae3c12584b33ad4eb6492deed1393175a0443832faa0022045b17184460ece57857fe74143166c3692348758054d3d7852fee833cb66e9c4"
  }
}`,
        },
        codeSampleLiquidTestnet: {
          esModule: [`8f7cb70f32e2069724212c986f34462fc40180eabf189b44486faf6989824f9a`],
          commonJS: [`8f7cb70f32e2069724212c986f34462fc40180eabf189b44486faf6989824f9a`],
          curl: [`8f7cb70f32e2069724212c986f34462fc40180eabf189b44486faf6989824f9a`],
          response: `{
  id: "8f7cb70f32e2069724212c986f34462fc40180eabf189b44486faf6989824f9a",
  height: 154705,
  version: 536870912,
  timestamp: 1641154264,
  tx_count: 2,
  size: 5137,
  weight: 7348,
  merkle_root: "e7cc1145b3b074be73a84119485a504de77967aabe415240caca0e2c41a8b9b4",
  previousblockhash: "2745fd72a5bd2b256c9d2044631032d2cd872f1f0001c3db52e26604a6423526",
  mediantime: 1641153964,
  ext: {...}
}`,
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'blocks',
    httpRequestMethod: 'GET',
    fragment: 'get-block-v1',
    title: 'GET Block (v1)',
    description: {
      default: 'Returns details about a block using this explorer\'s Node.js backend.',
    },
    urlString: '/v1/block/:hash',
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/block/%{1}`,
          commonJS: `
        const { %{0}: { blocks } } = mempoolJS();

        const hash = '%{1}';
        const block = await blocks.getBlock({ hash });

        document.getElementById("result").textContent = JSON.stringify(block, undefined, 2);
        `,
          esModule: `
  const { %{0}: { blocks } } = mempoolJS();

  const hash = '%{1}';
  const block = await blocks.getBlock({ hash });
  console.log(block);
          `,
        },
        codeSampleMainnet: {
          esModule: ['00000000000000008451c8a192642a138f7ec4b84376341d7a5003335a2e9401'],
          commonJS: ['00000000000000008451c8a192642a138f7ec4b84376341d7a5003335a2e9401'],
          curl: ['00000000000000008451c8a192642a138f7ec4b84376341d7a5003335a2e9401'],
          response: `{
  "id": "00000000000000008451c8a192642a138f7ec4b84376341d7a5003335a2e9401",
  "height": 163891,
  "version": 652156928,
  "timestamp": 1793986989,
  "bits": 419590871,
  "nonce": 1019171885,
  "difficulty": 1754028339.970213,
  "merkle_root": "daf8162146ced27a0a0f57688fbe81b35ca3e1c0e370641dc8aadaf2d9ae682c",
  "tx_count": 5,
  "size": 10717,
  "weight": 10717,
  "previousblockhash": "000000000000000123c8defab7560e1959d52e62c2fafa6d5a435f41c60f889c",
  "mediantime": 1793986907,
  "extras": {
    "cadence": {
      "topBits": 1,
      "chainId": 14073,
      "isAuxpow": false,
      "signalBits": 0,
      "expectedChainId": 47,
      "chainIdMatchesExpected": null
    },
    "totalFees": 88536,
    "medianFee": 0,
    "feeRange": [
      1.2007299270072993,
      1.2007299270072993,
      ...
    ],
    "reward": 18394368603,
    "pool": {
      "id": 1,
      "name": "Qbit Pool",
      "slug": "qbitpool",
      "minerNames": null
    },
    "avgFee": 22134,
    "avgFeeRate": 8,
    "coinbaseRaw": "033380022f5162697420506f6f6c2f000e12451188d34fcd120000",
    "coinbaseAddress": "qb1z7635znpv0ffehup3aq7dddzf6yuvvzwddad7aye7l64430rvq69q4zmcdh",
    "coinbaseAddresses": [
      "qb1z7635znpv0ffehup3aq7dddzf6yuvvzwddad7aye7l64430rvq69q4zmcdh",
      "qb1zx9mjge324sgvj42dxrutjs44wal79ysd3kpexqxk5uq27m6lmufs3key9e",
      ...
    ],
    "coinbaseSignature": "OP_PUSHNUM_2 OP_PUSHBYTES_32 f6a3414c2c7a539bf031e83cd6b449d138c609cd6f5bee933efeab58bc6c068a",
    "coinbaseSignatureAscii": "\\u00033\\u0002/Qbit Pool/\\u0000\\u000e\\u0012E\\u0011ÓOÍ\\u0012\\u0000\\u0000",
    "avgTxSize": 1991.8,
    "totalInputs": 4,
    "totalOutputs": 51,
    "totalOutputAmt": 497225513,
    "medianFeeAmt": null,
    "feePercentiles": null,
    "segwitTotalTxs": 4,
    "segwitTotalSize": 9959,
    "segwitTotalWeight": 9959,
    "header": "0020df269c880fc6415f435a6dfafac2622ed559190e56b7fadec82301000000...",
    "auxpow": null,
    "utxoSetChange": 47,
    "utxoSetSize": null,
    "totalInputAmt": null,
    "virtualSize": 10717,
    "firstSeen": null,
    "orphans": [],
    "matchRate": null,
    "expectedFees": null,
    "expectedWeight": null
  }
}`
        },
        codeSampleTestnet: {
          esModule: ['0000000000004566ada8ed167de2f48c8c3f9cd9c3ce661df41c9cb82811388f'],
          commonJS: ['0000000000004566ada8ed167de2f48c8c3f9cd9c3ce661df41c9cb82811388f'],
          curl: ['0000000000004566ada8ed167de2f48c8c3f9cd9c3ce661df41c9cb82811388f'],
          response: `{
  "id": "0000000000004566ada8ed167de2f48c8c3f9cd9c3ce661df41c9cb82811388f",
  "height": 202432,
  "version": 536936448,
  "timestamp": 1793838527,
  "bits": 441912566,
  "nonce": 313421461,
  "difficulty": 192726.4657113559,
  "merkle_root": "a7ceac128021ee0e6d505a6b7aad497726a2863f5f363a9337d30501cd131729",
  "tx_count": 3,
  "size": 8149,
  "weight": 8149,
  "previousblockhash": "0000000000000a0d2a30aecf8abdcd55d2e9ea1b4cedafea6f131db742eeccb3",
  "mediantime": 1793838213,
  "extras": {
    "cadence": {
      "topBits": 1,
      "chainId": 8,
      "isAuxpow": false,
      "signalBits": 0,
      "expectedChainId": 31430,
      "chainIdMatchesExpected": null
    },
    "totalFees": 4926,
    "medianFee": 0,
    "feeRange": [
      0.25025906735751297,
      0.25025906735751297,
      ...
    ],
    "reward": 17599652094,
    "pool": {
      "id": 1,
      "name": "Qbit Pool",
      "slug": "qbitpool",
      "minerNames": null
    },
    "avgFee": 2463,
    "avgFeeRate": 0,
    "coinbaseRaw": "03c016032f505249534d20506f6f6c2f000080a9cb11000000000000",
    "coinbaseAddress": "tq1z6ej76x4syrxk8822qlq2lvf4y3hk0rmc42nsh8n6r775gjq050ssdn0vng",
    "coinbaseAddresses": [
      "tq1z6ej76x4syrxk8822qlq2lvf4y3hk0rmc42nsh8n6r775gjq050ssdn0vng",
      "tq1zgfhzn9y9lzpp8daz57mnwp3js2akvt3xyapjfvy6hzvvh7rt8tms70x96z"
    ],
    "coinbaseSignature": "OP_PUSHNUM_2 OP_PUSHBYTES_32 d665ed1ab020cd639d4a07c0afb135246f678f78aaa70b9e7a1fbd44480fa3e1",
    "coinbaseSignatureAscii": "\\u0003À\\u0016\\u0003/PRISM Pool/\\u0000\\u0000©Ë\\u0011\\u0000\\u0000\\u0000\\u0000\\u0000\\u0000",
    "avgTxSize": 2606.67,
    "totalInputs": 2,
    "totalOutputs": 7,
    "totalOutputAmt": 6200011306,
    "medianFeeAmt": null,
    "feePercentiles": null,
    "segwitTotalTxs": 2,
    "segwitTotalSize": 7820,
    "segwitTotalWeight": 7820,
    "header": "00000120b3ccee42b71d136feaafed4c1beae9d255cdbd8acfae302a0d0a0000...",
    "auxpow": null,
    "utxoSetChange": 5,
    "utxoSetSize": null,
    "totalInputAmt": null,
    "virtualSize": 8149,
    "firstSeen": null,
    "orphans": [],
    "matchRate": null,
    "expectedFees": null,
    "expectedWeight": null
  }
}`
        },
        codeSampleSignet: {
          esModule: ['000000ca66fab8083d4f0370d499c3d602e78af5fa69b2427cda15a3f0d96152'],
          commonJS: ['000000ca66fab8083d4f0370d499c3d602e78af5fa69b2427cda15a3f0d96152'],
          curl: ['000000ca66fab8083d4f0370d499c3d602e78af5fa69b2427cda15a3f0d96152'],
          response: `{
  "id": "000000ca66fab8083d4f0370d499c3d602e78af5fa69b2427cda15a3f0d96152",
  "height": 53745,
  "version": 536870912,
  "timestamp": 1630624390,
  "bits": 503404179,
  "nonce": 19642021,
  "difficulty": 0.002919030932507782,
  "merkle_root": "2c1984132841b9f98270274012b22beb7d4ade778cf058e9a44d38de5a111362",
  "tx_count": 1,
  "size": 343,
  "weight": 1264,
  "previousblockhash": "000001497bffdc2347656847647f343afc0eee441a849259335b8a1d79b6aa4a",
  "mediantime": 1630621400,
  "extras": {
    "totalFees": 0,
    "medianFee": 0,
    "feeRange": [
      0,
      0,
      0,
      0,
      0,
      0,
      0
    ],
    "reward": 5000000000,
    "pool": {
      "id": 0,
      "name": "Unknown",
      "slug": "unknown",
      "minerNames": null
    },
    "avgFee": 0,
    "avgFeeRate": 0,
    "coinbaseRaw": "03f1d100",
    "coinbaseAddress": "tb1pqk4mdqzp8kpu2g6nrahwd9j0muacyjfadk99tvmpf5vqya8rt5fq2dxx99",
    "coinbaseAddresses": [
      "tb1pqk4mdqzp8kpu2g6nrahwd9j0muacyjfadk99tvmpf5vqya8rt5fq2dxx99"
    ],
    "coinbaseSignature": "OP_PUSHNUM_1 OP_PUSHBYTES_32 05abb680413d83c523531f6ee6964fdf3b82493d6d8a55b3614d180274e35d12",
    "coinbaseSignatureAscii": "...",
    "avgTxSize": 0,
    "totalInputs": 0,
    "totalOutputs": 2,
    "totalOutputAmt": 0,
    "medianFeeAmt": null,
    "feePercentiles": null,
    "segwitTotalTxs": 0,
    "segwitTotalSize": 0,
    "segwitTotalWeight": 0,
    "header": "000000204aaab6791d8a5b335992841a44ee0efc3a347f644768654723dcff7b490100006213115ade384da4e958f08c77de4a7deb2bb21240277082f9b941281384192c865a31619356011ea5b62b01",
    "utxoSetChange": 2,
    "utxoSetSize": 302621,
    "totalInputAmt": 0,
    "virtualSize": 316,
    "firstSeen": null,
    "orphans": [],
    "matchRate": null,
    "expectedFees": null,
    "expectedWeight": null
  }
}`
        },
        codeSampleLiquid: {
          esModule: [`86aefdd3cf7be8e5781f783fe5d80513e8b3f52f2f1ef61e8e056b7faffc4b78`],
          commonJS: [`86aefdd3cf7be8e5781f783fe5d80513e8b3f52f2f1ef61e8e056b7faffc4b78`],
          curl: [`86aefdd3cf7be8e5781f783fe5d80513e8b3f52f2f1ef61e8e056b7faffc4b78`],
          response: `{
  "id": "86aefdd3cf7be8e5781f783fe5d80513e8b3f52f2f1ef61e8e056b7faffc4b78",
  "height": 1471971,
  "version": 570425344,
  "timestamp": 1630625518,
  "bits": null,
  "merkle_root": "7e40735e103d6015c90d285d09b535498c0a26df9ca8118b1b4d68aaf80ccf48",
  "tx_count": 2,
  "size": 10841,
  "weight": 16913,
  "previousblockhash": "944fa8ffd906b3531af95f3d9b052dfdef0b60657c3c8def2c3591384f083424",
  "mediantime": 1630625218,
  "stale": false
}`,
        },
        codeSampleLiquidTestnet: {
          esModule: [`8f7cb70f32e2069724212c986f34462fc40180eabf189b44486faf6989824f9a`],
          commonJS: [`8f7cb70f32e2069724212c986f34462fc40180eabf189b44486faf6989824f9a`],
          curl: [`8f7cb70f32e2069724212c986f34462fc40180eabf189b44486faf6989824f9a`],
          response: `{
  "id": "8f7cb70f32e2069724212c986f34462fc40180eabf189b44486faf6989824f9a",
  "height": 154705,
  "version": 536870912,
  "timestamp": 1641154264,
  "bits": null,
  "merkle_root": "e7cc1145b3b074be73a84119485a504de77967aabe415240caca0e2c41a8b9b4",
  "tx_count": 2,
  "size": 5137,
  "weight": 7012,
  "previousblockhash": "2745fd72a5bd2b256c9d2044631032d2cd872f1f0001c3db52e26604a6423526",
  "mediantime": 1641153964,
  "stale": false
}`,
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'blocks',
    httpRequestMethod: 'GET',
    fragment: 'get-block-header',
    title: 'GET Block Header',
    description: {
      default: 'Returns the hex-encoded block header.'
    },
    urlString: '/block/:hash/header',
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/block/%{1}/header`,
          commonJS: `
        const { %{0}: { blocks } } = mempoolJS();

        const hash = '%{1}';
        const blockHeader = await blocks.getBlockHeader({ height: 0 });

        document.getElementById("result").textContent = JSON.stringify(blockHeight, undefined, 2);
        `,
          esModule: `
  const { %{0}: { blocks } } = mempoolJS();

  const hash = '%{1}';
  const blockHeader = await blocks.getBlockHeader({ height: 0 });
  console.log(blockHeight);
          `,
        },
        codeSampleMainnet: {
          esModule: ['00000000000000008451c8a192642a138f7ec4b84376341d7a5003335a2e9401'],
          commonJS: ['00000000000000008451c8a192642a138f7ec4b84376341d7a5003335a2e9401'],
          curl: ['00000000000000008451c8a192642a138f7ec4b84376341d7a5003335a2e9401'],
          response: `0020df269c880fc6415f435a6dfafac2622ed559190e56b7fadec82301000000000000002c68aed9f2daaac81d6470e3c0e1a35cb381be8f68570f0a7ad2ce462116f8daad11ee6ad77202192d54bf3c`
        },
        codeSampleTestnet: {
          esModule: ['0000000000004566ada8ed167de2f48c8c3f9cd9c3ce661df41c9cb82811388f'],
          commonJS: ['0000000000004566ada8ed167de2f48c8c3f9cd9c3ce661df41c9cb82811388f'],
          curl: ['0000000000004566ada8ed167de2f48c8c3f9cd9c3ce661df41c9cb82811388f'],
          response: `00000120b3ccee42b71d136feaafed4c1beae9d255cdbd8acfae302a0d0a000000000000291713cd0105d337933a365f3f86a2267749ad7a6b5a506d0eee218012accea7bfcdeb6af60c571a956eae12`
        },
        codeSampleSignet: {
          esModule: ['000000ca66fab8083d4f0370d499c3d602e78af5fa69b2427cda15a3f0d96152'],
          commonJS: ['000000ca66fab8083d4f0370d499c3d602e78af5fa69b2427cda15a3f0d96152'],
          curl: ['000000ca66fab8083d4f0370d499c3d602e78af5fa69b2427cda15a3f0d96152'],
          response: `000000204aaab6791d8a5b335992841a44ee0efc3a347f644768654723dcff7b490100006213115ade384da4e958f08c77de4a7deb2bb21240277082f9b941281384192c865a31619356011ea5b62b01`
        },
        codeSampleLiquid: {
          esModule: [`86aefdd3cf7be8e5781f783fe5d80513e8b3f52f2f1ef61e8e056b7faffc4b78`],
          commonJS: [`86aefdd3cf7be8e5781f783fe5d80513e8b3f52f2f1ef61e8e056b7faffc4b78`],
          curl: [`86aefdd3cf7be8e5781f783fe5d80513e8b3f52f2f1ef61e8e056b7faffc4b78`],
          response: `000000222434084f3891352cef8d3c7c65600beffd2d059b3d5ff91a53b306d9ffa84f9448cf0cf8aa684d1b8b11a89cdf260a8c4935b5095d280dc915603d105e73407eee5e3161e3751600fd01025b21026a2a106ec32c8a1e8052e5d02a7b0a150423dbd9b116fc48d46630ff6e6a05b92102791646a8b49c2740352b4495c118d876347bf47d0551c01c4332fdc2df526f1a2102888bda53a424466b0451627df22090143bbf7c060e9eacb1e38426f6b07f2ae12102aee8967150dee220f613de3b239320355a498808084a93eaf39a34dcd62024852102d46e9259d0a0bb2bcbc461a3e68f34adca27b8d08fbe985853992b4b104e27412102e9944e35e5750ab621e098145b8e6cf373c273b7c04747d1aa020be0af40ccd62102f9a9d4b10a6d6c56d8c955c547330c589bb45e774551d46d415e51cd9ad5116321033b421566c124dfde4db9defe4084b7aa4e7f36744758d92806b8f72c2e943309210353dcc6b4cf6ad28aceb7f7b2db92a4bf07ac42d357adf756f3eca790664314b621037f55980af0455e4fb55aad9b85a55068bb6dc4740ea87276dc693f4598db45fa210384001daa88dabd23db878dbb1ce5b4c2a5fa72c3113e3514bf602325d0c37b8e21039056d089f2fe72dbc0a14780b4635b0dc8a1b40b7a59106325dd1bc45cc70493210397ab8ea7b0bf85bc7fc56bb27bf85e75502e94e76a6781c409f3f2ec3d1122192103b00e3b5b77884bf3cae204c4b4eac003601da75f96982ffcb3dcb29c5ee419b92103c1f3c0874cfe34b8131af34699589aacec4093399739ae352e8a46f80a6f68375faefd160300473045022100b572ef7e8a1c5a795d4ca46ab0221f0296ae081870ec25b3eb3f7db4a9e48d6102207863cfcae9776d3fee8fb2f05f06c879cf16c319b633f09cfac9bf041e662f31463044022056e41068e5448c897f80ef864fbbd71690af375afc33d9a52a12efd399a75c0202203f61333e193e0ff3da1ef15fa5c84c3852bd3b4f701e4bf4ebc0dcb68138d227473045022100af50aae198402aa45764a771d3ec23cf86037ea1e3bd682d09f262d057de1a2c02202f46b42ff1062117001af9689fce666bc50cfd479f63969e28670e26b747610f46304402201bb90d72cd58e5198b135828354e8fcc3e73238e412c6e2474f9d67676b12ceb022053f3a6cbeb85abc5e0bc18a83eeffe7785c382746f50c98a29743eb00d474f9e473045022100954d79ddb28c5682a3600cb4f76433f31606064717c700e5ea626807cfb169cf0220365e42d1d07bd8a65b5cb6e449a6bbd3684bf31f0f31ffe9aa13a1f145f28de2473045022100e8a6566fbd8e2829ac24c02ff78794f0122d828e9c1989ed8c077013a2834c6d022016b6833665bbe9ca930247600694f90d40aeb9880fdf95ef62b553efb516997f473045022100c0dca22bfc3a3f64f1ac221796ecd052c153e03732e696ce891be4998c6ae34a0220650ff2e1af0cf3318e249e358738d69de91ebdc81535234a30bdbc4361edc08246304402205f0db67365c3667b93cbcfaa2e5a26a4dbab15a5e39196008fd84b61de358f89022035d5bca676b62028e17f962ef7a33b9f34534f02f3d1ac57b65a666f6d33b3fa473045022100ae711c250c7e4a9d7795e96a4209d05f2b4866473aa2a35b8478b9e3eec883800220514db41ba950cf089cce8fd71cfc41454c80005c2c57401da0e2fb3ce96097bc473045022100bfc416e16fb246cc21a3729359bcf9a752643f4c57190493418dab5df33ff8190220289600af6dc32bffb000f984c8c37f137841e1738c701e05c0a08be53e5eb62b473045022100accf30feb32423e20ddaae3c12584b33ad4eb6492deed1393175a0443832faa0022045b17184460ece57857fe74143166c3692348758054d3d7852fee833cb66e9c4`,
        },
        codeSampleLiquidTestnet: {
          esModule: [`8f7cb70f32e2069724212c986f34462fc40180eabf189b44486faf6989824f9a`],
          commonJS: [`8f7cb70f32e2069724212c986f34462fc40180eabf189b44486faf6989824f9a`],
          curl: [`8f7cb70f32e2069724212c986f34462fc40180eabf189b44486faf6989824f9a`],
          response: `000000a0263542a60466e252dbc301001f2f87cdd232106344209d6c252bbda572fd4527b4b9a8412c0ecaca405241beaa6779e74d505a481941a873be74b0b34511cce7d806d261515c020001220020e9e4117540f7f23b3edd7c2cad660a17fb33c7959b8c37cf61d92b189133929a96000000fbee9cea00d8efdc49cfbec328537e0d7032194de6ebf3cf42e5c05bb89a08b10003004730440220303a6fc365e016422bd5d714e403db237964c9e53c244310a4a03f432583290202206951e82c2ffa028f88d64d9bb4ec7789ced137046bb38a02816617b554efd42b012551210217e403ddb181872c32a0cd468c710040b2f53d8cac69f18dad07985ee37e9a7151ae`,
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'blocks',
    httpRequestMethod: 'GET',
    fragment: 'get-block-height',
    title: 'GET Block Height',
    description: {
      default: 'Returns the hash of the block currently at <code>:height</code>.'
    },
    urlString: '/block-height/:height',
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/block-height/%{1}`,
          commonJS: `
        const { %{0}: { blocks } } = mempoolJS();
        const hash = '%{1}';
        const blockHeight = await blocks.getBlockHeight({ height: 0 });
        document.getElementById("result").textContent = JSON.stringify(blockHeight, undefined, 2);
        `,
          esModule: `
  const { %{0}: { blocks } } = mempoolJS();
  const hash = '%{1}';
  const blockHeight = await blocks.getBlockHeight({ height: 0 });
  console.log(blockHeight);
          `,
        },
        codeSampleMainnet: {
          esModule: ['163891'],
          commonJS: ['163891'],
          curl: ['163891'],
          response: `00000000000000008451c8a192642a138f7ec4b84376341d7a5003335a2e9401`
        },
        codeSampleTestnet: {
          esModule: ['202432'],
          commonJS: ['202432'],
          curl: ['202432'],
          response: `0000000000004566ada8ed167de2f48c8c3f9cd9c3ce661df41c9cb82811388f`
        },
        codeSampleSignet: {
          esModule: ['48000'],
          commonJS: ['48000'],
          curl: ['48000'],
          response: `00000009e8322d4b8f74c8bbd04df1dd5a4abce236ae5907cc87f8364fa5e645`
        },
        codeSampleLiquid: {
          esModule: [`1234567`],
          commonJS: [`1234567`],
          curl: [`1234567`],
          response: `ec2e2bf982bca68c4b09634ba2e48fbe9de3d14744a8e8382971991ff8c6cfd1`,
        },
        codeSampleLiquidTestnet: {
          esModule: [`150000`],
          commonJS: [`150000`],
          curl: [`150000`],
          response: `67d5eb1aee63c6c2058a088985503ff0626fd3f7f8022bdc74fab36a359164db`,
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'blocks',
    httpRequestMethod: 'GET',
    fragment: 'get-block-timestamp',
    title: 'GET Block Timestamp',
    description: {
      default: 'Returns the height and the hash of the block closest to the given <code>:timestamp</code>.'
    },
    urlString: '/v1/mining/blocks/timestamp/:timestamp',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/blocks/timestamp/%{1}`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [`1793491200`],
          commonJS: [`1793491200`],
          curl: ['1793491200'],
          response: `{
  "height": 155661,
  "hash": "0000000000000001d5de78bc237553cef7163e598bdb918bc4dfaa37d2d2fab7",
  "timestamp": "2026-10-31T23:59:41.000Z"
}`
        },
        codeSampleTestnet: {
          esModule: [`1793491200`],
          commonJS: [`1793491200`],
          curl: ['1793491200'],
          response: `{
  "height": 196592,
  "hash": "0000000000005377875384ae7bef193b476e1ef4138a3666ed65e6eb0757d96c",
  "timestamp": "2026-10-31T23:57:59.000Z"
}`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: ['1672531200'],
          response: `{
  height: 123713,
  hash: "0000010c6df8ffe1684ab9d7cfac69836a4538c057fab4571b809120fe486c96",
  timestamp: "2022-12-31T23:55:56.000Z"
}`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
      }
    }
  },
  {
    type: 'endpoint',
    category: 'blocks',
    httpRequestMethod: 'GET',
    fragment: 'get-block-raw',
    title: 'GET Block Raw',
    description: {
      default: 'Returns the raw block representation in binary.'
    },
    urlString: '/block/:hash/raw',
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/block/%{1}/raw`,
          commonJS: `
        const { %{0}: { blocks } } = mempoolJS();

        const hash = '%{1}';
        const blockRaw = await blocks.getBlockRaw({ hash });

        document.getElementById("result").textContent = JSON.stringify(blockRaw, undefined, 2);
        `,
          esModule: `
  const { %{0}: { blocks } } = mempoolJS();

  const hash = '%{1}';
  const blockRaw = await blocks.getBlockRaw({ hash });
  console.log(blockRaw);
          `,
        },
        codeSampleMainnet: {
          esModule: ['00000000000000008451c8a192642a138f7ec4b84376341d7a5003335a2e9401'],
          commonJS: ['00000000000000008451c8a192642a138f7ec4b84376341d7a5003335a2e9401'],
          curl: ['00000000000000008451c8a192642a138f7ec4b84376341d7a5003335a2e9401'],
          response: '',
        },
        codeSampleTestnet: {
          esModule: ['0000000000004566ada8ed167de2f48c8c3f9cd9c3ce661df41c9cb82811388f'],
          commonJS: ['0000000000004566ada8ed167de2f48c8c3f9cd9c3ce661df41c9cb82811388f'],
          curl: ['0000000000004566ada8ed167de2f48c8c3f9cd9c3ce661df41c9cb82811388f'],
          response: '',
        },
        codeSampleSignet: {
          esModule: ['000000ca66fab8083d4f0370d499c3d602e78af5fa69b2427cda15a3f0d96152'],
          commonJS: ['000000ca66fab8083d4f0370d499c3d602e78af5fa69b2427cda15a3f0d96152'],
          curl: ['000000ca66fab8083d4f0370d499c3d602e78af5fa69b2427cda15a3f0d96152'],
          response: '',
        },
        codeSampleLiquid: {
          esModule: [`86aefdd3cf7be8e5781f783fe5d80513e8b3f52f2f1ef61e8e056b7faffc4b78`],
          commonJS: [`86aefdd3cf7be8e5781f783fe5d80513e8b3f52f2f1ef61e8e056b7faffc4b78`],
          curl: [`86aefdd3cf7be8e5781f783fe5d80513e8b3f52f2f1ef61e8e056b7faffc4b78`],
          response: '',
        },
        codeSampleLiquidTestnet: {
          esModule: [`67d5eb1aee63c6c2058a088985503ff0626fd3f7f8022bdc74fab36a359164db`],
          commonJS: [`67d5eb1aee63c6c2058a088985503ff0626fd3f7f8022bdc74fab36a359164db`],
          curl: [`67d5eb1aee63c6c2058a088985503ff0626fd3f7f8022bdc74fab36a359164db`],
          response: '',
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'blocks',
    httpRequestMethod: 'GET',
    fragment: 'get-block-status',
    title: 'GET Block Status',
    description: {
      default: 'Returns the confirmation status of a block. Available fields: <code>in_best_chain</code> (boolean, false for orphaned blocks), <code>next_best</code> (the hash of the next block, only available for blocks in the best chain).'
    },
    urlString: '/block/:hash/status',
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/block/%{1}/status`,
          commonJS: `
        const { %{0}: { blocks } } = mempoolJS();

        const hash = '%{1}';
        const blockStatus = await blocks.getBlockStatus({ hash });

        document.getElementById("result").textContent = JSON.stringify(blockStatus, undefined, 2);
        `,
          esModule: `
  const { %{0}: { blocks } } = mempoolJS();

  const hash = '%{1}';
  const blockStatus = await blocks.getBlockStatus({ hash });
  console.log(blockStatus);
          `,
        },
        codeSampleMainnet: {
          esModule: ['00000000000000008451c8a192642a138f7ec4b84376341d7a5003335a2e9401'],
          commonJS: ['00000000000000008451c8a192642a138f7ec4b84376341d7a5003335a2e9401'],
          curl: ['00000000000000008451c8a192642a138f7ec4b84376341d7a5003335a2e9401'],
          response: `{
  in_best_chain: true,
  height: 690557,
  next_best: "00000000000000000003a59a34c93e39e636c8cd23ead726fdc467fbed0b7c5a"
}`
        },
        codeSampleTestnet: {
          esModule: ['0000000000004566ada8ed167de2f48c8c3f9cd9c3ce661df41c9cb82811388f'],
          commonJS: ['0000000000004566ada8ed167de2f48c8c3f9cd9c3ce661df41c9cb82811388f'],
          curl: ['0000000000004566ada8ed167de2f48c8c3f9cd9c3ce661df41c9cb82811388f'],
          response: `{
  in_best_chain: true,
  height: 2091140,
  next_best: "0000000000000064152f2dc1e13bd70811fbcfa9c1660557233668b98b7b1c2b"
}`
        },
        codeSampleSignet: {
          esModule: ['000000ca66fab8083d4f0370d499c3d602e78af5fa69b2427cda15a3f0d96152'],
          commonJS: ['000000ca66fab8083d4f0370d499c3d602e78af5fa69b2427cda15a3f0d96152'],
          curl: ['000000ca66fab8083d4f0370d499c3d602e78af5fa69b2427cda15a3f0d96152'],
          response: `{
  in_best_chain: true,
  height: 53745,
  next_best: "000000e9c2a969f6a3425ab70851328e878ebdeb90b73f9cfb16241b97c44640"
}`
        },
        codeSampleLiquid: {
          esModule: [`86aefdd3cf7be8e5781f783fe5d80513e8b3f52f2f1ef61e8e056b7faffc4b78`],
          commonJS: [`86aefdd3cf7be8e5781f783fe5d80513e8b3f52f2f1ef61e8e056b7faffc4b78`],
          curl: [`86aefdd3cf7be8e5781f783fe5d80513e8b3f52f2f1ef61e8e056b7faffc4b78`],
          response: `{
  in_best_chain: true,
  height: 1471971,
  next_best: "1ce5b14c5fbc05be73d8833839e049fd34212da902a78118cd8502a95bf9c134"
}`,
        },
        codeSampleLiquidTestnet: {
          esModule: [`67d5eb1aee63c6c2058a088985503ff0626fd3f7f8022bdc74fab36a359164db`],
          commonJS: [`67d5eb1aee63c6c2058a088985503ff0626fd3f7f8022bdc74fab36a359164db`],
          curl: [`67d5eb1aee63c6c2058a088985503ff0626fd3f7f8022bdc74fab36a359164db`],
          response: `{
  in_best_chain: true,
  height: 150000,
  next_best: "2f24f3d94c006971b86fe2c9cdc92a7ed0aa7ec3b0643a836b8d8b5a54103bab"
}`,
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'blocks',
    httpRequestMethod: 'GET',
    fragment: 'get-block-tip-height',
    title: 'GET Block Tip Height',
    description: {
      default: 'Returns the height of the last block. Answers 503 after a restart until the backend has caught up with the node.'
    },
    urlString: '/blocks/tip/height',
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/blocks/tip/height`,
          commonJS: `
        const { %{0}: { blocks } } = mempoolJS();

        const blocksTipHeight = await blocks.getBlocksTipHeight();

        document.getElementById("result").textContent = JSON.stringify(blocksTipHeight, undefined, 2);
        `,
          esModule: `
  const { %{0}: { blocks } } = mempoolJS();

  const blocksTipHeight = await blocks.getBlocksTipHeight();
  console.log(blocksTipHeight);
          `,
        },
        codeSampleMainnet: {
          esModule: [''],
          commonJS: [''],
          curl: [''],
          response: `698767`
        },
        codeSampleTestnet: {
          esModule: [''],
          commonJS: [''],
          curl: [''],
          response: `2091168`
        },
        codeSampleSignet: {
          esModule: [''],
          commonJS: [''],
          curl: [''],
          response: `53763`
        },
        codeSampleLiquid: {
          esModule: [''],
          commonJS: [''],
          curl: [''],
          response: `1472119`,
        },
        codeSampleLiquidTestnet: {
          esModule: [''],
          commonJS: [''],
          curl: [''],
          response: `162495`,
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'blocks',
    httpRequestMethod: 'GET',
    fragment: 'get-block-tip-hash',
    title: 'GET Block Tip Hash',
    description: {
      default: 'Returns the hash of the last block.'
    },
    urlString: '/blocks/tip/hash',
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/blocks/tip/hash`,
          commonJS: `
        const { %{0}: { blocks } } = mempoolJS();

        const blocksTipHash = await blocks.getBlocksTipHash();

        document.getElementById("result").textContent = JSON.stringify(blocksTipHash, undefined, 2);
        `,
          esModule: `
  const { %{0}: { blocks } } = mempoolJS();

  const blocksTipHash = await blocks.getBlocksTipHash();
  console.log(blocksTipHash);
          `,
        },
        codeSampleMainnet: {
          esModule: [''],
          commonJS: [''],
          curl: [''],
          response: `0000000000000000000624d76f52661d0f35a0da8b93a87cb93cf08fd9140209`
        },
        codeSampleTestnet: {
          esModule: [''],
          commonJS: [''],
          curl: [''],
          response: `00000000000000a7a5227bb493ffb90d1e63e1c7e8cab2c9a2b98e9f2599a9a9`
        },
        codeSampleSignet: {
          esModule: [''],
          commonJS: [''],
          curl: [''],
          response: `000000c09517efadf7425f7c19543b69768aaa9871a817d192d2c33cebebf3f9`
        },
        codeSampleLiquid: {
          esModule: [''],
          commonJS: [''],
          curl: [''],
          response: `ec8fed6f33cba86f99b39ae65af948bfc2fdb95cceaa7331bbfd88f5daa823a2`,
        },
        codeSampleLiquidTestnet: {
          esModule: [''],
          commonJS: [''],
          curl: [''],
          response: `ff643a1e102b555103d8feb20b296ee5cf3b4a202fa284e5d6ce82945b738ae7`,
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'blocks',
    httpRequestMethod: 'GET',
    fragment: 'get-block-transaction-id',
    title: 'GET Block Transaction ID',
    description: {
      default: 'Returns the transaction at index <code>:index</code> within the specified block.'
    },
    urlString: '/block/:hash/txid/:index',
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/block/%{1}/txid/%{2}`,
          commonJS: `
        const { %{0}: { blocks } } = mempoolJS();

        const hash = '%{1}';
        const blockTxid = await blocks.getBlockTxid({ hash, index: %{2} });

        document.getElementById("result").textContent = JSON.stringify(blockTxid, undefined, 2);
        `,
          esModule: `
  const { %{0}: { blocks } } = mempoolJS();

  const hash = '%{1}';
  const blockTxid = await blocks.getBlockTxid({ hash, index: %{2} });
  console.log(blockTxid);
          `,
        },
        codeSampleMainnet: {
          esModule: ['00000000000000008451c8a192642a138f7ec4b84376341d7a5003335a2e9401', '2'],
          commonJS: ['00000000000000008451c8a192642a138f7ec4b84376341d7a5003335a2e9401', '2'],
          curl: ['00000000000000008451c8a192642a138f7ec4b84376341d7a5003335a2e9401', '2'],
          response: `2de5d75812774656cc1905cc40d6c40d35efe9555185037b5c065836415adac8`
        },
        codeSampleTestnet: {
          esModule: ['0000000000004566ada8ed167de2f48c8c3f9cd9c3ce661df41c9cb82811388f', '1'],
          commonJS: ['0000000000004566ada8ed167de2f48c8c3f9cd9c3ce661df41c9cb82811388f', '1'],
          curl: ['0000000000004566ada8ed167de2f48c8c3f9cd9c3ce661df41c9cb82811388f', '1'],
          response: `ba2d67a7ae5d869170ecaf927383368d8cb52d2db01c7268df1f343bd24362fc`
        },
        codeSampleSignet: {
          esModule: ['0000014b62b53d2550c310208af9d792ab7a9a2487a67d82c06b17b201ee602f', '1'],
          commonJS: ['0000014b62b53d2550c310208af9d792ab7a9a2487a67d82c06b17b201ee602f', '1'],
          curl: ['0000014b62b53d2550c310208af9d792ab7a9a2487a67d82c06b17b201ee602f', '1'],
          response: `b72a9a7cfbb0685e393f86fa1fa1c43c2888b9ad01c9ac48a28b98e2c8721a89`
        },
        codeSampleLiquid: {
          esModule: ['dbbf73007879859f2c55b8605751498ad0d2848db0fdedeadcbdc0cf4f02ee13', '1'],
          commonJS: ['dbbf73007879859f2c55b8605751498ad0d2848db0fdedeadcbdc0cf4f02ee13', '1'],
          curl: ['dbbf73007879859f2c55b8605751498ad0d2848db0fdedeadcbdc0cf4f02ee13', '1'],
          response: `36e47770c306ae5d4ddcc2ce50f6ce6e23d6bdc692b9a9a347fb68d19255f598`
        },
        codeSampleLiquidTestnet: {
          esModule: ['b6b4aeefa220c6a17da116bda666e869b3146967d2479656448a8bce1e799b8f', '1'],
          commonJS: ['b6b4aeefa220c6a17da116bda666e869b3146967d2479656448a8bce1e799b8f', '1'],
          curl: ['b6b4aeefa220c6a17da116bda666e869b3146967d2479656448a8bce1e799b8f', '1'],
          response: `41493aa0eec8b6d359c2defc90e2fafb42fb5b8633456648553467a4d3a16c4a`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'blocks',
    httpRequestMethod: 'GET',
    fragment: 'get-block-transaction-ids',
    title: 'GET Block Transaction IDs',
    description: {
      default: 'Returns a list of all txids in the block.'
    },
    urlString: '/block/:hash/txids',
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/block/%{1}/txids`,
          commonJS: `
        const { %{0}: { blocks } } = mempoolJS();

        const hash = '%{1}';
        const blockTxids = await blocks.getBlockTxids({ hash });

        document.getElementById("result").textContent = JSON.stringify(blockTxids, undefined, 2);
        `,
          esModule: `
  const { %{0}: { blocks } } = mempoolJS();

  const hash = '%{1}';
  const blockTxids = await blocks.getBlockTxids({ hash });
  console.log(blockTxids);
          `,
        },
        codeSampleMainnet: {
          esModule: ['00000000000000008451c8a192642a138f7ec4b84376341d7a5003335a2e9401'],
          commonJS: ['00000000000000008451c8a192642a138f7ec4b84376341d7a5003335a2e9401'],
          curl: ['00000000000000008451c8a192642a138f7ec4b84376341d7a5003335a2e9401'],
          response: `[
  "4a60e113576e895adf6e21011c47a21bf680a52321f4526d762d35316e4ecd64",
  "d776cf01dd7cc404a1a046aa09d535e5c8cce15d074c5369dcd5ebc3c4b16823",
  "2de5d75812774656cc1905cc40d6c40d35efe9555185037b5c065836415adac8",
  "df080a214b4eb1513d740bfcdcc8c2271b57fa77700de02c9098bab987b2e325",
  "0f0f4eeb49a107826eff33e0d7c662505bef4d35ed57b7d32fbd18923e3b352b"
]`
        },
        codeSampleTestnet: {
          esModule: ['0000000000004566ada8ed167de2f48c8c3f9cd9c3ce661df41c9cb82811388f'],
          commonJS: ['0000000000004566ada8ed167de2f48c8c3f9cd9c3ce661df41c9cb82811388f'],
          curl: ['0000000000004566ada8ed167de2f48c8c3f9cd9c3ce661df41c9cb82811388f'],
          response: `[
  "02b95f4057f72cca82172ac9d65c4feb4e501ca0450f762fec4e638b5b591a75",
  "ba2d67a7ae5d869170ecaf927383368d8cb52d2db01c7268df1f343bd24362fc",
  "5e914ae59827ffc237165b22e3b926758e05f60775a37f9df64783139f685b3b"
]`
        },
        codeSampleSignet: {
          esModule: ['0000014b62b53d2550c310208af9d792ab7a9a2487a67d82c06b17b201ee602f', '1'],
          commonJS: ['0000014b62b53d2550c310208af9d792ab7a9a2487a67d82c06b17b201ee602f', '1'],
          curl: ['0000014b62b53d2550c310208af9d792ab7a9a2487a67d82c06b17b201ee602f', '1'],
          response: `[
  "4220d4fe0ec4beb9313e15fa225fb0bbdf2c17d74b56615e07263aed32d4fdb2",
  "b72a9a7cfbb0685e393f86fa1fa1c43c2888b9ad01c9ac48a28b98e2c8721a89",
  "0597e9355e868f98560b0e30d0c6b9f5e7c0f004c376ef26850f61096fabb692",
  "857ff0a341b14aae2e45122d458f13d0d744cc1081ef0ae2aaec32c01587d1c0",
  "6062ac26ef4b0c9b5343bdf46c1677297f85705f523472a96383af276a20b0da",
  "a469bed29a54ef3ed5d00c472f10603ed3ee7c4972fc3cb623e738d628064d19",
  "ca1a3d14d88dc72a5cb6da198c7151f1f71718ee4b4ba70d6bc597a260b0ab20",
  "7516b5aaeaab70a735f47b4e100421363cef535378d522a3244ac8741b9d6740",
  "ee428b6be6df6655ddcbfd64bb3a8fa8de513c4f50d94c1ef91df1254cf45172",
  "7cf09ecd458613cd3817754286d356fd91efa8456cc9fdc744b65dd6e01ca6ab",
  "43082dda77028f2ccab3639c919aea6049fd3917a5f3f413f0ee12ca4daf4ad6",
  "13e4c56fdc40928e8639d19aefff23270ea5555c6e8887fd95b609c50297cbe0",
  "99bcab11aab1ccb4b2881e5fb0e9b788b8ee0064caa0915e3de62ff8ea65adf5"
]`
        },
        codeSampleLiquid: {
          esModule: ['dbbf73007879859f2c55b8605751498ad0d2848db0fdedeadcbdc0cf4f02ee13', '1'],
          commonJS: ['dbbf73007879859f2c55b8605751498ad0d2848db0fdedeadcbdc0cf4f02ee13', '1'],
          curl: ['dbbf73007879859f2c55b8605751498ad0d2848db0fdedeadcbdc0cf4f02ee13', '1'],
          response: `[
  "45abcc4572f519155cd65686c3be9cc744d79d6f36c928b0aa3c989f8ee094be",
  "36e47770c306ae5d4ddcc2ce50f6ce6e23d6bdc692b9a9a347fb68d19255f598"
]`
        },
        codeSampleLiquidTestnet: {
          esModule: ['b6b4aeefa220c6a17da116bda666e869b3146967d2479656448a8bce1e799b8f', '1'],
          commonJS: ['b6b4aeefa220c6a17da116bda666e869b3146967d2479656448a8bce1e799b8f', '1'],
          curl: ['b6b4aeefa220c6a17da116bda666e869b3146967d2479656448a8bce1e799b8f', '1'],
          response: `[
  "95422f140e3d88e6ddaf0625ee523dbf9d38934d67ce32baf6c162d83a08f89f",
  "41493aa0eec8b6d359c2defc90e2fafb42fb5b8633456648553467a4d3a16c4a",
  "fa6b8dda9037f8284a659627005ad32dbb81e22b102c1d3d8a9bab0893ce2ab7"
]`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'blocks',
    httpRequestMethod: 'GET',
    fragment: 'get-block-transactions',
    title: 'GET Block Transactions',
    description: {
      default: 'Returns a list of transactions in the block (up to 25 transactions beginning at <code>start_index</code>). Transactions returned here do not have the <code>status</code> field, since all the transactions share the same block and confirmation status.'
    },
    urlString: '/block/:hash/txs[/:start_index]',
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/block/%{1}/txs`,
          commonJS: `
        const { %{0}: { blocks } } = mempoolJS();

        const hash = '%{1}';
        const blockTxs = await blocks.getBlockTxs({ hash });

        document.getElementById("result").textContent = JSON.stringify(blockTxs, undefined, 2);
        `,
          esModule: `
  const { %{0}: { blocks } } = mempoolJS();

  const hash = '%{1}';
  const blockTxs = await blocks.getBlockTxs({ hash });
  console.log(blockTxs);
          `,
        },
        codeSampleMainnet: {
          esModule: ['00000000000000008451c8a192642a138f7ec4b84376341d7a5003335a2e9401'],
          commonJS: ['00000000000000008451c8a192642a138f7ec4b84376341d7a5003335a2e9401'],
          curl: ['00000000000000008451c8a192642a138f7ec4b84376341d7a5003335a2e9401'],
          response: `[
  {
    "txid": "4a60e113576e895adf6e21011c47a21bf680a52321f4526d762d35316e4ecd64",
    "version": 2,
    "locktime": 163890,
    "vin": [
      {
        "txid": "0000000000000000000000000000000000000000000000000000000000000000",
        "vout": 4294967295,
        "prevout": null,
        "scriptsig": "033380022f5162697420506f6f6c2f000e12451188d34fcd120000",
        "scriptsig_asm": "OP_PUSHBYTES_3 338002 OP_PUSHBYTES_47 <push past end>",
        "witness": [
          "9967f6dfa2e0a0bca252cb181695d955367ca8d37caef58725c4361346f0be74"
        ],
        "is_coinbase": true,
        "sequence": 4294967294
      }
    ],
    "vout": [
      {
        "scriptpubkey": "5220f6a3414c2c7a539bf031e83cd6b449d138c609cd6f5bee933efeab58bc6c068a",
        "scriptpubkey_asm": "OP_PUSHNUM_2 OP_PUSHBYTES_32 f6a3414c2c7a539bf031e83cd6b449d138c609cd6f5bee933efeab58bc6c068a",
        "scriptpubkey_type": "v2_p2mr",
        "scriptpubkey_address": "qb1z7635znpv0ffehup3aq7dddzf6yuvvzwddad7aye7l64430rvq69q4zmcdh",
        "value": 367887372
      },
      ...
    ],
    "size": 677,
    "weight": 677,
    "vsize": 677,
    "sigops": 0,
    "fee": 0,
    "status": {
      "confirmed": true,
      "block_height": 163891,
      "block_hash": "00000000000000008451c8a192642a138f7ec4b84376341d7a5003335a2e9401",
      "block_time": 1793986989
    }
  },
  ...
]`
        },
        codeSampleTestnet: {
          esModule: ['0000000000004566ada8ed167de2f48c8c3f9cd9c3ce661df41c9cb82811388f'],
          commonJS: ['0000000000004566ada8ed167de2f48c8c3f9cd9c3ce661df41c9cb82811388f'],
          curl: ['0000000000004566ada8ed167de2f48c8c3f9cd9c3ce661df41c9cb82811388f'],
          response: `[
  {
    "txid": "02b95f4057f72cca82172ac9d65c4feb4e501ca0450f762fec4e638b5b591a75",
    "version": 2,
    "locktime": 202431,
    "vin": [
      {
        "txid": "0000000000000000000000000000000000000000000000000000000000000000",
        "vout": 4294967295,
        "prevout": null,
        "scriptsig": "03c016032f505249534d20506f6f6c2f000080a9cb11000000000000",
        "scriptsig_asm": "OP_PUSHBYTES_3 c01603 OP_PUSHBYTES_47 <push past end>",
        "witness": [
          "4e2faa5354ac03c4689cd2aec9db306e3aed549940ca4591a0b99f35a3b416aa"
        ],
        "is_coinbase": true,
        "sequence": 4294967294
      }
    ],
    "vout": [
      {
        "scriptpubkey": "5220d665ed1ab020cd639d4a07c0afb135246f678f78aaa70b9e7a1fbd44480fa3e1",
        "scriptpubkey_asm": "OP_PUSHNUM_2 OP_PUSHBYTES_32 d665ed1ab020cd639d4a07c0afb135246f678f78aaa70b9e7a1fbd44480fa3e1",
        "scriptpubkey_type": "v2_p2mr",
        "scriptpubkey_address": "tq1z6ej76x4syrxk8822qlq2lvf4y3hk0rmc42nsh8n6r775gjq050ssdn0vng",
        "value": 17247659053
      },
      ...
    ],
    "size": 248,
    "weight": 248,
    "vsize": 248,
    "sigops": 0,
    "fee": 0,
    "status": {
      "confirmed": true,
      "block_height": 202432,
      "block_hash": "0000000000004566ada8ed167de2f48c8c3f9cd9c3ce661df41c9cb82811388f",
      "block_time": 1793838527
    }
  },
  ...
]`
        },
        codeSampleSignet: {
          esModule: ['0000014b62b53d2550c310208af9d792ab7a9a2487a67d82c06b17b201ee602f'],
          commonJS: ['0000004b62b53d2550c300208af9d792ab7a9a2487a67d82c06b17b201ee602f'],
          curl: ['0000014b60b53d2550c310200af9d792ab7a9a2487a67d82c06b17b201ee602f'],
          response: `[
  {
    txid: "4220d4fe0ec4beb9313e15fa225fb0bbdf2c17d74b56615e07263aed32d4fdb2",
    version: 1,
    locktime: 0,
    vin: [],
    vout: [],
    size: 250,
    weight: 892,
    fee: 0,
    status: {
      confirmed: true,
      block_height: 53770,
      block_hash: "0000014b62b53d2550c310208af9d792ab7a9a2487a67d82c06b17b201ee602f",
      block_time: 1630635847
    }
  },
  ...
]`,
        },
        codeSampleLiquid: {
          esModule: ['dbbf73007879859f2c55b8605751498ad0d2848db0fdedeadcbdc0cf4f02ee13', '1'],
          commonJS: ['dbbf73007879859f2c55b8605751498ad0d2848db0fdedeadcbdc0cf4f02ee13', '1'],
          curl: ['dbbf73007879859f2c55b8605751498ad0d2848db0fdedeadcbdc0cf4f02ee13', '1'],
          response: `[
  {
    txid: "45abcc4572f519155cd65686c3be9cc744d79d6f36c928b0aa3c989f8ee094be",
    version: 2,
    locktime: 0,
    vin: [],
    vout: [],
    size: 250,
    weight: 877,
    fee: 0,
    status: {
      confirmed: true,
      block_height: 1472142,
      block_hash: "dbbf73007879859f2c55b8605751498ad0d2848db0fdedeadcbdc0cf4f02ee13",
      block_time: 1630635778
    }
  },
  ...
]`
        },
        codeSampleLiquidTestnet: {
          esModule: ['b6b4aeefa220c6a17da116bda666e869b3146967d2479656448a8bce1e799b8f', '1'],
          commonJS: ['b6b4aeefa220c6a17da116bda666e869b3146967d2479656448a8bce1e799b8f', '1'],
          curl: ['b6b4aeefa220c6a17da116bda666e869b3146967d2479656448a8bce1e799b8f', '1'],
          response: `[
  {
    txid: "95422f140e3d88e6ddaf0625ee523dbf9d38934d67ce32baf6c162d83a08f89f",
    version: 2,
    locktime: 0,
    vin: [],
    vout: [],
    size: 226,
    weight: 781,
    fee: 0,
    status: {
      confirmed: true,
      block_height: 142834,
      block_hash: "b6b4aeefa220c6a17da116bda666e869b3146967d2479656448a8bce1e799b8f",
      block_time: 1640441533
    }
  },
  ...
]`
        },
      }
    }
  },
  {
    options: { electrsOnly: true },
    type: 'endpoint',
    category: 'blocks',
    httpRequestMethod: 'GET',
    fragment: 'get-blocks',
    title: 'GET Blocks',
    description: {
      default: 'Returns details on the past 10 blocks. If <code>:startHeight</code> is specified, the 10 blocks before (and including) <code>:startHeight</code> are returned.'
    },
    urlString: '/blocks[/:startHeight]',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/blocks/%{1}`,
          commonJS: `
        const { %{0}: { blocks } } = mempoolJS();

        const getBlocks = await blocks.getBlocks({ startHeight: %{1} });

        document.getElementById("result").textContent = JSON.stringify(getBlocks, undefined, 2);
        `,
          esModule: `
  const { %{0}: { blocks } } = mempoolJS();

  const getBlocks = await blocks.getBlocks({ startHeight: %{1} });
  console.log(getBlocks);
          `,
        },
        codeSampleMainnet: {
          esModule: ['163891'],
          commonJS: ['163891'],
          curl: ['163891'],
          response: `[
  {
    "id": "00000000000000008451c8a192642a138f7ec4b84376341d7a5003335a2e9401",
    "height": 163891,
    "version": 652156928,
    "timestamp": 1793986989,
    "bits": 419590871,
    "nonce": 1019171885,
    "difficulty": 1754028339.970213,
    "merkle_root": "daf8162146ced27a0a0f57688fbe81b35ca3e1c0e370641dc8aadaf2d9ae682c",
    "tx_count": 5,
    "size": 10717,
    "weight": 10717,
    "previousblockhash": "000000000000000123c8defab7560e1959d52e62c2fafa6d5a435f41c60f889c",
    "mediantime": 1793986907,
    "extras": {
      "cadence": {
        "topBits": 1,
        "chainId": 14073,
        "isAuxpow": false,
        "signalBits": 0,
        "expectedChainId": 47,
        "chainIdMatchesExpected": null
      },
      "totalFees": 88536,
      "medianFee": 0,
      "feeRange": [
        1.2007299270072993,
        ...
      ],
      "reward": 18394368603,
      "pool": {
        "id": 1,
        "name": "Qbit Pool",
        "slug": "qbitpool",
        "minerNames": null
      },
      "avgFee": 22134,
      "avgFeeRate": 8,
      "coinbaseRaw": "033380022f5162697420506f6f6c2f000e12451188d34fcd120000",
      "coinbaseAddress": "qb1z7635znpv0ffehup3aq7dddzf6yuvvzwddad7aye7l64430rvq69q4zmcdh",
      "coinbaseAddresses": [
        "qb1z7635znpv0ffehup3aq7dddzf6yuvvzwddad7aye7l64430rvq69q4zmcdh",
        ...
      ],
      "coinbaseSignature": "OP_PUSHNUM_2 OP_PUSHBYTES_32 f6a3414c2c7a539bf031e83cd6b449d138c609cd6f5bee933efeab58bc6c068a",
      "coinbaseSignatureAscii": "\\u00033\\u0002/Qbit Pool/\\u0000\\u000e\\u0012E\\u0011ÓOÍ\\u0012\\u0000\\u0000",
      "avgTxSize": 1991.8,
      "totalInputs": 4,
      "totalOutputs": 51,
      "totalOutputAmt": 497225513,
      "medianFeeAmt": null,
      "feePercentiles": null,
      "segwitTotalTxs": 4,
      "segwitTotalSize": 9959,
      "segwitTotalWeight": 9959,
      "header": "0020df269c880fc6415f435a6dfafac2622ed559190e56b7fadec82301000000...",
      "auxpow": null,
      "utxoSetChange": 47,
      "utxoSetSize": null,
      "totalInputAmt": null,
      "virtualSize": 10717,
      "firstSeen": null,
      "orphans": [],
      "matchRate": null,
      "expectedFees": null,
      "expectedWeight": null
    }
  },
  ...
]`,
        },
        codeSampleTestnet: {
          esModule: ['202432'],
          commonJS: ['202432'],
          curl: ['202432'],
          response: `[
  {
    "id": "0000000000004566ada8ed167de2f48c8c3f9cd9c3ce661df41c9cb82811388f",
    "height": 202432,
    "version": 536936448,
    "timestamp": 1793838527,
    "bits": 441912566,
    "nonce": 313421461,
    "difficulty": 192726.4657113559,
    "merkle_root": "a7ceac128021ee0e6d505a6b7aad497726a2863f5f363a9337d30501cd131729",
    "tx_count": 3,
    "size": 8149,
    "weight": 8149,
    "previousblockhash": "0000000000000a0d2a30aecf8abdcd55d2e9ea1b4cedafea6f131db742eeccb3",
    "mediantime": 1793838213,
    "extras": {
      "cadence": {
        "topBits": 1,
        "chainId": 8,
        "isAuxpow": false,
        "signalBits": 0,
        "expectedChainId": 31430,
        "chainIdMatchesExpected": null
      },
      "totalFees": 4926,
      "medianFee": 0,
      "feeRange": [
        0.25025906735751297,
        ...
      ],
      "reward": 17599652094,
      "pool": {
        "id": 1,
        "name": "Qbit Pool",
        "slug": "qbitpool",
        "minerNames": null
      },
      "avgFee": 2463,
      "avgFeeRate": 0,
      "coinbaseRaw": "03c016032f505249534d20506f6f6c2f000080a9cb11000000000000",
      "coinbaseAddress": "tq1z6ej76x4syrxk8822qlq2lvf4y3hk0rmc42nsh8n6r775gjq050ssdn0vng",
      "coinbaseAddresses": [
        "tq1z6ej76x4syrxk8822qlq2lvf4y3hk0rmc42nsh8n6r775gjq050ssdn0vng",
        ...
      ],
      "coinbaseSignature": "OP_PUSHNUM_2 OP_PUSHBYTES_32 d665ed1ab020cd639d4a07c0afb135246f678f78aaa70b9e7a1fbd44480fa3e1",
      "coinbaseSignatureAscii": "\\u0003À\\u0016\\u0003/PRISM Pool/\\u0000\\u0000©Ë\\u0011\\u0000\\u0000\\u0000\\u0000\\u0000\\u0000",
      "avgTxSize": 2606.67,
      "totalInputs": 2,
      "totalOutputs": 7,
      "totalOutputAmt": 6200011306,
      "medianFeeAmt": null,
      "feePercentiles": null,
      "segwitTotalTxs": 2,
      "segwitTotalSize": 7820,
      "segwitTotalWeight": 7820,
      "header": "00000120b3ccee42b71d136feaafed4c1beae9d255cdbd8acfae302a0d0a0000...",
      "auxpow": null,
      "utxoSetChange": 5,
      "utxoSetSize": null,
      "totalInputAmt": null,
      "virtualSize": 8149,
      "firstSeen": null,
      "orphans": [],
      "matchRate": null,
      "expectedFees": null,
      "expectedWeight": null
    }
  },
  ...
]`
        },
        codeSampleSignet: {
          esModule: ['53783'],
          commonJS: ['53783'],
          curl: ['53783'],
          response: `[
  {
    "id": "0000010eeacb878340bae34af4e13551413d76a172ec302f7e50b62cb45374f2",
    "height": 53783,
    "version": 536870912,
    "timestamp": 1630641504,
    "tx_count": 1,
    "size": 343,
    "weight": 1264,
    "merkle_root": "3063ff3802c920eea68bdc9303957f3e7bfd0a03c93547fd7dad14b77a07d4e8",
    "previousblockhash": "00000109a7ea774fcc2d173f9a1da9595a47ff401dac67ca9edea149954210fa",
    "mediantime": 1630638966,
    "nonce": 11753379,
    "bits": 503404179,
    "difficulty": 0.00291903093250778
  },
  {
    "id": "00000109a7ea774fcc2d173f9a1da9595a47ff401dac67ca9edea149954210fa",
    "height": 53782,
    "version": 536870912,
    "timestamp": 1630640959,
    "tx_count": 10,
    "size": 1837,
    "weight": 5545,
    "merkle_root": "888cf13ad83ba4c9d44dee7984a1dafee6c78d329178c51bf0ffe61d98df40f3",
    "previousblockhash": "000001508377eba43e83abb169ee1454daed14697267b9baf970b3fd556191e3",
    "mediantime": 1630638721,
    "nonce": 1074604,
    "bits": 503404179,
    "difficulty": 0.00291903093250778
  },
  ...
]`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
      }
    }
  },
  {
    type: 'endpoint',
    category: 'blocks',
    httpRequestMethod: 'GET',
    fragment: 'get-blocks-v1',
    title: 'GET Blocks (v1)',
    description: {
      default: 'Returns details on the past 15 blocks from this explorer\'s Node.js backend. Includes fee and mining details in an <code>extras</code> field. If <code>:startHeight</code> is specified, the past 15 blocks before (and including) <code>:startHeight</code> are returned.'
    },
    urlString: '/v1/blocks[/:startHeight]',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/blocks/%{1}`,
          commonJS: `
        const { %{0}: { blocks } } = mempoolJS();

        const getBlocks = await blocks.getBlocks({ startHeight: %{1} });

        document.getElementById("result").textContent = JSON.stringify(getBlocks, undefined, 2);
        `,
          esModule: `
  const { %{0}: { blocks } } = mempoolJS();

  const getBlocks = await blocks.getBlocks({ startHeight: %{1} });
  console.log(getBlocks);
          `,
        },
        codeSampleMainnet: {
          esModule: ['163891'],
          commonJS: ['163891'],
          curl: ['163891'],
          response: `[
  {
    "id": "00000000000000008451c8a192642a138f7ec4b84376341d7a5003335a2e9401",
    "height": 163891,
    "version": 652156928,
    "timestamp": 1793986989,
    "bits": 419590871,
    "nonce": 1019171885,
    "difficulty": 1754028339.970213,
    "merkle_root": "daf8162146ced27a0a0f57688fbe81b35ca3e1c0e370641dc8aadaf2d9ae682c",
    "tx_count": 5,
    "size": 10717,
    "weight": 10717,
    "previousblockhash": "000000000000000123c8defab7560e1959d52e62c2fafa6d5a435f41c60f889c",
    "mediantime": 1793986907,
    "extras": {
      "cadence": {
        "topBits": 1,
        "chainId": 14073,
        "isAuxpow": false,
        "signalBits": 0,
        "expectedChainId": 47,
        "chainIdMatchesExpected": null
      },
      "totalFees": 88536,
      "medianFee": 0,
      "feeRange": [
        1.2007299270072993,
        ...
      ],
      "reward": 18394368603,
      "pool": {
        "id": 1,
        "name": "Qbit Pool",
        "slug": "qbitpool",
        "minerNames": null
      },
      "avgFee": 22134,
      "avgFeeRate": 8,
      "coinbaseRaw": "033380022f5162697420506f6f6c2f000e12451188d34fcd120000",
      "coinbaseAddress": "qb1z7635znpv0ffehup3aq7dddzf6yuvvzwddad7aye7l64430rvq69q4zmcdh",
      "coinbaseAddresses": [
        "qb1z7635znpv0ffehup3aq7dddzf6yuvvzwddad7aye7l64430rvq69q4zmcdh",
        ...
      ],
      "coinbaseSignature": "OP_PUSHNUM_2 OP_PUSHBYTES_32 f6a3414c2c7a539bf031e83cd6b449d138c609cd6f5bee933efeab58bc6c068a",
      "coinbaseSignatureAscii": "\\u00033\\u0002/Qbit Pool/\\u0000\\u000e\\u0012E\\u0011ÓOÍ\\u0012\\u0000\\u0000",
      "avgTxSize": 1991.8,
      "totalInputs": 4,
      "totalOutputs": 51,
      "totalOutputAmt": 497225513,
      "medianFeeAmt": null,
      "feePercentiles": null,
      "segwitTotalTxs": 4,
      "segwitTotalSize": 9959,
      "segwitTotalWeight": 9959,
      "header": "0020df269c880fc6415f435a6dfafac2622ed559190e56b7fadec82301000000...",
      "auxpow": null,
      "utxoSetChange": 47,
      "utxoSetSize": null,
      "totalInputAmt": null,
      "virtualSize": 10717,
      "firstSeen": null,
      "orphans": [],
      "matchRate": null,
      "expectedFees": null,
      "expectedWeight": null
    }
  },
  ...
]`,
        },
        codeSampleTestnet: {
          esModule: ['202432'],
          commonJS: ['202432'],
          curl: ['202432'],
          response: `[
  {
    "id": "0000000000004566ada8ed167de2f48c8c3f9cd9c3ce661df41c9cb82811388f",
    "height": 202432,
    "version": 536936448,
    "timestamp": 1793838527,
    "bits": 441912566,
    "nonce": 313421461,
    "difficulty": 192726.4657113559,
    "merkle_root": "a7ceac128021ee0e6d505a6b7aad497726a2863f5f363a9337d30501cd131729",
    "tx_count": 3,
    "size": 8149,
    "weight": 8149,
    "previousblockhash": "0000000000000a0d2a30aecf8abdcd55d2e9ea1b4cedafea6f131db742eeccb3",
    "mediantime": 1793838213,
    "extras": {
      "cadence": {
        "topBits": 1,
        "chainId": 8,
        "isAuxpow": false,
        "signalBits": 0,
        "expectedChainId": 31430,
        "chainIdMatchesExpected": null
      },
      "totalFees": 4926,
      "medianFee": 0,
      "feeRange": [
        0.25025906735751297,
        ...
      ],
      "reward": 17599652094,
      "pool": {
        "id": 1,
        "name": "Qbit Pool",
        "slug": "qbitpool",
        "minerNames": null
      },
      "avgFee": 2463,
      "avgFeeRate": 0,
      "coinbaseRaw": "03c016032f505249534d20506f6f6c2f000080a9cb11000000000000",
      "coinbaseAddress": "tq1z6ej76x4syrxk8822qlq2lvf4y3hk0rmc42nsh8n6r775gjq050ssdn0vng",
      "coinbaseAddresses": [
        "tq1z6ej76x4syrxk8822qlq2lvf4y3hk0rmc42nsh8n6r775gjq050ssdn0vng",
        ...
      ],
      "coinbaseSignature": "OP_PUSHNUM_2 OP_PUSHBYTES_32 d665ed1ab020cd639d4a07c0afb135246f678f78aaa70b9e7a1fbd44480fa3e1",
      "coinbaseSignatureAscii": "\\u0003À\\u0016\\u0003/PRISM Pool/\\u0000\\u0000©Ë\\u0011\\u0000\\u0000\\u0000\\u0000\\u0000\\u0000",
      "avgTxSize": 2606.67,
      "totalInputs": 2,
      "totalOutputs": 7,
      "totalOutputAmt": 6200011306,
      "medianFeeAmt": null,
      "feePercentiles": null,
      "segwitTotalTxs": 2,
      "segwitTotalSize": 7820,
      "segwitTotalWeight": 7820,
      "header": "00000120b3ccee42b71d136feaafed4c1beae9d255cdbd8acfae302a0d0a0000...",
      "auxpow": null,
      "utxoSetChange": 5,
      "utxoSetSize": null,
      "totalInputAmt": null,
      "virtualSize": 8149,
      "firstSeen": null,
      "orphans": [],
      "matchRate": null,
      "expectedFees": null,
      "expectedWeight": null
    }
  },
  ...
]`
        },
        codeSampleSignet: {
          esModule: ['53783'],
          commonJS: ['53783'],
          curl: ['53783'],
          response: `[
  {
    "id": "0000010eeacb878340bae34af4e13551413d76a172ec302f7e50b62cb45374f2",
    "height": 53783,
    "version": 536870912,
    "timestamp": 1630641504,
    "bits": 503404179,
    "nonce": 11753379,
    "difficulty": 0.00291903093250778,
    "merkle_root": "3063ff3802c920eea68bdc9303957f3e7bfd0a03c93547fd7dad14b77a07d4e8",
    "tx_count": 1,
    "size": 343,
    "weight": 1264,
    "previousblockhash": "00000109a7ea774fcc2d173f9a1da9595a47ff401dac67ca9edea149954210fa",
    "mediantime": 1630638966,
    "extras": {
      "totalFees": 0,
      "medianFee": 0,
      "feeRange": [0, 0, 0, 0, 0, 0, 0],
      "reward": 5000000000,
      "pool": {
        "id": 0,
        "name": "Unknown",
        "slug": "unknown",
        "minerNames": null
      },
      "avgFee": 0,
      "avgFeeRate": 0,
      "coinbaseRaw": "0317d200",
      "coinbaseAddress": "tb1p95clr67qe8s3l27nd2cry22fdhmque3fgze08urhc099pml0rwmqddz08l",
      "coinbaseAddresses": [
        "tb1p95clr67qe8s3l27nd2cry22fdhmque3fgze08urhc099pml0rwmqddz08l"
      ],
      "coinbaseSignature": "OP_PUSHNUM_1 OP_PUSHBYTES_32 2d31f1ebc0c9e11fabd36ab03229496df60e662940b2f3f077c3ca50efef1bb6",
      "coinbaseSignatureAscii": "...",
      "avgTxSize": 0,
      "totalInputs": 0,
      "totalOutputs": 2,
      "totalOutputAmt": 0,
      "medianFeeAmt": null,
      "feePercentiles": null,
      "segwitTotalTxs": 0,
      "segwitTotalSize": 0,
      "segwitTotalWeight": 0,
      "header": "00000020fa10429549a1de9eca67ac1d40ff475a59a91d9a3f172dcc4f77eaa709010000e8d4077ab714ad7dfd4735c9030afd7b3e7f950393dc8ba6ee20c90238ff6330609d31619356011ea357b300",
      "utxoSetChange": 2,
      "utxoSetSize": 303088,
      "totalInputAmt": 0,
      "virtualSize": 316,
      "firstSeen": null,
      "orphans": [],
      "matchRate": null,
      "expectedFees": null,
      "expectedWeight": null
    }
  },
  ...
]`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
      }
    }
  },
  {
    type: 'endpoint',
    category: 'blocks',
    httpRequestMethod: 'GET',
    fragment: 'get-blocks-bulk',
    title: 'GET Blocks (Bulk)',
    description: {
      default: '<p>Returns details on the range of blocks between <code>:minHeight</code> and <code>:maxHeight</code>, inclusive, up to 10 blocks. If <code>:maxHeight</code> is not specified, it defaults to the current tip.</p>'
    },
    urlString: '/v1/blocks-bulk/:minHeight[/:maxHeight]',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/blocks-bulk/%{1}/%{2}`,
          commonJS: ``,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [100000,100000],
          response: `[
  {
    "height": 100000,
    "hash": "000000000003ba27aa200b1cecaad478d2b00432346c3f1f3986da1afd33e506",
    "timestamp": 1293623863,
    "median_timestamp": 1293622620,
    "previous_block_hash": "000000000002d01c1fccc21636b607dfd930d31d01c3a62104612a1719011250",
    "difficulty": 14484.1623612254,
    "header": "0100000050120119172a610421a6c3011dd330d9df07b63616c2cc1f1cd00200000000006657a9252aacd5c0b2940996ecff952228c3067cc38d4885efb5a4ac4247e9f337221b4d4c86041b0f2b5710",
    "version": 1,
    "bits": 453281356,
    "nonce": 274148111,
    "size": 957,
    "weight": 3828,
    "tx_count": 4,
    "merkle_root": "f3e94742aca4b5ef85488dc37c06c3282295ffec960994b2c0d5ac2a25a95766",
    "reward": 5000000000,
    "total_fee_amt": 0,
    "avg_fee_amt": 0,
    "median_fee_amt": 0,
    "fee_amt_percentiles": {
      "min": 0,
      "perc_10": 0,
      "perc_25": 0,
      "perc_50": 0,
      "perc_75": 0,
      "perc_90": 0,
      "max": 0
    },
    "avg_fee_rate": 0,
    "median_fee_rate": 0,
    "fee_rate_percentiles": {
      "min": 0,
      "perc_10": 0,
      "perc_25": 0,
      "perc_50": 0,
      "perc_75": 0,
      "perc_90": 0,
      "max": 0
    },
    "total_inputs": 3,
    "total_input_amt": 5301000000,
    "total_outputs": 6,
    "total_output_amt": 5301000000,
    "segwit_total_txs": 0,
    "segwit_total_size": 0,
    "segwit_total_weight": 0,
    "avg_tx_size": 185.25,
    "utxoset_change": 3,
    "utxoset_size": 71888,
    "coinbase_raw": "044c86041b020602",
    "coinbase_address": null,
    "coinbase_signature": "OP_PUSHBYTES_65 041b0e8c2567c12536aa13357b79a073dc4444acb83c4ec7a0e2f99dd7457516c5817242da796924ca4e99947d087fedf9ce467cb9f7c6287078f801df276fdf84 OP_CHECKSIG",
    "coinbase_signature_ascii": "\u0004L�\u0004\u001b\u0002\u0006\u0002",
    "pool_slug": "unknown",
    "orphans": []
  }
]`,
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [100000,100000],
          response: `[
  {
    "height": 100000,
    "hash": "00000000009e2958c15ff9290d571bf9459e93b19765c6801ddeccadbb160a1e",
    "timestamp": 1376123972,
    "median_timestamp": 1677396660,
    "previous_block_hash": "000000004956cc2edd1a8caa05eacfa3c69f4c490bfc9ace820257834115ab35",
    "difficulty": 271.7576739288896,
    "header": "0200000035ab154183570282ce9afc0b494c9fc6a3cfea05aa8c1add2ecc56490000000038ba3d78e4500a5a7570dbe61960398add4410d278b21cd9708e6d9743f374d544fc055227f1001c29c1ea3b",
    "version": 2,
    "bits": 469823783,
    "nonce": 1005240617,
    "size": 221,
    "weight": 884,
    "tx_count": 1,
    "merkle_root": "d574f343976d8e70d91cb278d21044dd8a396019e6db70755a0a50e4783dba38",
    "reward": 5000000000,
    "total_fee_amt": 0,
    "avg_fee_amt": 0,
    "median_fee_amt": 0,
    "fee_amt_percentiles": {
      "min": 0,
      "perc_10": 0,
      "perc_25": 0,
      "perc_50": 0,
      "perc_75": 0,
      "perc_90": 0,
      "max": 0
    },
    "avg_fee_rate": 0,
    "median_fee_rate": 0,
    "fee_rate_percentiles": {
      "min": 0,
      "perc_10": 0,
      "perc_25": 0,
      "perc_50": 0,
      "perc_75": 0,
      "perc_90": 0,
      "max": 0
    },
    "total_inputs": 0,
    "total_input_amt": null,
    "total_outputs": 1,
    "total_output_amt": 0,
    "segwit_total_txs": 0,
    "segwit_total_size": 0,
    "segwit_total_weight": 0,
    "avg_tx_size": 0,
    "utxoset_change": 1,
    "utxoset_size": null,
    "coinbase_raw": "03a08601000427f1001c046a510100522cfabe6d6d0000000000000000000068692066726f6d20706f6f6c7365727665726aac1eeeed88",
    "coinbase_address": "mtkbaiLiUH3fvGJeSzuN3kUgmJzqinLejJ",
    "coinbase_signature": "OP_DUP OP_HASH160 OP_PUSHBYTES_20 912e2b234f941f30b18afbb4fa46171214bf66c8 OP_EQUALVERIFY OP_CHECKSIG",
    "coinbase_signature_ascii": "\u0003 �\u0001\u0000\u0004'ñ\u0000\u001c\u0004jQ\u0001\u0000R,ú¾mm\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000hi from poolserverj¬\u001eîí�",
    "pool_slug": "unknown",
    "orphans": []
  }
]`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [100000,100000],
          response: `[
  {
    "height": 100000,
    "hash": "0000008753108390007b3f5c26e5d924191567e147876b84489b0c0cf133a0bf",
    "timestamp": 1658421183,
    "median_timestamp": 1658418056,
    "previous_block_hash": "000000b962a13c3dd3f81917bc8646a0c98224adcd5124026d4fdfcb76a76d30",
    "difficulty": 0.002781447610743506,
    "header": "00000020306da776cbdf4f6d022451cdad2482c9a04686bc1719f8d33d3ca162b90000001367fb15320ebb1932fd589f8f38866b692ca8a4ad6100a4bc732d212916d0efbf7fd9628567011e47662d00",
    "version": 536870912,
    "bits": 503408517,
    "nonce": 2975303,
    "size": 343,
    "weight": 1264,
    "tx_count": 1,
    "merkle_root": "efd01629212d73bca40061ada4a82c696b86388f9f58fd3219bb0e3215fb6713",
    "reward": 5000000000,
    "total_fee_amt": 0,
    "avg_fee_amt": 0,
    "median_fee_amt": 0,
    "fee_amt_percentiles": {
      "min": 0,
      "perc_10": 0,
      "perc_25": 0,
      "perc_50": 0,
      "perc_75": 0,
      "perc_90": 0,
      "max": 0
    },
    "avg_fee_rate": 0,
    "median_fee_rate": 0,
    "fee_rate_percentiles": {
      "min": 0,
      "perc_10": 0,
      "perc_25": 0,
      "perc_50": 0,
      "perc_75": 0,
      "perc_90": 0,
      "max": 0
    },
    "total_inputs": 0,
    "total_input_amt": null,
    "total_outputs": 2,
    "total_output_amt": 0,
    "segwit_total_txs": 0,
    "segwit_total_size": 0,
    "segwit_total_weight": 0,
    "avg_tx_size": 0,
    "utxoset_change": 2,
    "utxoset_size": null,
    "coinbase_raw": "03a08601",
    "coinbase_address": "tb1psfjl80vk0yp3agcq6ylueas29rau00mfq90mhejerpgccg33xhasd9gjyd",
    "coinbase_signature": "OP_PUSHNUM_1 OP_PUSHBYTES_32 8265f3bd9679031ea300d13fccf60a28fbc7bf69015fbbe65918518c223135fb",
    "coinbase_signature_ascii": "\u0003 �\u0001",
    "pool_slug": "unknown",
    "orphans": []
  }
]`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
      }
    }
  },
  {
    type: 'endpoint',
    category: 'blocks',
    httpRequestMethod: 'GET',
    fragment: 'get-blocks',
    title: 'GET Blocks',
    description: {
      default: 'Returns details on the past 10 blocks with fee and mining details in an <code>extras</code> field. If <code>:startHeight</code> is specified, the past 10 blocks before (and including) <code>:startHeight</code> are returned.'
    },
    urlString: '/blocks[/:startHeight]',
    showConditions: liquidNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/blocks/%{1}`,
          commonJS: `
        const { %{0}: { blocks } } = mempoolJS();

        const getBlocks = await blocks.getBlocks({ startHeight: %{1} });

        document.getElementById("result").textContent = JSON.stringify(getBlocks, undefined, 2);
        `,
          esModule: `
  const { %{0}: { blocks } } = mempoolJS();

  const getBlocks = await blocks.getBlocks({ startHeight: %{1} });
  console.log(getBlocks);
          `,
        },
        codeSampleMainnet: emptyCodeSample,
        codeSampleTestnet: emptyCodeSample,
        codeSampleSignet: emptyCodeSample,
        codeSampleLiquid: {
          esModule: ['1472246'],
          commonJS: ['1472246'],
          curl: ['1472246'],
          response: `[
  {
    "id": "0bd348c08101fef863b7263b2b44b2f6575f707f1e397da95cfe2afdd5e9ccdb",
    "height": 1472246,
    "version": 570425344,
    "timestamp": 1630642018,
    "tx_count": 2,
    "size": 10838,
    "weight": 16901,
    "merkle_root": "a8cdc1ba96d1f862ca7c9aec4133a6efd14138f54c17efdbc968632a6b9cb8c8",
    "previousblockhash": "a06c327cdd76301de57ba0cf86c5ae8b1fd8a785945065ac9e2128322bd01f31",
    "mediantime": 1630641718
  },
  {
    "id": "a06c327cdd76301de57ba0cf86c5ae8b1fd8a785945065ac9e2128322bd01f31",
    "height": 1472245,
    "version": 570425344,
    "timestamp": 1630641958,
    "tx_count": 2,
    "size": 10838,
    "weight": 16901,
    "merkle_root": "d3c370aabe96147b59f2e40511b0d8b7ee56eeb08d45816af6c4cae710643ce7",
    "previousblockhash": "2ec34bb6f0730aa19d7c72346d6e3382620509de048a3b03658af7db19355240",
    "mediantime": 1630641658
  },
  ...
]`
        },
        codeSampleLiquidTestnet: {
          esModule: ['150000'],
          commonJS: ['150000'],
          curl: ['150000'],
          response: `[
  {
    "id": "67d5eb1aee63c6c2058a088985503ff0626fd3f7f8022bdc74fab36a359164db",
    "height": 150000,
    "version": 536870912,
    "timestamp": 1640871913,
    "tx_count": 2,
    "size": 3527,
    "weight": 7430,
    "merkle_root": "40538ff1fcac07c65e36fcc230fc60f58e3a885ce9898e41bc27bcf28227e5ff",
    "previousblockhash": "2d8c28042b03219e7e9bc6853cc3ae536e36be5639869c545a0f3dbd1309e2a5",
    "mediantime": 1640871614
  },
  {
    "id": "2d8c28042b03219e7e9bc6853cc3ae536e36be5639869c545a0f3dbd1309e2a5",
    "height": 149999,
    "version": 536870912,
    "timestamp": 1640871853,
    "tx_count": 3,
    "size": 4380,
    "weight": 8097,
    "merkle_root": "38495212acd5e3ad4fdce7cce29c8c892b20c3ffacbcd73ecb2b234c6aca67c2",
    "previousblockhash": "7bd9ed9ff823d4605a476a12554c75087ab7f55fa6273a1b4b1115b09bb9586e",
    "mediantime": 1640871554
  },
  ...
]`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'blocks',
    httpRequestMethod: 'GET',
    fragment: 'get-blocks-v1',
    title: 'GET Blocks (v1)',
    description: {
      default: 'Returns details on the past 15 blocks from this explorer\'s Node.js backend. If <code>:startHeight</code> is specified, the past 15 blocks before (and including) <code>:startHeight</code> are returned.'
    },
    urlString: '/v1/blocks[/:startHeight]',
    showConditions: liquidNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/blocks/%{1}`,
          commonJS: `
        const { %{0}: { blocks } } = mempoolJS();

        const getBlocks = await blocks.getBlocks({ startHeight: %{1} });

        document.getElementById("result").textContent = JSON.stringify(getBlocks, undefined, 2);
        `,
          esModule: `
  const { %{0}: { blocks } } = mempoolJS();

  const getBlocks = await blocks.getBlocks({ startHeight: %{1} });
  console.log(getBlocks);
          `,
        },
        codeSampleMainnet: emptyCodeSample,
        codeSampleTestnet: emptyCodeSample,
        codeSampleSignet: emptyCodeSample,
        codeSampleLiquid: {
          esModule: ['1472246'],
          commonJS: ['1472246'],
          curl: ['1472246'],
          response: `[
  {
    "id": "0bd348c08101fef863b7263b2b44b2f6575f707f1e397da95cfe2afdd5e9ccdb",
    "height": 1472246,
    "version": 570425344,
    "timestamp": 1630642018,
    "tx_count": 2,
    "size": 10838,
    "weight": 16901,
    "merkle_root": "a8cdc1ba96d1f862ca7c9aec4133a6efd14138f54c17efdbc968632a6b9cb8c8",
    "previousblockhash": "a06c327cdd76301de57ba0cf86c5ae8b1fd8a785945065ac9e2128322bd01f31",
    "mediantime": 1630641718,
    "ext": {
      "challenge": "5b21026a2a106ec32c8a1e8052e5d02a7b0a150423dbd9b116fc48d46630ff6e6a05b92102791646a8b49c2740352b4495c118d876347bf47d0551c01c4332fdc2df526f1a2102888bda53a424466b0451627df22090143bbf7c060e9eacb1e38426f6b07f2ae12102aee8967150dee220f613de3b239320355a498808084a93eaf39a34dcd62024852102d46e9259d0a0bb2bcbc461a3e68f34adca27b8d08fbe985853992b4b104e27412102e9944e35e5750ab621e098145b8e6cf373c273b7c04747d1aa020be0af40ccd62102f9a9d4b10a6d6c56d8c955c547330c589bb45e774551d46d415e51cd9ad5116321033b421566c124dfde4db9defe4084b7aa4e7f36744758d92806b8f72c2e943309210353dcc6b4cf6ad28aceb7f7b2db92a4bf07ac42d357adf756f3eca790664314b621037f55980af0455e4fb55aad9b85a55068bb6dc4740ea87276dc693f4598db45fa210384001daa88dabd23db878dbb1ce5b4c2a5fa72c3113e3514bf602325d0c37b8e21039056d089f2fe72dbc0a14780b4635b0dc8a1b40b7a59106325dd1bc45cc70493210397ab8ea7b0bf85bc7fc56bb27bf85e75502e94e76a6781c409f3f2ec3d1122192103b00e3b5b77884bf3cae204c4b4eac003601da75f96982ffcb3dcb29c5ee419b92103c1f3c0874cfe34b8131af34699589aacec4093399739ae352e8a46f80a6f68375fae",
      "solution": "0046304402206263bb35516e8ad806f3626d228dec7929e89202522b219257e7e5eedb64e8ff022036c5bfd2b16e43c5162d35fbc64041630e98f4574775ce3ebe8fc135c84234a646304402200450dabc776fe95cdecef09171141f56c26a0f4a9c5f9256f1d8e67aedb956a40220048d27e08acf5f002d823b2359a58b7b7df57b2121b5c64460dbc0f7807b31f6473045022100b763029e99a6debe765f640128eeaeb7bf721f5fd0a90d72457dffe6b6d97db5022015d492f8bbec838d7b90f5fbe4a0041766ca797e1b61069eef213dd064ede42146304402200a6342eeee2be815c3bf68321692b8f0cbe605cd0d626784f61def9e733164d202200f67b624626e25077db19b098543681e064f45f9eb8ae6888eb78de5af1bb621473045022100c1101245ccf45308d6cf92af9a43c34073aa9be59c6f78c86df8ef7f3a5c5fe0022056098b793ca730cc8e623bd7f9cbd2ba548cb10ba6976e56fcee5ab37e59ad9046304402205d74c5fd7037fe653045d57622bd69b10da7a5de9526996e065b6a6a7c5814f802207a0f6169c85e89a0cb18f908440ec67a63367327e0e3ea45adfa7a3e81f6bb1c473045022100808f8cd8a45b734c6c49afcbdfba8abac16ba4884f201b21a2e146f5ba1b90570220267a207cf36c98c844a353dfd4760053bc132c1271eb52a95219b5075e006c5d473045022100a90a1a40f8dce2085503adc845902db7400dfcfc201cd12cdde8c29694ddd8c40220505f562d7325abbebd263823fd96380fbe000aac3f821de4842a880477cf8e22473045022100b330af409638f2480b3cb931449a513014b9345875ec6e6407187a2beddb522a022069f3b65961c8e920f7ae07be0eb249ef9e7d0a173c7ab3eb236d0e52863f8dfd463044022012149a50dff010d49d1aaa9d25c187dc8c42a713fde49e4e705de9210acd6f1102202a7e63ac3ea01e4a36f0c15044ee2e8b6614c568a442d89cdb0d65c33795ab7d46304402200e7fe3f26c3579b376401f2f650482bd435e0c3cea436041c5a7b8add31543190220368a35ef33d44a6d3dbd97c68cd19042f041c9204e858c42a20014827f0762a7"
    }
  },
  ...
]`
        },
        codeSampleLiquidTestnet: {
          esModule: ['150000'],
          commonJS: ['150000'],
          curl: ['150000'],
          response: `[
  {
    "id": "67d5eb1aee63c6c2058a088985503ff0626fd3f7f8022bdc74fab36a359164db",
    "height": 150000,
    "version": 536870912,
    "timestamp": 1640871913,
    "tx_count": 2,
    "size": 3527,
    "weight": 7430,
    "merkle_root": "40538ff1fcac07c65e36fcc230fc60f58e3a885ce9898e41bc27bcf28227e5ff",
    "previousblockhash": "2d8c28042b03219e7e9bc6853cc3ae536e36be5639869c545a0f3dbd1309e2a5",
    "mediantime": 1640871614,
    "ext": {
      "current": {
        "extension_space": [
          "02fcba7ecf41bc7e1be4ee122d9d22e3333671eb0a3a87b5cdf099d59874e1940f02fcba7ecf41bc7e1be4ee122d9d22e3333671eb0a3a87b5cdf099d59874e1940f"
        ],
        "fedpeg_program": "a91472c44f957fc011d97e3406667dca5b1c930c402687",
        "fedpegscript": "51",
        "signblock_witness_limit": 150,
        "signblockscript": "0020e9e4117540f7f23b3edd7c2cad660a17fb33c7959b8c37cf61d92b189133929a"
      },
      "proposed": {

      },
      "signblock_witness": [
        [],
        [48, 68, 2, 32, 19, 152, 101, 5, 73, 58, 8, 11, 11, 62, 1, 201, 143, 107, 66, 185, 6, 95, 214, 77, 245, 159, 76, 23, 142, 153, 237, 165, 123, 120, 81, 38, 2, 32, 69, 126, 115, 140, 254, 188, 41, 52, 195, 99, 228, 176, 248, 113, 234, 84, 23, 134, 83, 245, 153, 218, 242, 16, 184, 101, 163, 30, 221, 28, 216, 195, 1],
        [81, 33, 2, 23, 228, 3, 221, 177, 129, 135, 44, 50, 160, 205, 70, 140, 113, 0, 64, 178, 245, 61, 140, 172, 105, 241, 141, 173, 7, 152, 94, 227, 126, 154, 113, 81, 174]
      ]
    }
  },
  ...
]`
        },
      }
    }
  },
  {
    type: 'category',
    category: 'mining',
    fragment: 'mining',
    title: 'Mining',
    showConditions: bitcoinNetworks
  },
 {
    type: 'endpoint',
    category: 'mining',
    httpRequestMethod: 'GET',
    fragment: 'get-mining-pools',
    title: 'GET Mining Pools',
    description: {
      default: 'Returns a list of all known mining pools ordered by blocks found over the specified trailing <code>:timePeriod</code>.</p><p>Leave <code>:timePeriod</code> unspecified to get all available data, or specify one of the following values: ' + miningTimeIntervals + '.'
    },
    urlString: '/v1/mining/pools[/:timePeriod]',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/pools/%{1}`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`1w`],
          response: `{
  "pools": [
  {
    "poolId": 111,
    "name": "Foundry USA",
    "link": "https://foundrydigital.com/",
    "blockCount": 194,
    "rank": 1,
    "emptyBlocks": 0,
    "slug": "foundryusa"
  },
  {
    "poolId": 36,
    "name": "F2Pool",
    "link": "https://www.f2pool.com/",
    "blockCount": 154,
    "rank": 2,
    "emptyBlocks": 0,
    "slug": "f2pool"
  },
  {
    "poolId": 44,
    "name": "AntPool",
    "link": "https://www.antpool.com/",
    "blockCount": 138,
    "rank": 3,
    "emptyBlocks": 0,
    "slug": "antpool"
  },
  ...
  "blockCount": 1005,
  "lastEstimatedHashrate": 230086716765559200000
}`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [`3y`],
          response: `{
  "pools": [
    {
      "poolId": 112,
      "name": "SBI Crypto",
      "link": "https://sbicrypto.com",
      "blockCount": 26243,
      "rank": 2,
      "emptyBlocks": 11272,
      "slug": "sbicrypto"
    },
    {
      "poolId": 8,
      "name": "Huobi.pool",
      "link": "https://www.hpt.com/",
      "blockCount": 12134,
      "rank": 3,
      "emptyBlocks": 6096,
      "slug": "huobipool"
    },
    ...
  ],
  "blockCount": 2226180,
  "lastEstimatedHashrate": 602244182177430.8
}`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [`3y`],
          response: `{}`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
      }
    }
  },
  {
    type: 'endpoint',
    category: 'mining',
    httpRequestMethod: 'GET',
    fragment: 'get-mining-pool',
    title: 'GET Mining Pool',
    description: {
      default: '<p>Returns details about the mining pool specified by <code>:slug</code>.</p>'
    },
    urlString: '/v1/mining/pool/:slug',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/pool/%{1}`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [`qbitpool`],
          commonJS: [`qbitpool`],
          curl: [`qbitpool`],
          response: `{
  "pool": {
    "id": 2,
    "name": "Qbit Pool",
    "link": "https://qbit.org/pool",
    "addresses": [
      "qb1z7635znpv0ffehup3aq7dddzf6yuvvzwddad7aye7l64430rvq69q4zmcdh"
    ],
    "regexes": [
      "/Qbit Pool/",
      "/PRISM Pool/"
    ],
    "slug": "qbitpool",
    "unique_id": 1,
    "parentRegexes": [],
    "parentAddresses": [],
    "addressMatchMode": "any"
  },
  "blockCount": {
    "all": 20027,
    "24h": 584,
    "1w": 3224
  },
  "blockShare": {
    "all": 0.11893506586058224,
    "24h": 0.4086773967809657,
    "1w": 0.32054086299463114
  },
  "estimatedHashrate": 50542901833723030,
  "reportedHashrate": null,
  "avgBlockHealth": null,
  "totalReward": "397542025030015"
}`
        },
        codeSampleTestnet: {
          esModule: [`binancepool`],
          commonJS: [`binancepool`],
          curl: [`binancepool`],
          response: `{
  "pool": {
    "id": 9,
    "name": "Binance Pool",
    "link": "https://pool.binance.com",
    "addresses": [],
    "regexes": [],
    "slug": "binancepool",
    "unique_id": 8,
    "parentRegexes": [
      "binance"
    ],
    "parentAddresses": [
      "3G7jcEELKh38L6kaSV8K35pTqsh5bgZW2D"
    ],
    "addressMatchMode": "any"
  },
  "blockCount": {
    "all": 470,
    "24h": 0,
    "1w": 0
  },
  "blockShare": {
    "all": 0.0022414360451530136,
    "24h": 0,
    "1w": 0
  },
  "estimatedHashrate": 0,
  "reportedHashrate": null,
  "avgBlockHealth": null,
  "totalReward": "9870000001932"
}`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [`unknown`],
          response: `{}`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
      }
    }
  },
  {
    type: 'endpoint',
    category: 'mining',
    httpRequestMethod: 'GET',
    fragment: 'get-mining-pool-hashrates',
    title: 'GET Mining Pool Hashrates',
    description: {
      default: '<p>Returns average hashrates (and share of total hashrate) of mining pools active in the specified trailing <code>:timePeriod</code>, in descending order of hashrate.</p><p>Leave <code>:timePeriod</code> unspecified to get all available data, or specify any of the following time periods: ' + miningTimeIntervals.substr(52) + '.</p>'
    },
    urlString: '/v1/mining/hashrate/pools/[:timePeriod]',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/hashrate/pools/%{1}`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`1m`],
          response: `[
  {
    "timestamp": 1650240000,
    "avgHashrate": 38258816322322470000,
    "share": 0.185366,
    "poolName": "Foundry USA"
  },
  {
    "timestamp": 1650240000,
    "avgHashrate": 28996155528497033000,
    "share": 0.140488,
    "poolName": "F2Pool"
  },
  {
    "timestamp": 1650240000,
    "avgHashrate": 29801604293177496000,
    "share": 0.14439,
    "poolName": "AntPool"
  },
  {
    "timestamp": 1650240000,
    "avgHashrate": 21747116646372770000,
    "share": 0.105366,
    "poolName": "Poolin"
  },
  {
    "timestamp": 1650240000,
    "avgHashrate": 26579809234455600000,
    "share": 0.12878,
    "poolName": "Binance Pool"
  },
  {
    "timestamp": 1650240000,
    "avgHashrate": 19934856925841707000,
    "share": 0.0965854,
    "poolName": "ViaBTC"
  },
  {
    "timestamp": 1650240000,
    "avgHashrate": 11679007087866855000,
    "share": 0.0565854,
    "poolName": "SlushPool"
  },
  ...
]`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [`1y`],
          response: `[
  {
    "timestamp": 1621814400,
    "avgHashrate": 395655036336662.7,
    "share": 1,
    "poolName": "Unknown"
  },
  {
    "timestamp": 1621814400,
    "avgHashrate": 0,
    "share": 0,
    "poolName": "Binance Pool"
  }
]`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [`1w`],
          response: `[
  {
    "timestamp": 1600041600,
    "avgHashrate": 21621.70283633912,
    "share": 1,
    "poolName": "Unknown"
  }
]`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
      }
    }
  },
  {
    type: 'endpoint',
    category: 'mining',
    httpRequestMethod: 'GET',
    fragment: 'get-mining-pool-hashrate',
    title: 'GET Mining Pool Hashrate',
    description: {
      default: 'Returns all known hashrate data for the mining pool specified by <code>:slug</code>. Hashrate values are weekly averages.'
    },
    urlString: '/v1/mining/pool/:slug/hashrate',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/pool/%{1}/hashrate`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [`antpool`],
          commonJS: [`antpool`],
          curl: [`antpool`],
          response: `[
  {
    "timestamp": 1785110400,
    "avgHashrate": 130674404043081630000,
    "share": 0.106079,
    "poolName": "AntPool"
  },
  {
    "timestamp": 1785715200,
    "avgHashrate": 148991613391410170000,
    "share": 0.0991242,
    "poolName": "AntPool"
  },
  ...
]`
        },
        codeSampleTestnet: {
          esModule: [`qbitpool`],
          commonJS: [`qbitpool`],
          curl: [`qbitpool`],
          response: `[
  {
    "timestamp": 1783900800,
    "avgHashrate": 13388374830293.713,
    "share": 0.449697,
    "poolName": "Qbit Pool"
  },
  {
    "timestamp": 1784505600,
    "avgHashrate": 26233387870649.863,
    "share": 0.743131,
    "poolName": "Qbit Pool"
  },
  ...
]`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [`unknown`],
          response: `[
  {
    "timestamp": 1600041600,
    "avgHashrate": 21621.70283633912,
    "share": 1,
    "poolName": "Unknown"
  },
  {
    "timestamp": 1600646400,
    "avgHashrate": 23490.65374463165,
    "share": 1,
    "poolName": "Unknown"
  },
  {
    "timestamp": 1601251200,
    "avgHashrate": 22660.62333333333,
    "share": 1,
    "poolName": "Unknown"
  },
  ...
]`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
      }
    }
  },
  {
    type: 'endpoint',
    category: 'mining',
    httpRequestMethod: 'GET',
    fragment: 'get-mining-pool-blocks',
    title: 'GET Mining Pool Blocks',
    description: {
      default: 'Returns past 10 blocks mined by the specified mining pool (<code>:slug</code>) before the specified <code>:blockHeight</code>. If no <code>:blockHeight</code> is specified, the mining pool\'s 10 most recent blocks are returned.'
    },
    urlString: '/v1/mining/pool/:slug/blocks/[:blockHeight]',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/pool/%{1}/blocks/%{2}`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [`luxor`, `163891`],
          commonJS: [`luxor`, `163891`],
          curl: [`luxor`, `163891`],
          response: `[
  {
    "id": "629b0d823aa0990c33026e4abd0adac8ebc0e5ce38e9130f1d1ab211ba776511",
    "height": 163878,
    "version": 537256192,
    "timestamp": 1793986334,
    "bits": 386571417,
    "nonce": 0,
    "difficulty": 26524536808210.01,
    "merkle_root": "e772ae0ab498f37b1a4b297cccb7ce5d017c9d7c34a3dc43848e58dedf0f364b",
    "tx_count": 1,
    "size": 1218,
    "weight": 1218,
    "previousblockhash": "00000000000000009081f74b9d0ccfeea45baeb08478c65c30eb6ead01e1733c",
    "mediantime": 1793986145,
    "extras": {
      "cadence": {
        "topBits": 1,
        "chainId": 47,
        "isAuxpow": true,
        "signalBits": 0,
        "expectedChainId": 47,
        "chainIdMatchesExpected": true
      },
      "totalFees": 0,
      "medianFee": 0,
      "feeRange": [
        0,
        ...
      ],
      "reward": 18394280067,
      "pool": {
        "id": 2,
        "name": "Luxor",
        "slug": "luxor",
        "minerNames": null
      },
      "avgFee": 0,
      "avgFeeRate": 0,
      "coinbaseRaw": "0326800200",
      "coinbaseAddress": "qb1zgxwrmumwzvyk0jawp708eat70dzdrhyz80q83vypp9r8cj7e9ucqlwfe8r",
      "coinbaseAddresses": [
        "qb1zgxwrmumwzvyk0jawp708eat70dzdrhyz80q83vypp9r8cj7e9ucqlwfe8r"
      ],
      "coinbaseSignature": "OP_PUSHNUM_2 OP_PUSHBYTES_32 419c3df36e130967cbae0f9e7cf57e7b44d1dc823bc078b08109467c4bd92f30",
      "coinbaseSignatureAscii": "\\u0003&\\u0002\\u0000",
      "avgTxSize": 0,
      "totalInputs": 0,
      "totalOutputs": 2,
      "totalOutputAmt": 0,
      "medianFeeAmt": null,
      "feePercentiles": null,
      "segwitTotalTxs": 0,
      "segwitTotalSize": 0,
      "segwitTotalWeight": 0,
      "header": "00e105203c73e101ad6eeb305cc67884b0ae5ba4eecf0c9d4bf7819000000000...",
      "auxpow": {
        "parentBlockHash": "00000000000000000008cf1328378d2422d458da2915b789e95e2eedb08443fd",
        "parentCoinbaseRaw": "03f1df0e164d696e6564206279204c75786f72c500c4067fef14f9fabe6d6dbf...",
        "parentCoinbaseAddresses": [
          "3K9KZZPB8NRwZVP5wNKX4VYhnswrJxpgZ4",
          ...
        ]
      },
      "utxoSetChange": 2,
      "utxoSetSize": null,
      "totalInputAmt": null,
      "virtualSize": 1218,
      "firstSeen": null,
      "orphans": [],
      "matchRate": null,
      "expectedFees": null,
      "expectedWeight": null
    }
  },
  ...
]`
        },
        codeSampleTestnet: {
          esModule: [`qbitpool`, `202432`],
          commonJS: [`qbitpool`, `202432`],
          curl: [`qbitpool`, `202432`],
          response: `[
  {
    "id": "0000000000000a0d2a30aecf8abdcd55d2e9ea1b4cedafea6f131db742eeccb3",
    "height": 202431,
    "version": 536936448,
    "timestamp": 1793838478,
    "bits": 441920764,
    "nonce": 656097405,
    "difficulty": 192449.9156262012,
    "merkle_root": "ff60da2e2fda8012546e80c8981b002030b1196aa622743002142b1289c30189",
    "tx_count": 1,
    "size": 329,
    "weight": 329,
    "previousblockhash": "00000000000031f9e5dcd65baedc69c011ac7b81e60491b988df4ca60c055363",
    "mediantime": 1793838163,
    "extras": {
      "cadence": {
        "topBits": 1,
        "chainId": 8,
        "isAuxpow": false,
        "signalBits": 0,
        "expectedChainId": 31430,
        "chainIdMatchesExpected": null
      },
      "totalFees": 0,
      "medianFee": 0,
      "feeRange": [
        0,
        ...
      ],
      "reward": 17599647168,
      "pool": {
        "id": 1,
        "name": "Qbit Pool",
        "slug": "qbitpool",
        "minerNames": null
      },
      "avgFee": 0,
      "avgFeeRate": 0,
      "coinbaseRaw": "03bf16032f505249534d20506f6f6c2f000080a9c605000000000000",
      "coinbaseAddress": "tq1z6ej76x4syrxk8822qlq2lvf4y3hk0rmc42nsh8n6r775gjq050ssdn0vng",
      "coinbaseAddresses": [
        "tq1z6ej76x4syrxk8822qlq2lvf4y3hk0rmc42nsh8n6r775gjq050ssdn0vng",
        ...
      ],
      "coinbaseSignature": "OP_PUSHNUM_2 OP_PUSHBYTES_32 d665ed1ab020cd639d4a07c0afb135246f678f78aaa70b9e7a1fbd44480fa3e1",
      "coinbaseSignatureAscii": "\\u0003¿\\u0016\\u0003/PRISM Pool/\\u0000\\u0000©Æ\\u0005\\u0000\\u0000\\u0000\\u0000\\u0000\\u0000",
      "avgTxSize": 0,
      "totalInputs": 0,
      "totalOutputs": 3,
      "totalOutputAmt": 0,
      "medianFeeAmt": null,
      "feePercentiles": null,
      "segwitTotalTxs": 0,
      "segwitTotalSize": 0,
      "segwitTotalWeight": 0,
      "header": "000001206353050ca64cdf88b99104e6817bac11c069dcae5bd6dce5f9310000...",
      "auxpow": null,
      "utxoSetChange": 3,
      "utxoSetSize": null,
      "totalInputAmt": null,
      "virtualSize": 329,
      "firstSeen": null,
      "orphans": [],
      "matchRate": null,
      "expectedFees": null,
      "expectedWeight": null
    }
  },
  ...
]`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [`unknown`,`45000`],
          response: `[
  {
    "id": "00000002440c34e403b2b4e10f390ab105c825dd6285cd6f4050db23cf7e3e46",
    "timestamp": 1625317548,
    "height": 44999,
    "version": 536870912,
    "bits": 503405326,
    "nonce": 14354169,
    "difficulty": 0.002881346304279315,
    "merkle_root": "3324dc134dec1b57cfea574ce2db6e40e51469417b6381a1389e7969386ab42e",
    "tx_count": 14,
    "size": 2971,
    "weight": 8149,
    "previousblockhash": "000000d7998f5cf0fb144a400566221574f5f35ebd5d7d9fa803460b6942e237",
    "extras": {
      "coinbaseRaw": "03c7af00",
      "medianFee": 1,
      "reward": 5000002252,
      "totalFees": 2252,
      "pool": {
        "id": 137
      }
    }
  },
  {
    "id": "000000d7998f5cf0fb144a400566221574f5f35ebd5d7d9fa803460b6942e237",
    "timestamp": 1625317223,
    "height": 44998,
    "version": 536870912,
    "bits": 503405326,
    "nonce": 4729165,
    "difficulty": 0.002881346304279315,
    "merkle_root": "55869f5a52d7709fb2c6df91d64841f4551d659948b7537b6cd8f19c68d27115",
    "tx_count": 32,
    "size": 6967,
    "weight": 18247,
    "previousblockhash": "000000d6de5b925642a7afed41994947db8612955fbdfd9d1b48f99fc0187385",
    "extras": {
      "coinbaseRaw": "03c6af00",
      "medianFee": 1,
      "reward": 5000005528,
      "totalFees": 5528,
      "pool": {
        "id": 137
      }
    }
  },
  ...
]`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
      }
    }
  },
  {
    type: 'endpoint',
    category: 'mining',
    httpRequestMethod: 'GET',
    fragment: 'get-hashrate',
    title: 'GET Hashrate',
    description: {
      default: '<p>Returns network-wide hashrate and difficulty figures over the specified trailing <code>:timePeriod</code>:</p><ul><li>Current aggregate, permissionless-lane, and AuxPoW-lane hashrates</li><li>Current difficulty</li><li>Historical daily average aggregate and per-lane hashrates</li><li>Historical difficulty</li></ul><p>The legacy <code>hashrates</code> and <code>currentHashrate</code> fields remain the full aggregate values. Lane-aware clients can consume the timestamp-aligned <code>hashratesAggregate</code>, <code>hashratesPermissionless</code>, and <code>hashratesAuxpow</code> series; timestamps awaiting lane backfill remain available through legacy <code>hashrates</code> but are omitted from the aligned trio. Current lane values are exposed through <code>currentHashratePermissionless</code> and <code>currentHashrateAuxpow</code>.</p><p>Valid values for <code>:timePeriod</code> are ' + miningTimeIntervals.substr(52) + '. If no time interval is specified, all available data is returned.</p><p>Be sure that <code>INDEXING_BLOCKS_AMOUNT</code> is set properly in your backend config so that enough blocks are indexed to properly serve your request.</p>'
    },
    urlString: '/v1/mining/hashrate/[:timePeriod]',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/hashrate/3d`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "hashrates": [
    {
      "timestamp": 1652486400,
      "avgHashrate": 236499762108771800000
    },
    {
      "timestamp": 1652572800,
      "avgHashrate": 217473276787331300000
    },
    {
      "timestamp": 1652659200,
      "avgHashrate": 189877203506913000000
    }
  ],
  "hashratesAggregate": [
    {
      "timestamp": 1652486400,
      "avgHashrate": 236499762108771800000
    },
    {
      "timestamp": 1652572800,
      "avgHashrate": 217473276787331300000
    },
    {
      "timestamp": 1652659200,
      "avgHashrate": 189877203506913000000
    }
  ],
  "hashratesPermissionless": [
    {
      "timestamp": 1652486400,
      "avgHashrate": 177374821581578850000
    },
    {
      "timestamp": 1652572800,
      "avgHashrate": 163104957590498480000
    },
    {
      "timestamp": 1652659200,
      "avgHashrate": 142407902630184750000
    }
  ],
  "hashratesAuxpow": [
    {
      "timestamp": 1652486400,
      "avgHashrate": 59124940527192950000
    },
    {
      "timestamp": 1652572800,
      "avgHashrate": 54368319196832820000
    },
    {
      "timestamp": 1652659200,
      "avgHashrate": 47469300876728250000
    }
  ],
  "difficulty": [
    {
      "time": 1652468330,
      "difficulty": 31251101365711.12,
      "height": 736249
    }
  ],
  "currentHashrate": 252033247355212300000,
  "currentHashratePermissionless": 189024935516409230000,
  "currentHashrateAuxpow": 63008311838803070000,
  "currentDifficulty": 31251101365711.12
}`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [`3d`],
          response: `{
  "hashrates": [
    {
      "timestamp": 1652745600,
      "avgHashrate": 385829751259101.6
    },
    {
      "timestamp": 1652832000,
      "avgHashrate": 657984995406460.8
    },
    {
      "timestamp": 1652918400,
      "avgHashrate": 510731129917436.6
    }
  ],
  "hashratesAggregate": [
    {
      "timestamp": 1652745600,
      "avgHashrate": 385829751259101.6
    },
    {
      "timestamp": 1652832000,
      "avgHashrate": 657984995406460.8
    },
    {
      "timestamp": 1652918400,
      "avgHashrate": 510731129917436.6
    }
  ],
  "hashratesPermissionless": [
    {
      "timestamp": 1652745600,
      "avgHashrate": 289372313444326.2
    },
    {
      "timestamp": 1652832000,
      "avgHashrate": 493488746554845.6
    },
    {
      "timestamp": 1652918400,
      "avgHashrate": 383048347438077.4
    }
  ],
  "hashratesAuxpow": [
    {
      "timestamp": 1652745600,
      "avgHashrate": 96457437814775.4
    },
    {
      "timestamp": 1652832000,
      "avgHashrate": 164496248851615.2
    },
    {
      "timestamp": 1652918400,
      "avgHashrate": 127682782479359.2
    }
  ],
  "difficulty": [
    {
      "time": 1652691434,
      "difficulty": 26119369.29706616,
      "height": 2225402
    }
  ],
  "currentHashrate": 781149965464814.4,
  "currentHashratePermissionless": 585862474098610.8,
  "currentHashrateAuxpow": 195287491366203.6,
  "currentDifficulty": 55580658.55098472
}`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [`3d`],
          response: `{
  "hashrates": [
    {
      "timestamp": 1652745600,
      "avgHashrate": 21304.18163251096
    },
    {
      "timestamp": 1652832000,
      "avgHashrate": 22034.51091213679
    },
    {
      "timestamp": 1652918400,
      "avgHashrate": 20312.75493978447
    }
  ],
  "hashratesAggregate": [
    {
      "timestamp": 1652745600,
      "avgHashrate": 21304.18163251096
    },
    {
      "timestamp": 1652832000,
      "avgHashrate": 22034.51091213679
    },
    {
      "timestamp": 1652918400,
      "avgHashrate": 20312.75493978447
    }
  ],
  "hashratesPermissionless": [
    {
      "timestamp": 1652745600,
      "avgHashrate": 15978.13622438322
    },
    {
      "timestamp": 1652832000,
      "avgHashrate": 16525.88318410259
    },
    {
      "timestamp": 1652918400,
      "avgHashrate": 15234.56620483835
    }
  ],
  "hashratesAuxpow": [
    {
      "timestamp": 1652745600,
      "avgHashrate": 5326.04540812774
    },
    {
      "timestamp": 1652832000,
      "avgHashrate": 5508.6277280342
    },
    {
      "timestamp": 1652918400,
      "avgHashrate": 5078.18873494612
    }
  ],
  "difficulty": [
    {
      "time": 1652692199,
      "difficulty": 0.002868721424409158,
      "height": 90533
    },
    {
      "time": 1652796655,
      "difficulty": 0.00286032350920122,
      "height": 90720
    }
  ],
  "currentHashrate": 23490.95654668005,
  "currentHashratePermissionless": 17618.21741001004,
  "currentHashrateAuxpow": 5872.73913667001,
  "currentDifficulty": 0.00286032350920122
}`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
      }
    }
  },
  {
    type: 'endpoint',
    category: 'mining',
    httpRequestMethod: 'GET',
    fragment: 'get-block-spacing',
    title: 'GET Block Spacing',
    description: {
      default: '<p>Returns the observed spacing between consecutive blocks over the specified trailing <code>:interval</code> (<code>1h</code>, <code>24h</code>, <code>3d</code>, <code>1w</code>, <code>1m</code>, or <code>3m</code>), along with the consensus target spacing in seconds. Long windows are averaged into fixed-size height buckets to bound the response size.</p>'
    },
    urlString: '/v1/mining/block-spacing/:interval',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/block-spacing/24h`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "spacings": [
    {
      "height": 118201,
      "timestamp": 1752105693,
      "spacingSeconds": 47
    },
    {
      "height": 118202,
      "timestamp": 1752105780,
      "spacingSeconds": 87
    },
    {
      "height": 118203,
      "timestamp": 1752105841,
      "spacingSeconds": 61
    }
  ],
  "targetSpacing": 60
}`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "spacings": [
    {
      "height": 118201,
      "timestamp": 1752105693,
      "spacingSeconds": 47
    },
    {
      "height": 118202,
      "timestamp": 1752105780,
      "spacingSeconds": 87
    }
  ],
  "targetSpacing": 60
}`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "spacings": [
    {
      "height": 118201,
      "timestamp": 1752105693,
      "spacingSeconds": 47
    }
  ],
  "targetSpacing": 60
}`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
      }
    }
  },
  {
    type: 'endpoint',
    category: 'mining',
    httpRequestMethod: 'GET',
    fragment: 'get-reward-stats',
    title: 'GET Reward Stats',
    description: {
      default: 'Returns block reward and total transactions confirmed for the past <code>:blockCount</code> blocks.'
    },
    urlString: '/v1/mining/reward-stats/:blockCount',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/reward-stats/%{1}`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`100`],
          response: `{
  "startBlock": 736556,
  "endBlock": 736655,
  "totalReward": "63811748254",
  "totalFee": "1311748254",
  "totalTx": "164216"
}`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [`100`],
          response: `{
  "startBlock": 2226086,
  "endBlock": 2226185,
  "totalReward": "513462793",
  "totalFee": "25181593",
  "totalTx": "2366"
}`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [`100`],
          response: `{
  "startBlock": 90899,
  "endBlock": 90998,
  "totalReward": "500001245259",
  "totalFee": "1245259",
  "totalTx": "1112"
}`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
      }
    }
  },
  {
    type: 'endpoint',
    category: 'mining',
    httpRequestMethod: 'GET',
    fragment: 'get-block-fees',
    title: 'GET Block Fees',
    description: {
      default: '<p>Returns average total fees for blocks in the specified <code>:timePeriod</code>, ordered oldest to newest. <code>:timePeriod</code> can be any of the following: ' + miningTimeIntervals + '.</p><p>For <code>24h</code> and <code>3d</code> time periods, every block is included and fee amounts are exact (not averages). For the <code>1w</code> time period, fees may be averages depending on how fast blocks were found around a particular timestamp. For other time periods, fees are averages.</p>'
    },
    urlString: '/v1/mining/blocks/fees/:timePeriod',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/blocks/fees/%{1}`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`1w`],
          response: `[
  {
    "avgHeight": 735644,
    "timestamp": 1652119111,
    "avgFees": 24212890
  },
  {
    "avgHeight": 735646,
    "timestamp": 1652120252,
    "avgFees": 21655996
  },
  {
    "avgHeight": 735648,
    "timestamp": 1652121214,
    "avgFees": 20678859
  },
  {
    "avgHeight": 735649,
    "timestamp": 1652121757,
    "avgFees": 21020140
  },
  {
    "avgHeight": 735650,
    "timestamp": 1652122367,
    "avgFees": 23064200
  },
  {
    "avgHeight": 735652,
    "timestamp": 1652122893,
    "avgFees": 17620723
  },
  ...
]`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [`1w`],
          response: `[
  {
    "avgHeight": 2224253,
    "timestamp": 1652346420,
    "avgFees": 211686
  },
  {
    "avgHeight": 2224254,
    "timestamp": 1652346850,
    "avgFees": 2565952
  },
  ...
]`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [`1w`],
          response: `[
  {
    "avgHeight": 89978,
    "timestamp": 1652346573,
    "avgFees": 1071
  },
  {
    "avgHeight": 89979,
    "timestamp": 1652346970,
    "avgFees": 1224
  },
  ...
]`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
      }
    }
  },
  {
    type: 'endpoint',
    category: 'mining',
    httpRequestMethod: 'GET',
    fragment: 'get-block-rewards',
    title: 'GET Block Rewards',
    description: {
      default: '<p>Returns average block rewards for blocks in the specified <code>:timePeriod</code>, ordered oldest to newest. <code>:timePeriod</code> can be any of the following: ' + miningTimeIntervals + '.</p><p>For <code>24h</code> and <code>3d</code> time periods, every block is included and block rewards are exact (not averages). For the <code>1w</code> time period, block rewards may be averages depending on how fast blocks were found around a particular timestamp. For other time periods, block rewards are averages.</p>'
    },
    urlString: '/v1/mining/blocks/rewards/:timePeriod',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/blocks/rewards/%{1}`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`1d`],
          response: `[
  {
    "avgHeight": 599992,
    "timestamp": 1571438412,
    "avgRewards": 1260530933
  },
  {
    "avgHeight": 600000,
    "timestamp": 1571443398,
    "avgRewards": 1264314538
  },
  {
    "avgHeight": 725441,
    "timestamp": 1646139035,
    "avgRewards": 637067563
  },
  {
    "avgHeight": 725585,
    "timestamp": 1646222444,
    "avgRewards": 646519104
  },
  {
    "avgHeight": 725727,
    "timestamp": 1646308374,
    "avgRewards": 638709605
  },
  ...
]`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [`1d`],
          response: `[
  {
    "avgHeight": 12,
    "timestamp": 1296689648,
    "avgRewards": 5000000000
  },
  {
    "avgHeight": 269,
    "timestamp": 1296717674,
    "avgRewards": 5000091820
  },
  ...
]`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [`1d`],
          response: `[
  {
    "avgHeight": 183,
    "timestamp": 1598962247,
    "avgRewards": 5000000000
  },
  {
    "avgHeight": 576,
    "timestamp": 1599047892,
    "avgRewards": 5000000000
  },
  ...
]`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
      }
    }
  },
  {
    type: 'endpoint',
    category: 'mining',
    httpRequestMethod: 'GET',
    fragment: 'get-block-feerates',
    title: 'GET Block Feerates',
    description: {
      default: 'Returns average feerate percentiles for blocks in the specified <code>:timePeriod</code>, ordered oldest to newest. <code>:timePeriod</code> can be any of the following: ' + miningTimeIntervals + '.</p><p>For <code>24h</code> and <code>3d</code> time periods, every block is included and percentiles are exact (not averages). For the <code>1w</code> time period, percentiles may be averages depending on how fast blocks were found around a particular timestamp. For other time periods, percentiles are averages.'
    },
    urlString: '/v1/mining/blocks/fee-rates/:timePeriod',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/blocks/fee-rates/%{1}`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`1m`],
          response: `[
  {
    "avgHeight": 732152,
    "timestamp": 1650132959,
    "avgFee_0": 1,
    "avgFee_10": 2,
    "avgFee_25": 2,
    "avgFee_50": 3,
    "avgFee_75": 4,
    "avgFee_90": 8,
    "avgFee_100": 393
  },
  {
    "avgHeight": 732158,
    "timestamp": 1650134432,
    "avgFee_0": 1,
    "avgFee_10": 1,
    "avgFee_25": 2,
    "avgFee_50": 4,
    "avgFee_75": 6,
    "avgFee_90": 10,
    "avgFee_100": 240
  },
  {
    "avgHeight": 732161,
    "timestamp": 1650135818,
    "avgFee_0": 1,
    "avgFee_10": 1,
    "avgFee_25": 1,
    "avgFee_50": 2,
    "avgFee_75": 5,
    "avgFee_90": 8,
    "avgFee_100": 251
  },
  ...
]`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [`1m`],
          response: `[
  {
    "avgHeight": 2196306,
    "timestamp": 1650360168,
    "avgFee_0": 1,
    "avgFee_10": 1,
    "avgFee_25": 1,
    "avgFee_50": 1,
    "avgFee_75": 2,
    "avgFee_90": 28,
    "avgFee_100": 2644
  },
  {
    "avgHeight": 2196308,
    "timestamp": 1650361209,
    "avgFee_0": 1,
    "avgFee_10": 1,
    "avgFee_25": 1,
    "avgFee_50": 4,
    "avgFee_75": 12,
    "avgFee_90": 65,
    "avgFee_100": 102
  },
  ...
]`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [`1m`],
          response: `{
"blockFeeRates": [
  {
    "avgHeight": 86620,
    "timestamp": 1650360010,
    "avgFee_0": 1,
    "avgFee_10": 1,
    "avgFee_25": 1,
    "avgFee_50": 1,
    "avgFee_75": 1,
    "avgFee_90": 1,
    "avgFee_100": 1
  },
  {
    "avgHeight": 86623,
    "timestamp": 1650361330,
    "avgFee_0": 1,
    "avgFee_10": 1,
    "avgFee_25": 1,
    "avgFee_50": 1,
    "avgFee_75": 1,
    "avgFee_90": 1,
    "avgFee_100": 1
  },
  ...
]`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
      }
    }
  },
  {
    type: 'endpoint',
    category: 'mining',
    httpRequestMethod: 'GET',
    fragment: 'get-sizes-weights',
    title: 'GET Block Sizes and Weights',
    description: {
      default: '<p>Returns average size (bytes) and average weight (weight units) for blocks in the specified <code>:timePeriod</code>, ordered oldest to newest. <code>:timePeriod</code> can be any of the following: ' + miningTimeIntervals + '.</p><p>For <code>24h</code> and <code>3d</code> time periods, every block is included and figures are exact (not averages). For the <code>1w</code> time period, figures may be averages depending on how fast blocks were found around a particular timestamp. For other time periods, figures are averages.</p>'
    },
    urlString: '/v1/mining/blocks/sizes-weights/:timePeriod',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/blocks/sizes-weights/%{1}`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`3y`],
          response: `{
  "sizes": [
    {
      "avgHeight": 576650,
      "timestamp": 1558212081,
      "avgSize": 1271404
    },
    {
      "avgHeight": 576715,
      "timestamp": 1558246272,
      "avgSize": 1105893
    },
    {
      "avgHeight": 576797,
      "timestamp": 1558289379,
      "avgSize": 1141071
    },
    {
      "avgHeight": 576885,
      "timestamp": 1558330184,
      "avgSize": 1108166
    },
    ...
  ],
  "weights": [
    {
      "avgHeight": 576650,
      "timestamp": 1558212081,
      "avgWeight": 3994002
    },
    {
      "avgHeight": 576715,
      "timestamp": 1558246272,
      "avgWeight": 3756312
    },
    {
      "avgHeight": 576797,
      "timestamp": 1558289379,
      "avgWeight": 3719625
    },
    {
      "avgHeight": 576885,
      "timestamp": 1558330184,
      "avgWeight": 3631381
    },
    ...
  ]
}`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [`3y`],
          response: `{
  "sizes": [
    {
      "avgHeight": 1517188,
      "timestamp": 1558262730,
      "avgSize": 25089
    },
    {
      "avgHeight": 1517275,
      "timestamp": 1558290933,
      "avgSize": 21679
    },
    ...
  ],
  "weights": [
    {
      "avgHeight": 1517188,
      "timestamp": 1558262730,
      "avgWeight": 74921
    },
    {
      "avgHeight": 1517275,
      "timestamp": 1558290933,
      "avgWeight": 65164
    },
    ...
  ]
}`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [`3y`],
          response: `{
  "sizes": [
    {
      "avgHeight": 83,
      "timestamp": 1598937527,
      "avgSize": 329
    },
    {
      "avgHeight": 266,
      "timestamp": 1598982991,
      "avgSize": 330
    },
    ...
  ],
  "weights": [
    {
      "avgHeight": 83,
      "timestamp": 1598937527,
      "avgWeight": 1209
    },
    {
      "avgHeight": 266,
      "timestamp": 1598982991,
      "avgWeight": 1212
    },
    ...
  ]
}`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
      }
    }
  },
  {
    type: 'endpoint',
    category: 'mining',
    httpRequestMethod: 'GET',
    fragment: 'get-block-predictions',
    title: 'GET Block Predictions',
    description: {
      default: '<p>Returns average block health in the specified <code>:timePeriod</code>, ordered oldest to newest. <code>:timePeriod</code> can be any of the following: ' + miningTimeIntervals + '.</p><p>For <code>24h</code> and <code>3d</code> time periods, every block is included and figures are exact (not averages). For the <code>1w</code> time period, figures may be averages depending on how fast blocks were found around a particular timestamp. For other time periods, figures are averages.</p>'
    },
    urlString: ['/v1/mining/blocks/predictions/:timePeriod'],
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/blocks/predictions/%{1}`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`3y`],
          response: `[
  [
    1687247274,
    777625,
    100
  ],
  [
    1687066238,
    788621,
    99.85
  ],
  [
    1687263518,
    795182,
    99.46
  ],
  [
    1687312271,
    795260,
    100
  ],
  ...
]`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [`3y`],
          response: `[
  [
    1687246773,
    2429248,
    100
  ],
  [
    1687285500,
    2438380,
    100
  ],
  [
    1687342820,
    2438467,
    100
  ],
  [
    1687372143,
    2438522,
    100
  ],
  ...
]`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [`3y`],
          response: `[
  [
    1687246696,
    129639,
    0
  ],
  [
    1687303289,
    148191,
    0
  ],
  [
    1687315093,
    148218,
    0
  ],
  [
    1687368211,
    148312,
    0
  ],
  ...
]`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
      }
    }
  },
  {
    type: 'endpoint',
    category: 'mining',
    httpRequestMethod: 'GET',
    fragment: 'get-block-audit-score',
    title: 'GET Block Audit Score',
    description: {
      default: 'Returns the block audit score for the specified <code>:blockHash</code>. Available fields: <code>hash</code>, <code>matchRate</code>, <code>expectedFees</code>, and <code>expectedWeight</code>.'
    },
    urlString: ['/v1/mining/blocks/audit/score/:blockHash'],
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/blocks/audit/score/%{1}`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [`00000000000000008451c8a192642a138f7ec4b84376341d7a5003335a2e9401`],
          commonJS: [`00000000000000008451c8a192642a138f7ec4b84376341d7a5003335a2e9401`],
          curl: [`00000000000000008451c8a192642a138f7ec4b84376341d7a5003335a2e9401`],
          response: `{
  hash: "000000000000000000032535698c5b0c48283b792cf86c1c6e36ff84464de785",
  matchRate: 99.66,
  expectedFees: 12090955,
  expectedWeight: 3991988
}`
        },
        codeSampleTestnet: {
          esModule: [`0000000000004566ada8ed167de2f48c8c3f9cd9c3ce661df41c9cb82811388f`],
          commonJS: [`0000000000004566ada8ed167de2f48c8c3f9cd9c3ce661df41c9cb82811388f`],
          curl: [`0000000000004566ada8ed167de2f48c8c3f9cd9c3ce661df41c9cb82811388f`],
          response: `{
  hash: "000000000000025a66f30a181e438b9f65ef33cec3014b7a4ff4c7578289cd6e",
  matchRate: 100,
  expectedFees: 579169,
  expectedWeight: 12997
}`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [`000000c1491d7d4229d4bf07e0dcaa7e396767b45be388e1174c7439a9490121`],
          response: `{
  hash: "000000c1491d7d4229d4bf07e0dcaa7e396767b45be388e1174c7439a9490121",
  matchRate: 100,
  expectedFees: 80520,
  expectedWeight: 16487
}`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
      }
    }
  },
  {
    type: 'endpoint',
    category: 'mining',
    httpRequestMethod: 'GET',
    fragment: 'get-blocks-audit-scores',
    title: 'GET Blocks Audit Scores',
    description: {
      default: 'Returns blocks audit score for the past 16 blocks. If <code>:startHeight</code> is specified, the past 15 blocks before (and including) <code>:startHeight</code> are returned. Available fields: <code>hash</code>, <code>matchRate</code>, <code>expectedFees</code>, and <code>expectedWeight</code>.'
    },
    urlString: ['/v1/mining/blocks/audit/scores/:startHeight'],
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/blocks/audit/scores/%{1}`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [`163891`],
          commonJS: [`163891`],
          curl: [`163891`],
          response: `[
  {
    hash: "000000000000000000034cd3689507da0386d3d1790dd56f2e6945e650e02c74",
    matchRate: 100,
    expectedFees: 225828975,
    expectedWeight: 3991756
  },
  {
    hash: "00000000000000000000b3ad97907e99c54e6b9145a8f77842e59d9c0c8377cf",
    matchRate: 100,
    expectedFees: 295107022,
    expectedWeight: 3991752
  },
  ...
]`
        },
        codeSampleTestnet: {
          esModule: [`202432`],
          commonJS: [`202432`],
          curl: [`202432`],
          response: `[
  {
    hash: "00000000000002e7e96e7b5ee04a5fbb3ef9575a9f4a99effb32a8a89d9d2f19",
    matchRate: 100,
    expectedFees: 964677,
    expectedWeight: 24959
  },
  {
    hash: "00000000000003bd3962806d0e06d9982eb2e06aeba912687b2bac3668db32aa",
    matchRate: 100,
    expectedFees: 631200,
    expectedWeight: 15516
  },
  ...
]`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [`175504`],
          response: `[
  {
    hash: "00000012d54289925efc151f2e111e0775e80c3b6bb4b0dcd3ff01dec4bbc5d0",
    matchRate: 100,
    expectedFees: 4767,
    expectedWeight: 2524
  },
  {
    hash: "00000031e269cf0b567260b01ae11453175f4598fdb4f1908c5e2f4265b9d93a",
    matchRate: 100,
    expectedFees: 9090,
    expectedWeight: 1851
  },
  ...
]`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
      }
    }
  },
  {
    type: 'endpoint',
    category: 'mining',
    httpRequestMethod: 'GET',
    fragment: 'get-block-audit-summary',
    title: 'GET Block Audit Summary',
    description: {
      default: 'Returns the block audit summary for the specified <code>:blockHash</code>. Available fields: <code>height</code>, <code>id</code>, <code>timestamp</code>, <code>template</code>, <code>missingTxs</code>, <code>addedTxs</code>, <code>freshTxs</code>, <code>sigopTxs</code>, <code>fullrbfTxs</code>, <code>acceleratedTxs</code>, <code>matchRate</code>, <code>expectedFees</code>, and <code>expectedWeight</code>.'
    },
    urlString: ['/v1/block/:blockHash/audit-summary'],
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/block/%{1}/audit-summary`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [`00000000000000008451c8a192642a138f7ec4b84376341d7a5003335a2e9401`],
          commonJS: [`00000000000000008451c8a192642a138f7ec4b84376341d7a5003335a2e9401`],
          curl: [`00000000000000008451c8a192642a138f7ec4b84376341d7a5003335a2e9401`],
          response: `{
  height: 822418,
  id: "00000000000000000000f218ceda7a5d9c289040b9c3f05ef9f7c2f4930e0123",
  timestamp: 1703262962,
  template: [
    {
      txid: "1de119e4fe0fb92378de74a59fec337c39d505bbc0d04d20d151cc3fb7a91bf0",
      fee: 92000,
      vsize: 140.25,
      value: 354245800,
      rate: 655.9714795008913,
      flags: 1099511631881
    },
    ...
  ],
  missingTxs: [],
  addedTxs: [
    "3036565d1af6c5b14876a255cdf06214aa350e62154d1ce8619c8e933d0526f8",
    "aaa9d8e8f1de712574182a618b4d608f96f39bfc55e296d2e5904561cdef2e77",
    ...
  ],
  freshTxs: [
    "8ede292d8f0319cbe79fff9fd47564cd7f78fad74d7c506d2b157399ff41d904"
  ],
  sigopTxs: [],
  fullrbfTxs: [
    "271e7792910a4ea134c02c03c9d7477b32a8531a5dd92fbc4dbf3ca70614fcce",
    "634a5b2de393f0f5b4eeb335bee75c1779b1f2308a07e86cafb95894aa4734d0",
    ...
  ],
  acceleratedTxs: [],
  matchRate: 100,
  expectedFees: 169464627,
  expectedWeight: 3991702
}`
        },
        codeSampleTestnet: {
          esModule: [`0000000000004566ada8ed167de2f48c8c3f9cd9c3ce661df41c9cb82811388f`],
          commonJS: [`0000000000004566ada8ed167de2f48c8c3f9cd9c3ce661df41c9cb82811388f`],
          curl: [`0000000000004566ada8ed167de2f48c8c3f9cd9c3ce661df41c9cb82811388f`],
          response: `{
  height: 2566708,
  id: "000000000000007cfba94e051326b3546c968a188a7e12e340a78cefc586bfe3",
  timestamp: 1703684826,
  template: [
    {
      txid: "6556caa3c6bff537f04837a6f7182dd7a253f31a46de4f21dec9584720156d35",
      fee: 109707,
      vsize: 264.75,
      value: 456855,
      rate: 414.37960339943345,
      flags: 9895621445642
    },
    {
      txid: "53b7743b8cfa0108dbcdc7c2f5e661b9d8f56216845a439449d7f9dfc466b147",
      fee: 74640,
      vsize: 215.5,
      value: 19063915,
      rate: 348.5338491295938,
      flags: 1099528491017
    },
    ...
  ],
  missingTxs: [
    "8f2eae756119e43054ce1014a06e81d612113794d8b519e6ff393d7e0023396a",
    "012b44b0fc0fddc549a056c85850f03a83446c843504c588cd5829873b30f5a9",
    ...
  ],
  addedTxs: [],
  freshTxs: [
    "af36a8b88f6c19f997614dfc8a41395190eaf496a49e8db393dacb770999abd5",
    "fdfa272c8fe069573b964ddad605d748d8c737e94dfcd09bddaae0ee0a2445df",
    ...
  ],
  sigopTxs: [],
  fullrbfTxs: [],
  acceleratedTxs: [],
  matchRate: 86.96,
  expectedFees: 1541639,
  expectedWeight: 26425
}`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [`0000008acf5177d07f1d648f4d54f26095936a5d29a0a6145dd75a0415e63c0f`],
          response: `{
  height: 175519,
  id: "0000008acf5177d07f1d648f4d54f26095936a5d29a0a6145dd75a0415e63c0f",
  timestamp: 1703682844,
  template: [
    {
      txid: "f95b38742c483b81dc4ff49a803bae7625f1596ec5756c944d7586dfe8b38250",
      fee: 3766,
      vsize: 172.25,
      value: 115117171776,
      rate: 21.86357039187228,
      flags: 1099528425481
    },
    {
      txid: "8665c4d05732c930c2037bc0220e4ab9b1b64ce3302363ff7d118827c7347b52",
      fee: 3766,
      vsize: 172.25,
      value: 115116509429,
      rate: 21.86357039187228,
      flags: 1099528425481
    },
    ...
  ],
  missingTxs: [],
  addedTxs: [],
  freshTxs: [],
  sigopTxs: [],
  fullrbfTxs: [],
  acceleratedTxs: [],
  matchRate: 100,
  expectedFees: 10494,
  expectedWeight: 6582
}`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
      }
    }
  },
  {
    type: 'category',
    category: 'fees',
    fragment: 'fees',
    title: 'Fees',
    showConditions: bitcoinNetworks.concat(liquidNetworks)
  },
  {
    type: 'endpoint',
    category: 'fees',
    httpRequestMethod: 'GET',
    fragment: 'get-mempool-blocks-fees',
    title: 'GET Mempool Blocks Fees',
    description: {
      default: 'Returns current mempool as projected blocks.'
    },
    urlString: '/v1/fees/mempool-blocks',
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/fees/mempool-blocks`,
          commonJS: `
        const { %{0}: { fees } } = mempoolJS();

        const feesMempoolBlocks = await fees.getFeesMempoolBlocks();

        document.getElementById("result").textContent = JSON.stringify(feesMempoolBlocks, undefined, 2);
        `,
          esModule: `
  const { %{0}: { fees } } = mempoolJS();

  const feesMempoolBlocks = await fees.getFeesMempoolBlocks();
  console.log(feesMempoolBlocks);
          `,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  {
    blockSize: 873046,
    blockVSize: 746096.5,
    nTx: 863,
    totalFees: 8875608,
    medianFee: 10.79646017699115,
    feeRange: [
      1,
      2.4242424242424243,
      8.107816711590296,
      10.148014440433213,
      11.053311793214863,
      12.041811846689896,
      14.930957683741648,
      302.11480362537765
    ]
  }
]`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  {
    blockSize: 2871,
    blockVSize: 2377.5,
    nTx: 11,
    totalFees: 3499,
    medianFee: 1.1799410029498525,
    feeRange: [
      1.00374531835206,
      1.00374531835206,
      1.0046860356138707,
      1.1799410029498525,
      1.183431952662722,
      1.3274336283185841,
      1.3995037220843674,
      5.0271041369472185
    ]
  }
]`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  {
    blockSize: 16157,
    blockVSize: 10338.5,
    nTx: 75,
    totalFees: 13493,
    medianFee: 1.304812834224599,
    feeRange: [
      1.304812834224599,
      1.304812834224599,
      1.304812834224599,
      1.304812834224599,
      1.304812834224599,
      1.304812834224599,
      1.304812834224599,
      1.3123359580052494
    ]
  }
]`
        },
        codeSampleLiquid: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  {
    blockSize: 5011,
    blockVSize: 1530.25,
    nTx: 1,
    totalFees: 288,
    medianFee: 0.1882045417415455,
    feeRange: [
      0.1882045417415455,
      0.1882045417415455,
      0.1882045417415455,
      0.1882045417415455,
      0.1882045417415455,
      0.1882045417415455,
      0.1882045417415455,
      0.1882045417415455
    ]
  }
]`
        },
        codeSampleLiquidTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  {
    blockSize: 23782,
    blockVSize: 20457.25,
    nTx: 3,
    totalFees: 2089,
    medianFee: 0.10163043478260869,
    feeRange: [
      0.1,
      0.1,
      0.1,
      0.10163043478260869,
      0.10163043478260869,
      0.11385199240986717,
      0.11385199240986717,
      0.11385199240986717
    ]
  }
]`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'fees',
    httpRequestMethod: 'GET',
    fragment: 'get-recommended-fees',
    title: 'GET Recommended Fees',
    description: {
      default: 'Returns our currently suggested fees for new transactions.'
    },
    urlString: '/v1/fees/recommended',
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/fees/recommended`,
          commonJS: `
        const { %{0}: { fees } } = mempoolJS();

        const feesRecommended = await fees.getFeesRecommended();

        document.getElementById("result").textContent = JSON.stringify(feesRecommended, undefined, 2);
        `,
          esModule: `
  const { %{0}: { fees } } = mempoolJS();

  const feesRecommended = await fees.getFeesRecommended();
  console.log(feesRecommended);
          `,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  fastestFee: 1,
  halfHourFee: 1,
  hourFee: 1,
  economyFee: 1,
  minimumFee: 1
}`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  fastestFee: 1,
  halfHourFee: 1,
  hourFee: 1,
  economyFee: 1,
  minimumFee: 1
}`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  fastestFee: 1,
  halfHourFee: 1,
  hourFee: 1,
  economyFee: 1,
  minimumFee: 1
}`
        },
        codeSampleLiquid: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  fastestFee: 0.1,
  halfHourFee: 0.1,
  hourFee: 0.1,
  economyFee: 0.1,
  minimumFee: 0.1
}`
        },
        codeSampleLiquidTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  fastestFee: 0.1,
  halfHourFee: 0.1,
  hourFee: 0.1,
  economyFee: 0.1,
  minimumFee: 0.1
}`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'fees',
    httpRequestMethod: 'GET',
    fragment: 'get-recommended-fees-precise',
    title: 'GET Recommended Fees (Precise)',
    description: {
      default: 'Returns our currently-suggested feerates with up to 3 decimal places, including sub-bit feerates down to 0.1 bits/vB.'
    },
    urlString: '/v1/fees/precise',
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/fees/precise`,
          commonJS: ``,
          esModule: ``,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "fastestFee": 2.023,
  "halfHourFee": 1.094,
  "hourFee": 0.502,
  "economyFee": 0.2,
  "minimumFee": 0.1
}`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "fastestFee": 1.5,
  "halfHourFee": 1.25,
  "hourFee": 1,
  "economyFee": 1,
  "minimumFee": 1
}`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "fastestFee": 1.5,
  "halfHourFee": 1.25,
  "hourFee": 1,
  "economyFee": 1,
  "minimumFee": 1
}`
        },
        codeSampleLiquid: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "fastestFee": 0.1,
  "halfHourFee": 0.1,
  "hourFee": 0.1,
  "economyFee": 0.1,
  "minimumFee": 0.1
}`
        },
        codeSampleLiquidTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "fastestFee": 0.1,
  "halfHourFee": 0.1,
  "hourFee": 0.1,
  "economyFee": 0.1,
  "minimumFee": 0.1
}`
        },
      }
    }
  },
  {
    type: 'category',
    category: 'mempool',
    fragment: 'mempool',
    title: 'Mempool',
    showConditions: bitcoinNetworks.concat(liquidNetworks)
  },
  {
    type: 'endpoint',
    category: 'mempool',
    httpRequestMethod: 'GET',
    fragment: 'get-mempool',
    title: 'GET Mempool',
    description: {
      default: 'Returns current mempool backlog statistics.'
    },
    urlString: '/mempool',
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/mempool`,
          commonJS: `
        const { %{0}: { mempool } } = mempoolJS();

        const getMempool = await mempool.getMempool();

        document.getElementById("result").textContent = JSON.stringify(getMempool, undefined, 2);
        `,
          esModule: `
  const { %{0}: { mempool } } = mempoolJS();

  const getMempool = await mempool.getMempool();
  console.log(getMempool);
          `,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  count: 3169,
  vsize: 1891542,
  total_fee: 20317481,
  fee_histogram: []
}`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  count: 16,
  vsize: 2692,
  total_fee: 46318,
  fee_histogram: [
    [
      1.0071429,
      2692
    ]
  ]
}`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  count: 58,
  vsize: 8008,
  total_fee: 10407,
  fee_histogram: [
    [
      1,
      8008
    ]
  ]
}`
        },
        codeSampleLiquid: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  count: 0,
  vsize: 0,
  total_fee: 0,
  fee_histogram: [ ]
}`
        },
        codeSampleLiquidTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  count: 3,
  vsize: 20457,
  total_fee: 2089,
  fee_histogram: [
    [
      0.09981343,
      20457
    ]
  ]
}`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'mempool',
    httpRequestMethod: 'GET',
    fragment: 'get-mempool-transaction-ids',
    title: 'GET Mempool Transaction IDs',
    description: {
      default: 'Get the full list of txids in the mempool as an array. The order of the txids is arbitrary and does not match qbitd.'
    },
    urlString: '/mempool/txids',
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/mempool/txids`,
          commonJS: `
        const { %{0}: { mempool } } = mempoolJS();

        const getMempoolTxids = await mempool.getMempoolTxids();

        document.getElementById("result").textContent = JSON.stringify(getMempoolTxids, undefined, 2);
        `,
          esModule: `
  const { %{0}: { mempool } } = mempoolJS();

  const getMempoolTxids = await mempool.getMempoolTxids();
  console.log(getMempoolTxids);
          `,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  "65b04c4618999a221e8b66943a17c216172a9c865f49c88b76de81212b24bf01",
  "4a3ebe804f273b4c7a96e63f6b963e812ef7e6e0e8381c2d662715bcf5bfa846",
  "1ef9df26fab649183b591d148011ce809756f9cd9e6be3d383e80808b1929724",
  ...
]`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  "af04a3e8b7bd49217165435e2717b6ed977cde9c0f6f2a5813c4c39eb53748af",
  "d4c4989617e9af40518f7846f98e98e4a187bc29fb95542c9aa469af159c61e4",
  "c4c0630b18e910be0a70ebd5d4897b379168b0f357a6536188a28e38d2cf8b43",
  "c6c9c44ca17ff8c1ebfe27978e57277be6098f0fb5129840370c013fe503db24",
  ...
]`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  "ddd40341cfa1268801407e9ff43da020cab03f8bf1b422239da0652a4496367e",
  "7fe571957cf61c41598e2acb54211be32cd13df2b71b1612af1d860bbfb5ee9f",
  "b7cd3be4de533db392bb5bd8aaedd8b25607514502c60c0c6d54358931a6d95f",
  "7786de8ee4fe0b11410658866800b90e5a798e3721dd6031c6b5094474bd80c1",
  ...
]`
        },
        codeSampleLiquid: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  "f3f3acdaa6a823efcbbbbcc607ec4d1c2c40d618135ec09d8ed96e4d9b37db38"
]`
        },
        codeSampleLiquidTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  "b644716cb1aeb3e6e9fb4258b0b95dfad8b8e4cd1ec8649bf1116a500cc870e5",
  "3ab8bc068ee05c1114647dc5196b3b954b00e5af3b03d470d1ef8a8953737357",
  "dfbe66e6e71e775c9529a822c14286de0ee1066c2760a53552615d05e17006f3"
]`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'mempool',
    httpRequestMethod: 'GET',
    fragment: 'get-mempool-recent',
    title: 'GET Mempool Recent',
    description: {
      default: 'Get a list of the last 10 transactions to enter the mempool. Each transaction object contains simplified overview data, with the following fields: <code>txid</code>, <code>fee</code>, <code>vsize</code>, and <code>value</code>.'
    },
    urlString: '/mempool/recent',
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/mempool/recent`,
          commonJS: `
        const { %{0}: { mempool } } = mempoolJS();

        const getMempoolRecent = await mempool.getMempoolRecent();

        document.getElementById("result").textContent = JSON.stringify(getMempoolRecent, undefined, 2);
        `,
          esModule: `
  const { %{0}: { mempool } } = mempoolJS();

  const getMempoolRecent = await mempool.getMempoolRecent();
  console.log(getMempoolRecent);
          `,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  {
    txid: "4b93c138293a7e3dfea6f0a63d944890b5ba571b03cc22d8c66995535e90dce8",
    fee: 18277,
    vsize: 2585,
    value: 4972029
  },
  ...
]`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  {
    txid: "1fc5098fe3378828a890fa5144883cdd1411d9cdbb1af365c20e72503b11dc81",
    fee: 221,
    vsize: 201,
    value: 944960
  },
  ...
]`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  {
    txid: "18dcbd5405f65f583ed32db2f86f84510c07c59ac5321bb90cbd3a3f2963c224",
    fee: 183,
    vsize: 140,
    value: 4369990908
  },
  ...
]`
        },
        codeSampleLiquid: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  {
    txid: "06428bf0f6dc6a55e1d800afcd4697d1cdee4debbfaa7fd782d747a80d051c25",
    fee: 251,
    vsize: 2515
  },
  ...
]`
        },
        codeSampleLiquidTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  {
    txid: "814d9d285970dd55ea5b2f06f5d11fb895a2b78d61defbcd489477441e544f95",
    fee: 376,
    vsize: 3767
  },
  {
    txid: "e09a8b6bc950458bc77183acf4fd566d1cfd8e7373c4869f877b52e3b02ad9b1",
    fee: 138,
    vsize: 1379
  },
  ...
]`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'mempool',
    httpRequestMethod: 'GET',
    fragment: 'get-mempool-rbf',
    title: 'GET Mempool RBF Transactions',
    description: {
      default: 'Returns the list of mempool transactions that are part of a RBF chain.'
    },
    urlString: '/v1/replacements',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/replacements`,
          commonJS: ``,
          esModule: ``,
        },
        codeSampleMainnet: {
          curl: [],
          response: `[
  {
    tx: {
      txid: "1ca4b22006e57b1b13f5cc89a41cf7c9e99fe225aabf407251e4fe0268f22d93",
      fee: 14983,
      vsize: 141.5,
      value: 343934,
      rate: 105.886925795053,
      rbf: true,
      fullRbf: false
    },
    time: 1703331467,
    fullRbf: false,
    replaces: [
      {
        tx: {
          txid: "9f8e30674af641bb153a35254d539468e1d847b16bbdc13ce23b5a970b0b11cf",
          fee: 13664,
          vsize: 141.25,
          value: 345253,
          rate: 96.7362831858407,
          rbf: true
        },
        time: 1703331398,
        interval: 69,
        fullRbf: false,
        replaces: []
      }
    ]
  },
  ...
]`
        },
        codeSampleTestnet: {
          curl: [],
          response: `[
  {
    tx: {
      txid: "7766e3f008011b776905f96fcad9d4a7b75d1b368d1e77db2901254f1fa8357d",
      fee: 9101,
      vsize: 317,
      value: 147706698,
      rate: 28.709779179810724,
      rbf: true,
      fullRbf: false
    },
    time: 1703331325,
    fullRbf: false,
    replaces: [
      {
        tx: {
          txid: "43055f6e5750c6aa0c2214e59e99f367398d96bde935e7666c3e648d249a4e40",
          fee: 7000,
          vsize: 317,
          value: 147708799,
          rate: 22.082018927444796,
          rbf: true
        },
        time: 1703331154,
        interval: 171,
        fullRbf: false,
        replaces: []
      }
    ]
  },
  ...
]`
        },
        codeSampleSignet: {
          curl: [],
          response: `[
  {
    tx: {
      txid: "13985a5717a1ea54ce720cd6b70421b1667061be491a6799acf6dea01c551248",
      fee: 5040,
      vsize: 215.5,
      value: 762745,
      rate: 23.387470997679813,
      rbf: true,
      fullRbf: false,
      mined: true
    },
    time: 1703316271,
    fullRbf: false,
    replaces: [
      {
        tx: {
          txid: "eac5ec8487414c955f4a5d3b2e516c351aec5299f1335f9019a00907962386ce",
          fee: 4560,
          vsize: 215.25,
          value: 763225,
          rate: 21.18466898954704,
          rbf: true
        },
        time: 1703316270,
        interval: 1,
        fullRbf: false,
        replaces: []
      }
    ],
    mined: true
  }
]`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
      }
    }
  },
  {
    type: 'endpoint',
    category: 'mempool',
    httpRequestMethod: 'GET',
    fragment: 'get-mempool-fullrbf',
    title: 'GET Mempool Full RBF Transactions',
    description: {
      default: 'Returns the list of mempool transactions that are part of a Full-RBF chain.'
    },
    urlString: '/v1/fullrbf/replacements',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/fullrbf/replacements`,
          commonJS: ``,
          esModule: ``,
        },
        codeSampleMainnet: {
          curl: [],
          response: `[
  {
    tx: {
      txid: "25e2bfaf0e0821e5cb71f11e460b2f71e1d5a3755015de42544afa5fbad6d443",
      fee: 24436,
      vsize: 297.75,
      value: 273418,
      rate: 82.0688497061293,
      rbf: false,
      fullRbf: true
    },
    time: 1703409882,
    fullRbf: true,
    replaces: [
      {
        tx: {
          txid: "07d501e8ad4a25f07f3ced0a6102741720f710765e6fdb2eb966ba0df657997a",
          fee: 24138,
          vsize: 297.75,
          value: 273716,
          rate: 81.06801007556675,
          rbf: false
        },
        time: 1703409853,
        interval: 29,
        fullRbf: true,
        replaces: []
      }
    ]
  },
  ...
]`
        },
        codeSampleTestnet: {
          curl: [],
          response: `[
  {
    tx: {
      txid: "25e2bfaf0e0821e5cb71f11e460b2f71e1d5a3755015de42544afa5fbad6d443",
      fee: 24436,
      vsize: 297.75,
      value: 273418,
      rate: 82.0688497061293,
      rbf: false,
      fullRbf: true
    },
    time: 1703409882,
    fullRbf: true,
    replaces: [
      {
        tx: {
          txid: "07d501e8ad4a25f07f3ced0a6102741720f710765e6fdb2eb966ba0df657997a",
          fee: 24138,
          vsize: 297.75,
          value: 273716,
          rate: 81.06801007556675,
          rbf: false
        },
        time: 1703409853,
        interval: 29,
        fullRbf: true,
        replaces: []
      }
    ]
  },
  ...
]`
        },
        codeSampleSignet: {
          curl: [],
          response: `[
  {
    tx: {
      txid: "25e2bfaf0e0821e5cb71f11e460b2f71e1d5a3755015de42544afa5fbad6d443",
      fee: 24436,
      vsize: 297.75,
      value: 273418,
      rate: 82.0688497061293,
      rbf: false,
      fullRbf: true
    },
    time: 1703409882,
    fullRbf: true,
    replaces: [
      {
        tx: {
          txid: "07d501e8ad4a25f07f3ced0a6102741720f710765e6fdb2eb966ba0df657997a",
          fee: 24138,
          vsize: 297.75,
          value: 273716,
          rate: 81.06801007556675,
          rbf: false
        },
        time: 1703409853,
        interval: 29,
        fullRbf: true,
        replaces: []
      }
    ]
  },
  ...
]`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
      }
    }
  },
  {
    type: 'category',
    category: 'transactions',
    fragment: 'transactions',
    title: 'Transactions',
    showConditions: bitcoinNetworks.concat(liquidNetworks)
  },
  {
    type: 'endpoint',
    category: 'transactions',
    httpRequestMethod: 'GET',
    fragment: 'get-cpfp',
    title: 'GET Children Pay for Parent',
    description: {
      default: 'Returns the ancestors and the best descendant fees for a transaction.'
    },
    urlString: '/v1/cpfp',
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/cpfp/%{1}`,
          commonJS: `
        const { %{0}: { fees } } = mempoolJS();

        const txid = 'txid';
        const feesCPFP = await fees.getCPFP({ txid });

        document.getElementById("result").textContent = JSON.stringify(feesCPFP, undefined, 2);
        `,
          esModule: `
  const { %{0}: { fees } } = mempoolJS();

  const txid = 'txid';
  const feesCPFP = await fees.getCPFP({ txid });
  console.log(feesCPFP);
          `,
        },
        codeSampleMainnet: {
          esModule: ['txid'],
          commonJS: ['txid'],
          curl: ['txid'],
          response: ``
        },
        codeSampleTestnet: {
          esModule: ['txid'],
          commonJS: ['txid'],
          curl: ['txid'],
          response: ``
        },
        codeSampleSignet: {
          esModule: ['txid'],
          commonJS: ['txid'],
          curl: ['txid'],
          response: ``
        },
        codeSampleLiquid: {
          esModule: ['txid'],
          commonJS: ['txid'],
          curl: ['txid'],
          response: ``
        },
        codeSampleLiquidTestnet: {
          esModule: ['txid'],
          commonJS: ['txid'],
          curl: ['txid'],
          response: ``
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'transactions',
    httpRequestMethod: 'GET',
    fragment: 'get-transaction',
    title: 'GET Transaction',
    description: {
      default: 'Returns details about a transaction. Available fields: <code>txid</code>, <code>version</code>, <code>locktime</code>, <code>size</code>, <code>weight</code>, <code>fee</code>, <code>vin</code>, <code>vout</code>, and <code>status</code>.'
    },
    urlString: '/tx/:txid',
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/tx/%{1}`,
          commonJS: `
        const { %{0}: { transactions } } = mempoolJS();

        const txid = '%{1}';
        const tx = await transactions.getTx({ txid });

        document.getElementById("result").textContent = JSON.stringify(tx, undefined, 2);
        `,
          esModule: `
  const { %{0}: { transactions } } = mempoolJS();

  const txid = '%{1}';
  const tx = await transactions.getTx({ txid });
  console.log(tx);
          `,
        },
        codeSampleMainnet: {
          esModule: ['053486685773077b30fcfeddd15e8d3e325502615a2cc173121d24631f78765b'],
          commonJS: ['053486685773077b30fcfeddd15e8d3e325502615a2cc173121d24631f78765b'],
          curl: ['053486685773077b30fcfeddd15e8d3e325502615a2cc173121d24631f78765b'],
          response: `{
  "txid": "053486685773077b30fcfeddd15e8d3e325502615a2cc173121d24631f78765b",
  "version": 2,
  "locktime": 0,
  "vin": [
    {
      "txid": "ab7a18ec1c4476d8268ec04c16332554c813a802a9c328d59c03649d358bcd13",
      "vout": 2,
      "prevout": {
        "scriptpubkey": "522090d63fc95a05fe378059f18a9808cfef4f6568eda9e7146f0f2f852e22c7f007",
        "scriptpubkey_asm": "OP_PUSHNUM_2 OP_PUSHBYTES_32 90d63fc95a05fe378059f18a9808cfef4f6568eda9e7146f0f2f852e22c7f007",
        "scriptpubkey_type": "v2_p2mr",
        "scriptpubkey_address": "qb1zjrtrlj26qhlr0qze7x9fszx0aa8k268d48n3gmc097zjugk87qrsq9l22h",
        "value": 3411214
      },
      "scriptsig": "",
      "scriptsig_asm": "",
      "witness": [
        "bc0e61d477e4e164043eae3a7e17fa83378f5f977614c5e73342c113ad274513...",
        "20583e99acbe68d35478e2de0c81baa1f02a694f20e95ea7fdb84972a087bc493bb3",
        ...
      ],
      "is_coinbase": false,
      "sequence": 4294967293,
      "inner_witnessscript_asm": "OP_PUSHBYTES_32 583e99acbe68d35478e2de0c81baa1f02a694f20e95ea7fdb84972a087bc493b OP_CHECKSIGPQC"
    }
  ],
  "vout": [
    {
      "scriptpubkey": "6a357b2270223a22716269742d3230222c226f70223a226d696e74222c227469636b223a224e454f4e222c22616d74223a22323130227d",
      "scriptpubkey_asm": "OP_RETURN OP_PUSHBYTES_53 7b2270223a22716269742d3230222c226f7022...",
      "scriptpubkey_type": "op_return",
      "value": 0
    },
    {
      "scriptpubkey": "5220171be5cd839aa4edc6c97f98acaa1972462c225da155721082d5e7f42f72e383",
      "scriptpubkey_asm": "OP_PUSHNUM_2 OP_PUSHBYTES_32 171be5cd839aa4edc6c97f98acaa1972462c225da155721082d5e7f42f72e383",
      "scriptpubkey_type": "v2_p2mr",
      "scriptpubkey_address": "qb1zzud7tnvrn2jwm3kf07v2e2sewfrzcgja592hyyyz6hnlgtmjuwps3gpfcs",
      "value": 100000
    },
    ...
  ],
  "size": 3924,
  "weight": 3924,
  "vsize": 3924,
  "sigops": 0,
  "fee": 51394,
  "status": {
    "confirmed": true,
    "block_height": 161388,
    "block_hash": "0000000000000001375acbbf5381a88f9de4a13f9383ad3d03707b274f03b277",
    "block_time": 1793833342
  },
  "order": 1534490655,
  "adjustedVsize": 3924,
  "feePerVsize": 13.097349643221202,
  "adjustedFeePerVsize": 13.097349643221202,
  "effectiveFeePerVsize": 13.097349643221202
}`
        },
        codeSampleTestnet: {
          esModule: ['ba2d67a7ae5d869170ecaf927383368d8cb52d2db01c7268df1f343bd24362fc'],
          commonJS: ['ba2d67a7ae5d869170ecaf927383368d8cb52d2db01c7268df1f343bd24362fc'],
          curl: ['ba2d67a7ae5d869170ecaf927383368d8cb52d2db01c7268df1f343bd24362fc'],
          response: `{
  "txid": "ba2d67a7ae5d869170ecaf927383368d8cb52d2db01c7268df1f343bd24362fc",
  "version": 2,
  "locktime": 0,
  "vin": [
    {
      "txid": "5e7e1a93217029827e0829d5356951bdb887fc69efdea5919d039864b5888bc1",
      "vout": 0,
      "prevout": {
        "scriptpubkey": "5220ddba5296a1b1e1c2ab147327a5c0c55ed40a57e2d5ed2ce0f5524433b3825293",
        "scriptpubkey_asm": "OP_PUSHNUM_2 OP_PUSHBYTES_32 ddba5296a1b1e1c2ab147327a5c0c55ed40a57e2d5ed2ce0f5524433b3825293",
        "scriptpubkey_type": "v2_p2mr",
        "scriptpubkey_address": "tq1zmka9994pk8su92c5wvn6tsx9tm2q54lz6hkjec842fzr8vuz22fszzh956",
        "value": 23960
      },
      "scriptsig": "",
      "scriptsig_asm": "",
      "witness": [
        "0ed590cf0b59718f34ddd2da0d0762f641e69d4289594fe73e7700cd8fe11f9a...",
        "20a11f4736edb8fcb41bcf307543c22efda1ebb7020e9c615cf0c7af49e19f8a...",
        ...
      ],
      "is_coinbase": false,
      "sequence": 4294967294,
      "inner_witnessscript_asm": "OP_PUSHBYTES_32 a11f4736edb8fcb41bcf307543c22efda1ebb7020e9c615c..."
    }
  ],
  "vout": [
    {
      "scriptpubkey": "5220d117f1c6142e8ae7b8222ec56c38d4f01919b648b0ef229f6b28be717a5dd10a",
      "scriptpubkey_asm": "OP_PUSHNUM_2 OP_PUSHBYTES_32 d117f1c6142e8ae7b8222ec56c38d4f01919b648b0ef229f6b28be717a5dd10a",
      "scriptpubkey_type": "v2_p2mr",
      "scriptpubkey_address": "tq1z6ytlr3s5969w0wpz9mzkcwx57qv3ndjgkrhj98mt9zl8z7ja6y9qkglrns",
      "value": 10000
    },
    {
      "scriptpubkey": "5220a12cdeb7727008fcf1ed926ee298cc851aa522e1b9a9b4ee28fed6a179caa0ba",
      "scriptpubkey_asm": "OP_PUSHNUM_2 OP_PUSHBYTES_32 a12cdeb7727008fcf1ed926ee298cc851aa522e1b9a9b4ee28fed6a179caa0ba",
      "scriptpubkey_type": "v2_p2mr",
      "scriptpubkey_address": "tq1z5ykdadmjwqy0eu0djfhw9xxvs5d22ghphx5mfm3glmt2z7w25zaqzq4p7v",
      "value": 10000
    }
  ],
  "size": 3960,
  "weight": 3960,
  "vsize": 3960,
  "sigops": 0,
  "fee": 3960,
  "status": {
    "confirmed": true,
    "block_height": 202432,
    "block_hash": "0000000000004566ada8ed167de2f48c8c3f9cd9c3ce661df41c9cb82811388f",
    "block_time": 1793838527
  },
  "order": 4234298322,
  "adjustedVsize": 3960,
  "feePerVsize": 1,
  "adjustedFeePerVsize": 1,
  "effectiveFeePerVsize": 1
}`
        },
        codeSampleSignet: {
          esModule: ['fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025'],
          commonJS: ['fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025'],
          curl: ['fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025'],
          response: `{
  txid: "fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025",
  version: 2,
  locktime: 0,
  vin: [],
  vout: [],
  size: 99,
  weight: 381,
  fee: 125,
  status: {
    confirmed: true,
    block_height: 53788,
    block_hash: "0000012a49f15fdbec49f647800d26dabc4027ade9739f398f618d167128b225",
    block_time: 1630648988
  }
}`
        },
        codeSampleLiquid: {
          esModule: [`801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a`],
          commonJS: [`801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a`],
          curl: [`801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a`],
          response: `{
  txid: "801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a",
  version: 2,
  locktime: 1472364,
  vin: [],
  vout: [],
  size: 4599,
  weight: 5325,
  fee: 529,
  status: {
    confirmed: true,
    block_height: 1472366,
    block_hash: "8422f44e62d7349f8c54c3d353290a8edea1532898e6dc832902bf7ef396e7c1",
    block_time: 1630649218
  }
}`,
        },
        codeSampleLiquidTestnet: {
          esModule: [`59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4`],
          commonJS: [`59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4`],
          curl: [`59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4`],
          response: `{
  txid: "59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4",
  version: 2,
  locktime: 168763,
  vin: [],
  vout: [],
  size: 13557,
  weight: 15069,
  fee: 376,
  status: {
    confirmed: true,
    block_height: 168765,
    block_hash: "05a51089255650a16c17b4b3f3977376bc7ebe90a35584578f12916c3eaba59e",
    block_time: 1642000444
  }
}`,
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'transactions',
    httpRequestMethod: 'GET',
    fragment: 'get-transaction-hex',
    title: 'GET Transaction Hex',
    description: {
      default: 'Returns a transaction serialized as hex.'
    },
    urlString: '/tx/:txid/hex',
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/tx/%{1}/hex`,
          commonJS: `
        const { %{0}: { transactions } } = mempoolJS();

        const txid = '%{1}';
        const txHex = await transactions.getTxHex({ txid });

        document.getElementById("result").textContent = JSON.stringify(txHex, undefined, 2);
        `,
          esModule: `
  const { %{0}: { transactions } } = mempoolJS();

  const txid = '%{1}';
  const txHex = await transactions.getTxHex({ txid });
  console.log(txHex);
          `,
        },
        codeSampleMainnet: {
          esModule: ['053486685773077b30fcfeddd15e8d3e325502615a2cc173121d24631f78765b'],
          commonJS: ['053486685773077b30fcfeddd15e8d3e325502615a2cc173121d24631f78765b'],
          curl: ['053486685773077b30fcfeddd15e8d3e325502615a2cc173121d24631f78765b'],
          response: `0200000000010113cd8b359d64039cd528c3a902a813c8542533164cc08e26d876441cec187aab0200000000fdffffff030000000000000000376a357b2270223a22716269742d3230222c226f70223a226d696e74222c227469636b223a224e454f4e222c22616d74223a22323130227da086010000000000225220171be5cd...`
        },
        codeSampleTestnet: {
          esModule: ['ba2d67a7ae5d869170ecaf927383368d8cb52d2db01c7268df1f343bd24362fc'],
          commonJS: ['ba2d67a7ae5d869170ecaf927383368d8cb52d2db01c7268df1f343bd24362fc'],
          curl: ['ba2d67a7ae5d869170ecaf927383368d8cb52d2db01c7268df1f343bd24362fc'],
          response: `02000000000101c18b88b56498039d91a5deef69fc87b8bd516935d529087e82297021931a7e5e0000000000feffffff021027000000000000225220d117f1c6142e8ae7b8222ec56c38d4f01919b648b0ef229f6b28be717a5dd10a1027000000000000225220a12cdeb7727008fcf1ed926ee298cc851aa522e1b9a9b4ee28...`
        },
        codeSampleSignet: {
          esModule: ['fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025'],
          commonJS: ['fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025'],
          curl: ['fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025'],
          response: `02000000000101b7913f140f19850975352064a7ccfd7e96e1ed9a847c463309839a37c9d01e530000000000ffffffff017d65a61d000000002200204ae81572f06e1b88fd5ced7a1a000945432e83e1551e6f721ee9c00b8cc3326001015100000000`
        },
        codeSampleLiquid: {
          esModule: [`801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a`],
          commonJS: [`801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a`],
          curl: [`801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a`],
          response: `020000000101730fb6b65e115f4ec15690b3539311becd3ef8d1ed4c2b7e53ec3934b4254f65010000001716001436b178e63ed841263f7b82a97d2e783791394432feffffff020b5ff1f5c8059fc270bdeb196c5f38e3da2de8fd9034c34427b70fa66d2f388efe083745b65e4c6e029b020d74df709c5842737c4d50873ef4ec8e0579a3c41f09130274bf768af8b1c462b1e5b7ffb1bb496a019a0ed090e4ce26283a946542280c6f17a...`,
        },
        codeSampleLiquidTestnet: {
          esModule: [`59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4`],
          commonJS: [`59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4`],
          curl: [`59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4`],
          response: `020000000102fa567669f73a314138aa6dbe74e3935612895df273d20ccbbedbecd44a04d3ce0000000000fdffffff8412fed07b8316dd4304df90af6f20292d3b2950133711c0ee43eb94fe12cc4f0100000000fdffffff040b801035010192095b8d9316f28450e98a85c915994c3f80ecc493adf505d73e9609a51e48bc0f35e34f88c482654d659fa779dcbf0457dc71053f3edcf76bd3667f03821ffcc4fc4ae5c2668685fec678e4...`,
        },
      }
    },
  },
  {
    type: 'endpoint',
    category: 'transactions',
    httpRequestMethod: 'GET',
    fragment: 'get-transaction-merkleblock-proof',
    title: 'GET Transaction Merkleblock Proof',
    description: {
      default: 'Returns a merkle inclusion proof for the transaction using qbitd\'s merkleblock format.'
    },
    urlString: '/tx/:txid/merkleblock-proof',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/tx/%{1}/merkleblock-proof`,
          commonJS: `
        const { %{0}: { transactions } } = mempoolJS();

        const txid = '%{1}';
        const txMerkleBlockProof = await transactions.getTxMerkleBlockProof({ txid });

        document.getElementById("result").textContent = JSON.stringify(txMerkleBlockProof, undefined, 2);
        `,
          esModule: `
  const { %{0}: { transactions } } = mempoolJS();

  const txid = '%{1}';
  const txMerkleBlockProof = await transactions.getTxMerkleBlockProof({ txid });
  console.log(txMerkleBlockProof);
          `,
        },
        codeSampleMainnet: {
          esModule: ['053486685773077b30fcfeddd15e8d3e325502615a2cc173121d24631f78765b'],
          commonJS: ['053486685773077b30fcfeddd15e8d3e325502615a2cc173121d24631f78765b'],
          curl: ['053486685773077b30fcfeddd15e8d3e325502615a2cc173121d24631f78765b'],
          response: `0300000058f6dd09ac5aea942c01d12e75b351e73f4304cc442741000000000000000000ef0c2fa8517414b742094a020da7eba891b47d660ef66f126ad01e5be99a2fd09ae093558e411618c14240df820700000ce4d15e17594f257b22d1ddf47d07b3b88779a8374fcd515ad883d79726c6027da6abfcbc1341a049b30277d3bf14e4663...`
        },
        codeSampleTestnet: {
          esModule: ['ba2d67a7ae5d869170ecaf927383368d8cb52d2db01c7268df1f343bd24362fc'],
          commonJS: ['ba2d67a7ae5d869170ecaf927383368d8cb52d2db01c7268df1f343bd24362fc'],
          curl: ['ba2d67a7ae5d869170ecaf927383368d8cb52d2db01c7268df1f343bd24362fc'],
          response: `0000602002bf77bbb098f90f149430c314e71ef4e2671ea5e04a2503e0000000000000000406ffb54f2925360aae81bd3199f456928bbe6ae83a877902da9d9ffb08215da0ba3161ffff001a545a850bb80000000906e0c62f68fdf4865a46889e2e12d66f03cc537225d612aa77b08a38936b4d435d73544598d93174314d75e5833...`
        },
        codeSampleSignet: {
          esModule: ['fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025'],
          commonJS: ['fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025'],
          curl: ['fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025'],
          response: `00000020d356e0a14120d45653120a7bd53280ffce2aa2ced301682a1f2867687f000000298ef149a1675866dbdde315b22c24c63fd7670fdc5b86b588007fa187fa85089cba31619356011eaedd8800180000000656e9b938241cb350316cd9155167f3bce7370aa1095143c304ef7a44da4984e02550c48f3e01648dd65f5e3e290432c...`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
      }
    }
  },
  {
    type: 'endpoint',
    category: 'transactions',
    httpRequestMethod: 'GET',
    fragment: 'get-transaction-merkle-proof',
    title: 'GET Transaction Merkle Proof',
    description: {
      default: 'Returns a merkle inclusion proof for the transaction using <a href=\'https://electrumx.readthedocs.io/en/latest/protocol-methods.html#blockchain-transaction-get-merkle\'>Electrum\'s blockchain.transaction.get_merkle format.'
    },
    urlString: '/tx/:txid/merkle-proof',
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/tx/%{1}/merkle-proof`,
          commonJS: `
        const { %{0}: { transactions } } = mempoolJS();

        const txid = '%{1}';
        const txMerkleProof = await transactions.getTxMerkleProof({ txid });

        document.getElementById("result").textContent = JSON.stringify(txMerkleProof, undefined, 2);
        `,
          esModule: `
  const { %{0}: { transactions } } = mempoolJS();

  const txid = '%{1}';
  const txMerkleProof = await transactions.getTxMerkleProof({ txid });
  console.log(txMerkleProof);
          `,
        },
        codeSampleMainnet: {
          esModule: ['053486685773077b30fcfeddd15e8d3e325502615a2cc173121d24631f78765b'],
          commonJS: ['053486685773077b30fcfeddd15e8d3e325502615a2cc173121d24631f78765b'],
          curl: ['053486685773077b30fcfeddd15e8d3e325502615a2cc173121d24631f78765b'],
          response: `{
  "block_height": 161388,
  "merkle": [
    "6001f8c21ef6d6a68be6fd9562f0714700af14e4d2e3477284b781bdac130c56",
    "2de239e74d9c8632cf70782e5e2dfd170c04c34b85fb3e77ba19aba764dc2ba3",
    "3946e1f375ac9e9afa5b26b523efaace4f29dbdc58b18bcece16f04a7542dd46",
    "32f1be731fe2b74dc313f0e6b5437add9335fc068149e7490ab105d1388fca08",
    "98e891269e31ca0adc4c9695eecebd140c8ebb5f443be7d5dbfe2b3e4909df34",
    ...
  ],
  "pos": 11
}`
        },
        codeSampleTestnet: {
          esModule: ['ba2d67a7ae5d869170ecaf927383368d8cb52d2db01c7268df1f343bd24362fc'],
          commonJS: ['ba2d67a7ae5d869170ecaf927383368d8cb52d2db01c7268df1f343bd24362fc'],
          curl: ['ba2d67a7ae5d869170ecaf927383368d8cb52d2db01c7268df1f343bd24362fc'],
          response: `{
  "block_height": 202432,
  "merkle": [
    "02b95f4057f72cca82172ac9d65c4feb4e501ca0450f762fec4e638b5b591a75",
    "f31d219fe3cb4d71c4e56a0a1bd724bdca6d80d46a40bbedf8c0518a99ece3d1"
  ],
  "pos": 1
}`
        },
        codeSampleSignet: {
          esModule: ['fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025'],
          commonJS: ['fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025'],
          curl: ['fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025'],
          response: `{
  block_height: 53788,
  merkle: [
    "e08449da447aef04c3435109a10a37e7bcf3675115d96c3150b31c2438b9e956",
    "027699486d6cc71669bbc8168632101ed95266dcd02fa8b757830d570ef54d15",
    "62458b115b3db7e9dafecb37de1fcb985891bc77a323018811b6d0392e3705a6",
    "3a32287eccca335a3dac6aede77855a78faed4060d16bb89517da9816a763cb4",
    "76a86eb801f1884b99389af3cd41a7994679c3f93c53f9fcf0505ab1340b329f"
  ],
  pos: 1
}`
        },
        codeSampleLiquid: {
          esModule: ['801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a'],
          commonJS: ['801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a'],
          curl: ['801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a'],
          response: `{
  block_height: 1472366,
  merkle: [
    "ce1903e0a8a5e17c6267cf3397d42011611eb26aa7b65fd73b9851b71da3fc66",
    "377158243ad98ae874cc624e39f7da10d7072e2cbb5229c33cc0bee0bfb6eb4e"
  ],
  pos: 1
}`,
        },
        codeSampleLiquidTestnet: {
          esModule: ['59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4'],
          commonJS: ['59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4'],
          curl: ['59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4'],
          response: `{
  block_height: 168765,
  merkle: [
    "1dbe7041197b78f73c0d4a3810c47080c252bc928f041b787acaad3fa76ba7a0"
  ],
  pos: 1
}`,
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'transactions',
    httpRequestMethod: 'GET',
    fragment: 'get-transaction-outspend',
    title: 'GET Transaction Outspend',
    description: {
      default: 'Returns the spending status of a transaction output. Available fields: <code>spent</code> (boolean), <code>txid</code> (optional), <code>vin</code> (optional), and <code>status</code> (optional, the status of the spending tx).'
    },
    urlString: '/tx/:txid/outspend/:vout',
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/tx/%{1}/outspend/%{2}`,
          commonJS: `
        const { %{0}: { transactions } } = mempoolJS();

        const txid = '%{1}';
        const txOutspend = await transactions.getTxOutspend({
          txid,
          vout: %{2},
        });

        document.getElementById("result").textContent = JSON.stringify(txOutspend, undefined, 2);
        `,
          esModule: `
  const { %{0}: { transactions } } = mempoolJS();

  const txid = '%{1}';
  const txOutspend = await transactions.getTxOutspend({
    txid,
    vout: %{2},
  });
  console.log(txOutspend);
          `,
        },
        codeSampleMainnet: {
          esModule: ['053486685773077b30fcfeddd15e8d3e325502615a2cc173121d24631f78765b', '2'],
          commonJS: ['053486685773077b30fcfeddd15e8d3e325502615a2cc173121d24631f78765b', '2'],
          curl: ['053486685773077b30fcfeddd15e8d3e325502615a2cc173121d24631f78765b', '2'],
          response: `{
  "spent": true,
  "txid": "e89dcf8a7a5bce5810e54176b4af8ad06e871e11a54e4ad9c25d0d01a56056f4",
  "vin": 0,
  "status": {
    "confirmed": true,
    "block_height": 161395,
    "block_hash": "0000000000000000f472b468a3d12b6db513adc3788a4a911e104795e360d77a",
    "block_time": 1793833899
  }
}`
        },
        codeSampleTestnet: {
          esModule: ['ba2d67a7ae5d869170ecaf927383368d8cb52d2db01c7268df1f343bd24362fc', '0'],
          commonJS: ['ba2d67a7ae5d869170ecaf927383368d8cb52d2db01c7268df1f343bd24362fc', '0'],
          curl: ['ba2d67a7ae5d869170ecaf927383368d8cb52d2db01c7268df1f343bd24362fc', '0'],
          response: `{
  "spent": false
}`
        },
        codeSampleSignet: {
          esModule: ['fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025', '0'],
          commonJS: ['fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025', '0'],
          curl: ['fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025', '0'],
          response: `{
  spent: true,
  txid: "ad9cb0f6770219f0a2325d77466d30ff2ddd18b0f7f68b1deb547c4b3b972623",
  vin: 0,
  status: {
    confirmed: true,
    block_height: 53789,
    block_hash: "000000372e6b34e56866b4e4c75a372454e956bc42f6760b1b119bfa5ce58223",
    block_time: 1630649351
  }
}`
        },
        codeSampleLiquid: {
          esModule: ['801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a', '0'],
          commonJS: ['801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a', '0'],
          curl: ['801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a', '0'],
          response: `{
  spent: true,
  txid: "c02e132181dfc5f65ea16eadf53b346915b9f3937179c49e209b995e57c319c2",
  vin: 0,
  status: {
    confirmed: true,
    block_height: 1472368,
    block_hash: "a07de4ccbb212ea203c455dde477069fb6ed6120fc96c78402fa9d129efa31ff",
    block_time: 1630649338
  }
}`,
        },
        codeSampleLiquidTestnet: {
          esModule: ['59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4', '0'],
          commonJS: ['59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4', '0'],
          curl: ['59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4', '0'],
          response: `{
  spent: true,
  txid: "814d9d285970dd55ea5b2f06f5d11fb895a2b78d61defbcd489477441e544f95",
  vin: 0,
  status: {
    confirmed: true,
    block_height: 168793,
    block_hash: "3b10cdce761c4a2ec3e1239648c7d034922b34608a66f894e2f707307dae6b18",
    block_time: 1642002136
  }
}`,
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'transactions',
    httpRequestMethod: 'GET',
    fragment: 'get-transaction-outspends',
    title: 'GET Transaction Outspends',
    description: {
      default: 'Returns the spending status of all transaction outputs.'
    },
    urlString: '/tx/:txid/outspends',
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/tx/%{1}/outspends`,
          commonJS: `
        const { %{0}: { transactions } } = mempoolJS();

        const txid = '%{1}';
        const txOutspends = await transactions.getTxOutspends({ txid });
        document.getElementById("result").textContent = JSON.stringify(txOutspends, undefined, 2);
        `,
          esModule: `
  const { %{0}: { transactions } } = mempoolJS();

  const txid = '%{1}';
  const txOutspends = await transactions.getTxOutspends({ txid });

  console.log(txOutspends);
          `,
        },
        codeSampleMainnet: {
          esModule: ['053486685773077b30fcfeddd15e8d3e325502615a2cc173121d24631f78765b'],
          commonJS: ['053486685773077b30fcfeddd15e8d3e325502615a2cc173121d24631f78765b'],
          curl: ['053486685773077b30fcfeddd15e8d3e325502615a2cc173121d24631f78765b'],
          response: `[
  {
    "spent": false
  },
  {
    "spent": false
  },
  {
    "spent": true,
    "txid": "e89dcf8a7a5bce5810e54176b4af8ad06e871e11a54e4ad9c25d0d01a56056f4",
    "vin": 0,
    "status": {
      "confirmed": true,
      "block_height": 161395,
      "block_hash": "0000000000000000f472b468a3d12b6db513adc3788a4a911e104795e360d77a",
      "block_time": 1793833899
    }
  }
]`
        },
        codeSampleTestnet: {
          esModule: ['ba2d67a7ae5d869170ecaf927383368d8cb52d2db01c7268df1f343bd24362fc'],
          commonJS: ['ba2d67a7ae5d869170ecaf927383368d8cb52d2db01c7268df1f343bd24362fc'],
          curl: ['ba2d67a7ae5d869170ecaf927383368d8cb52d2db01c7268df1f343bd24362fc'],
          response: `[
  {
    "spent": false
  },
  {
    "spent": false
  }
]`
        },
        codeSampleSignet: {
          esModule: ['fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025'],
          commonJS: ['fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025'],
          curl: ['fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025'],
          response: `[
  {
    spent: true,
    txid: "ad9cb0f6770219f0a2325d77466d30ff2ddd18b0f7f68b1deb547c4b3b972623",
    vin: 0,
    status: {
      confirmed: true,
      block_height: 53789,
      block_hash: "000000372e6b34e56866b4e4c75a372454e956bc42f6760b1b119bfa5ce58223",
      block_time: 1630649351
    }
  }
]`
        },
        codeSampleLiquid: {
          esModule: ['801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a'],
          commonJS: ['801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a'],
          curl: ['801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a'],
          response: `{
  spent: true,
  txid: "c02e132181dfc5f65ea16eadf53b346915b9f3937179c49e209b995e57c319c2",
  vin: 0,
  status: {
    confirmed: true,
    block_height: 1472368,
    block_hash: "a07de4ccbb212ea203c455dde477069fb6ed6120fc96c78402fa9d129efa31ff",
    block_time: 1630649338
  }
}`,
        },
        codeSampleLiquidTestnet: {
          esModule: ['59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4'],
          commonJS: ['59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4'],
          curl: ['59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4'],
          response: `[
  {
    spent: false
  },
  {
    spent: true,
    txid: "814d9d285970dd55ea5b2f06f5d11fb895a2b78d61defbcd489477441e544f95",
    vin: 0,
    status: {
      confirmed: true,
      block_height: 168793,
      block_hash: "3b10cdce761c4a2ec3e1239648c7d034922b34608a66f894e2f707307dae6b18",
      block_time: 1642002136
    }
  },
  {
    spent: false
  },
  {
    spent: false
  }
]`,
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'transactions',
    httpRequestMethod: 'GET',
    fragment: 'get-transaction-raw',
    title: 'GET Transaction Raw',
    description: {
      default: 'Returns a transaction as binary data.'
    },
    urlString: '/tx/:txid/raw',
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/tx/%{1}/raw`,
          commonJS: `
        const { %{0}: { transactions } } = mempoolJS();

        const txid = '%{1}';
        const txRaw = await transactions.getTxRaw({ txid });

        document.getElementById("result").textContent = JSON.stringify(txRaw, undefined, 2);
        `,
          esModule: `
  const { %{0}: { transactions } } = mempoolJS();

  const txid = '%{1}';
  const txRaw = await transactions.getTxRaw({ txid });
  console.log(txRaw);
          `,
        },
        codeSampleMainnet: {
          esModule: ['053486685773077b30fcfeddd15e8d3e325502615a2cc173121d24631f78765b'],
          commonJS: ['053486685773077b30fcfeddd15e8d3e325502615a2cc173121d24631f78765b'],
          curl: ['053486685773077b30fcfeddd15e8d3e325502615a2cc173121d24631f78765b'],
          response: ``
        },
        codeSampleTestnet: {
          esModule: ['ba2d67a7ae5d869170ecaf927383368d8cb52d2db01c7268df1f343bd24362fc'],
          commonJS: ['ba2d67a7ae5d869170ecaf927383368d8cb52d2db01c7268df1f343bd24362fc'],
          curl: ['ba2d67a7ae5d869170ecaf927383368d8cb52d2db01c7268df1f343bd24362fc'],
          response: ``
        },
        codeSampleSignet: {
          esModule: ['fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025'],
          commonJS: ['fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025'],
          curl: ['fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025'],
          response: ``
        },
        codeSampleLiquid: {
          esModule: ['801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a'],
          commonJS: ['801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a'],
          curl: ['801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a'],
          response: ``,
        },
        codeSampleLiquidTestnet: {
          esModule: ['59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4'],
          commonJS: ['59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4'],
          curl: ['59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4'],
          response: ``,
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'transactions',
    httpRequestMethod: 'GET',
    fragment: 'get-transaction-rbf-timeline',
    title: 'GET Transaction RBF Timeline',
    description: {
      default: 'Returns the RBF tree timeline of a transaction.'
    },
    urlString: 'v1/tx/:txId/rbf',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/tx/%{1}/rbf`,
          commonJS: ``,
          esModule: ``,
        },
        codeSampleMainnet: {
          curl: [`053486685773077b30fcfeddd15e8d3e325502615a2cc173121d24631f78765b`],
          response: `{
  replacements: {
    tx: {
      txid: "2e95ff9094df9f3650e3f2abc189250760162be89a88f9f2f23301c7cb14b8b4",
      fee: 1668,
      vsize: 276.75,
      value: 14849,
      rate: 4.824207492795389,
      rbf: false,
      fullRbf: true
    },
    time: 1703240261,
    fullRbf: true,
    replaces: [
      {
        tx: {
          txid: "3f4670463daadffed07d7a1060071b07f7e81a2566eca21d78bb513cbf21c82a",
          fee: 420,
          vsize: 208.25,
          value: 4856,
          rate: 2.0168067226890756,
          rbf: false
        },
        time: 1702870898,
        interval: 369363,
        fullRbf: true,
        replaces: []
      }
      ...
    ]
  },
  replaces: [
    "3f4670463daadffed07d7a1060071b07f7e81a2566eca21d78bb513cbf21c82a",
    "92f9b4f719d0ffc9035d3a9767d80c940cecbc656df2243bafd33f52b583ee92"
  ]
}`
        },
        codeSampleTestnet: {
          curl: [`ba2d67a7ae5d869170ecaf927383368d8cb52d2db01c7268df1f343bd24362fc`],
          response: `{
  replacements: {
    tx: {
      txid: "5faaa30530bee55de8cc896bdf48f803c2274a94bffc2842386bec2a8bf7a813",
      fee: 9101,
      vsize: 318,
      value: 148022607,
      rate: 28.61949685534591,
      rbf: true,
      fullRbf: false,
      mined: true
    },
    time: 1703322610,
    fullRbf: false,
    replaces: [
      {
        tx: {
          txid: "06e69641fa889fe9148669ac2904929004e7140087bedaec8c8e4e05aabded52",
          fee: 7000,
          vsize: 318,
          value: 148024708,
          rate: 22.0125786163522,
          rbf: true
        },
        time: 1703322602,
        interval: 8,
        fullRbf: false,
        replaces: []
      }
    ],
    mined: true
  },
  replaces: [
    "06e69641fa889fe9148669ac2904929004e7140087bedaec8c8e4e05aabded52"
  ]
}`
        },
        codeSampleSignet: {
          curl: [`13985a5717a1ea54ce720cd6b70421b1667061be491a6799acf6dea01c551248`],
          response: `{
  replacements: {
    tx: {
      txid: "13985a5717a1ea54ce720cd6b70421b1667061be491a6799acf6dea01c551248",
      fee: 5040,
      vsize: 215.5,
      value: 762745,
      rate: 23.387470997679813,
      rbf: true,
      fullRbf: false,
      mined: true
    },
    time: 1703316272,
    fullRbf: false,
    replaces: [
      {
        tx: {
          txid: "eac5ec8487414c955f4a5d3b2e516c351aec5299f1335f9019a00907962386ce",
          fee: 4560,
          vsize: 215.25,
          value: 763225,
          rate: 21.18466898954704,
          rbf: true
        },
        time: 1703316270,
        interval: 2,
        fullRbf: false,
        replaces: []
      }
    ],
    mined: true
  },
  replaces: [
    "eac5ec8487414c955f4a5d3b2e516c351aec5299f1335f9019a00907962386ce"
  ]
}`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
      }
    }
  },
  {
    type: 'endpoint',
    category: 'transactions',
    httpRequestMethod: 'GET',
    fragment: 'get-transaction-status',
    title: 'GET Transaction Status',
    description: {
      default: 'Returns the confirmation status of a transaction. Available fields: <code>confirmed</code> (boolean), <code>block_height</code> (optional), and <code>block_hash</code> (optional).'
    },
    urlString: '/tx/:txid/status',
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/tx/%{1}/status`,
          commonJS: `
        const { %{0}: { transactions } } = mempoolJS();

        const txid = '%{1}';
        const txStatus = await transactions.getTxStatus({ txid });

        document.getElementById("result").textContent = JSON.stringify(txStatus, undefined, 2);
        `,
          esModule: `
  const { %{0}: { transactions } } = mempoolJS();

  const txid = '%{1}';
  const txStatus = await transactions.getTxStatus({ txid });
  console.log(txStatus);
          `,
        },
        codeSampleMainnet: {
          esModule: ['053486685773077b30fcfeddd15e8d3e325502615a2cc173121d24631f78765b'],
          commonJS: ['053486685773077b30fcfeddd15e8d3e325502615a2cc173121d24631f78765b'],
          curl: ['053486685773077b30fcfeddd15e8d3e325502615a2cc173121d24631f78765b'],
          response: `{
  "confirmed": true,
  "block_height": 161388,
  "block_hash": "0000000000000001375acbbf5381a88f9de4a13f9383ad3d03707b274f03b277",
  "block_time": 1793833342
}`
        },
        codeSampleTestnet: {
          esModule: ['ba2d67a7ae5d869170ecaf927383368d8cb52d2db01c7268df1f343bd24362fc'],
          commonJS: ['ba2d67a7ae5d869170ecaf927383368d8cb52d2db01c7268df1f343bd24362fc'],
          curl: ['ba2d67a7ae5d869170ecaf927383368d8cb52d2db01c7268df1f343bd24362fc'],
          response: `{
  "confirmed": true,
  "block_height": 202432,
  "block_hash": "0000000000004566ada8ed167de2f48c8c3f9cd9c3ce661df41c9cb82811388f",
  "block_time": 1793838527
}`
        },
        codeSampleSignet: {
          esModule: ['fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025'],
          commonJS: ['fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025'],
          curl: ['fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025'],
          response: `{
  confirmed: true,
  block_height: 53788,
  block_hash: "0000012a49f15fdbec49f647800d26dabc4027ade9739f398f618d167128b225",
  block_time: 1630648988
}`
        },
        codeSampleLiquid: {
          esModule: ['801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a'],
          commonJS: ['801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a'],
          curl: ['801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a'],
          response: `{
  confirmed: true,
  block_height: 1472366,
  block_hash: "8422f44e62d7349f8c54c3d353290a8edea1532898e6dc832902bf7ef396e7c1",
  block_time: 1630649218
}`,
        },
        codeSampleLiquidTestnet: {
          esModule: ['59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4'],
          commonJS: ['59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4'],
          curl: ['59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4'],
          response: `{
  confirmed: true,
  block_height: 168765,
  block_hash: "05a51089255650a16c17b4b3f3977376bc7ebe90a35584578f12916c3eaba59e",
  block_time: 1642000444
}`,
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'transactions',
    httpRequestMethod: 'GET',
    fragment: 'get-transaction-times',
    title: 'GET Transaction Times',
    description: {
      default: 'Returns the timestamps when a list of unconfirmed transactions was initially observed in the mempool. If a transaction is not found in the mempool or has been mined, the timestamp will be <code>0</code>.'
    },
    urlString: '/v1/transaction-times',
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/transaction-times?txId[]=%{1}&txId[]=%{2}`,
          commonJS: ``,
          esModule: ``,
        },
        codeSampleMainnet: {
          curl: ['053486685773077b30fcfeddd15e8d3e325502615a2cc173121d24631f78765b', '2de5d75812774656cc1905cc40d6c40d35efe9555185037b5c065836415adac8'],
          response: `[0,0]`
        },
        codeSampleTestnet: {
          curl: ['ba2d67a7ae5d869170ecaf927383368d8cb52d2db01c7268df1f343bd24362fc', '5e914ae59827ffc237165b22e3b926758e05f60775a37f9df64783139f685b3b'],
          response: `[0,0]`
        },
        codeSampleSignet: {
          curl: ['8af0c5199acd89621244f2f61107fe5a9c7c7aad54928e8400651d03ca949aeb', '08f840f7b0c33c5b0fdadf1666e8a8c206836993d95fc1eeeef39b5ef9de03d0'],
          response: `[1703267652,1703267696]`
        },
        codeSampleLiquid: {
          curl: ['6091498f06a3054f82a0c3e5be0a23030185c658dc3568684b0bccc4e759be11', '631212a073aa4ca392e3aeb469d1366ec2ee288988b106e4a6fc8dae8c4d7a9a'],
          response: `[1703267652,1703267696]`,
        },
        codeSampleLiquidTestnet: {
          curl: ['fa8d43e47b2c4bbee12fd8bc1c7440028be2da6ac0f1df6ac77c983938c503fb', '26b12cd450f8fa8b6a527578db218bf212a60b2d5eb65c168f8eb3be6f5fd991'],
          response: `[1703268185,1703268209]`,
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'transactions',
    httpRequestMethod: 'POST',
    fragment: 'post-transaction',
    title: 'POST Transaction',
    description: {
      default: 'Broadcast a raw transaction to the network. The transaction should be provided as hex in the request body. The <code>txid</code> will be returned on success.'
    },
    urlString: '/api/tx',
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `%{1}" "[[hostname]][[baseNetworkUrl]]/api/tx`, //custom interpolation technique handled in replaceCurlPlaceholder()
          commonJS: `
        const { %{0}: { transactions } } = mempoolJS();

        const txHex = '%{1}';

        const txid = await transactions.postTx({ txHex });

        document.getElementById("result").textContent = JSON.stringify(txid, undefined, 2);
        `,
          esModule: `
  const { %{0}: { transactions } } = mempoolJS();

  const txHex = '%{1}';

  const txid = await transactions.postTx({ txHex });
  console.log(txid);
          `,
        },
        codeSampleMainnet: {
          esModule: ['0200000001fd5b5fcd1cb066c27cfc9fda5428b9be850b81ac440ea51f1ddba2f987189ac1010000008a4730440220686a40e9d2dbffeab4ca1ff66341d06a17806767f12a1fc4f55740a7af24c6b5022049dd3c9a85ac6c51fecd5f4baff7782a518781bbdd94453c8383755e24ba755c01410436d554adf4a3eb03a317c77aa4020a7bba62999df633bba0ea8f83f48b9e01b0861d3b3c796840f982ee6b14c3c4b7ad04fcfcc3774f81bff9aaf52a15751fedfdffffff02416c00000000000017a914bc791b2afdfe1e1b5650864a9297b20d74c61f4787d71d0000000000001976a9140a59837ccd4df25adc31cdad39be6a8d97557ed688ac00000000'],
          commonJS: ['0200000001fd5b5fcd1cb066c27cfc9fda5428b9be850b81ac440ea51f1ddba2f987189ac1010000008a4730440220686a40e9d2dbffeab4ca1ff66341d06a17806767f12a1fc4f55740a7af24c6b5022049dd3c9a85ac6c51fecd5f4baff7782a518781bbdd94453c8383755e24ba755c01410436d554adf4a3eb03a317c77aa4020a7bba62999df633bba0ea8f83f48b9e01b0861d3b3c796840f982ee6b14c3c4b7ad04fcfcc3774f81bff9aaf52a15751fedfdffffff02416c00000000000017a914bc791b2afdfe1e1b5650864a9297b20d74c61f4787d71d0000000000001976a9140a59837ccd4df25adc31cdad39be6a8d97557ed688ac00000000'],
          curl: ['0200000001fd5b5fcd1cb066c27cfc9fda5428b9be850b81ac440ea51f1ddba2f987189ac1010000008a4730440220686a40e9d2dbffeab4ca1ff66341d06a17806767f12a1fc4f55740a7af24c6b5022049dd3c9a85ac6c51fecd5f4baff7782a518781bbdd94453c8383755e24ba755c01410436d554adf4a3eb03a317c77aa4020a7bba62999df633bba0ea8f83f48b9e01b0861d3b3c796840f982ee6b14c3c4b7ad04fcfcc3774f81bff9aaf52a15751fedfdffffff02416c00000000000017a914bc791b2afdfe1e1b5650864a9297b20d74c61f4787d71d0000000000001976a9140a59837ccd4df25adc31cdad39be6a8d97557ed688ac00000000'],
          response: ``
        },
        codeSampleTestnet: {
          esModule: ['0200000001fd5b5fcd1cb066c27cfc9fda5428b9be850b81ac440ea51f1ddba2f987189ac1010000008a4730440220686a40e9d2dbffeab4ca1ff66341d06a17806767f12a1fc4f55740a7af24c6b5022049dd3c9a85ac6c51fecd5f4baff7782a518781bbdd94453c8383755e24ba755c01410436d554adf4a3eb03a317c77aa4020a7bba62999df633bba0ea8f83f48b9e01b0861d3b3c796840f982ee6b14c3c4b7ad04fcfcc3774f81bff9aaf52a15751fedfdffffff02416c00000000000017a914bc791b2afdfe1e1b5650864a9297b20d74c61f4787d71d0000000000001976a9140a59837ccd4df25adc31cdad39be6a8d97557ed688ac00000000'],
          commonJS: ['0200000001fd5b5fcd1cb066c27cfc9fda5428b9be850b81ac440ea51f1ddba2f987189ac1010000008a4730440220686a40e9d2dbffeab4ca1ff66341d06a17806767f12a1fc4f55740a7af24c6b5022049dd3c9a85ac6c51fecd5f4baff7782a518781bbdd94453c8383755e24ba755c01410436d554adf4a3eb03a317c77aa4020a7bba62999df633bba0ea8f83f48b9e01b0861d3b3c796840f982ee6b14c3c4b7ad04fcfcc3774f81bff9aaf52a15751fedfdffffff02416c00000000000017a914bc791b2afdfe1e1b5650864a9297b20d74c61f4787d71d0000000000001976a9140a59837ccd4df25adc31cdad39be6a8d97557ed688ac00000000'],
          curl: ['0200000001fd5b5fcd1cb066c27cfc9fda5428b9be850b81ac440ea51f1ddba2f987189ac1010000008a4730440220686a40e9d2dbffeab4ca1ff66341d06a17806767f12a1fc4f55740a7af24c6b5022049dd3c9a85ac6c51fecd5f4baff7782a518781bbdd94453c8383755e24ba755c01410436d554adf4a3eb03a317c77aa4020a7bba62999df633bba0ea8f83f48b9e01b0861d3b3c796840f982ee6b14c3c4b7ad04fcfcc3774f81bff9aaf52a15751fedfdffffff02416c00000000000017a914bc791b2afdfe1e1b5650864a9297b20d74c61f4787d71d0000000000001976a9140a59837ccd4df25adc31cdad39be6a8d97557ed688ac00000000'],
          response: ``
        },
        codeSampleSignet: {
          esModule: ['0200000001fd5b5fcd1cb066c27cfc9fda5428b9be850b81ac440ea51f1ddba2f987189ac1010000008a4730440220686a40e9d2dbffeab4ca1ff66341d06a17806767f12a1fc4f55740a7af24c6b5022049dd3c9a85ac6c51fecd5f4baff7782a518781bbdd94453c8383755e24ba755c01410436d554adf4a3eb03a317c77aa4020a7bba62999df633bba0ea8f83f48b9e01b0861d3b3c796840f982ee6b14c3c4b7ad04fcfcc3774f81bff9aaf52a15751fedfdffffff02416c00000000000017a914bc791b2afdfe1e1b5650864a9297b20d74c61f4787d71d0000000000001976a9140a59837ccd4df25adc31cdad39be6a8d97557ed688ac00000000'],
          commonJS: ['0200000001fd5b5fcd1cb066c27cfc9fda5428b9be850b81ac440ea51f1ddba2f987189ac1010000008a4730440220686a40e9d2dbffeab4ca1ff66341d06a17806767f12a1fc4f55740a7af24c6b5022049dd3c9a85ac6c51fecd5f4baff7782a518781bbdd94453c8383755e24ba755c01410436d554adf4a3eb03a317c77aa4020a7bba62999df633bba0ea8f83f48b9e01b0861d3b3c796840f982ee6b14c3c4b7ad04fcfcc3774f81bff9aaf52a15751fedfdffffff02416c00000000000017a914bc791b2afdfe1e1b5650864a9297b20d74c61f4787d71d0000000000001976a9140a59837ccd4df25adc31cdad39be6a8d97557ed688ac00000000'],
          curl: ['0200000001fd5b5fcd1cb066c27cfc9fda5428b9be850b81ac440ea51f1ddba2f987189ac1010000008a4730440220686a40e9d2dbffeab4ca1ff66341d06a17806767f12a1fc4f55740a7af24c6b5022049dd3c9a85ac6c51fecd5f4baff7782a518781bbdd94453c8383755e24ba755c01410436d554adf4a3eb03a317c77aa4020a7bba62999df633bba0ea8f83f48b9e01b0861d3b3c796840f982ee6b14c3c4b7ad04fcfcc3774f81bff9aaf52a15751fedfdffffff02416c00000000000017a914bc791b2afdfe1e1b5650864a9297b20d74c61f4787d71d0000000000001976a9140a59837ccd4df25adc31cdad39be6a8d97557ed688ac00000000'],
          response: ``
        },
        codeSampleLiquid: {
          esModule: [`0200000001fd5b5fcd1cb066c27cfc9fda5428b9be850b81ac440ea51f1ddba2f987189ac1010000008a4730440220686a40e9d2dbffeab4ca1ff66341d06a17806767f12a1fc4f55740a7af24c6b5022049dd3c9a85ac6c51fecd5f4baff7782a518781bbdd94453c8383755e24ba755c01410436d554adf4a3eb03a317c77aa4020a7bba62999df633bba0ea8f83f48b9e01b0861d3b3c796840f982ee6b14c3c4b7ad04fcfcc3774f81bff9aaf52a15751fedfdffffff02416c00000000000017a914bc791b2afdfe1e1b5650864a9297b20d74c61f4787d71d0000000000001976a9140a59837ccd4df25adc31cdad39be6a8d97557ed688ac00000000`],
          commonJS: [`0200000001fd5b5fcd1cb066c27cfc9fda5428b9be850b81ac440ea51f1ddba2f987189ac1010000008a4730440220686a40e9d2dbffeab4ca1ff66341d06a17806767f12a1fc4f55740a7af24c6b5022049dd3c9a85ac6c51fecd5f4baff7782a518781bbdd94453c8383755e24ba755c01410436d554adf4a3eb03a317c77aa4020a7bba62999df633bba0ea8f83f48b9e01b0861d3b3c796840f982ee6b14c3c4b7ad04fcfcc3774f81bff9aaf52a15751fedfdffffff02416c00000000000017a914bc791b2afdfe1e1b5650864a9297b20d74c61f4787d71d0000000000001976a9140a59837ccd4df25adc31cdad39be6a8d97557ed688ac00000000`],
          curl: [`0200000001fd5b5fcd1cb066c27cfc9fda5428b9be850b81ac440ea51f1ddba2f987189ac1010000008a4730440220686a40e9d2dbffeab4ca1ff66341d06a17806767f12a1fc4f55740a7af24c6b5022049dd3c9a85ac6c51fecd5f4baff7782a518781bbdd94453c8383755e24ba755c01410436d554adf4a3eb03a317c77aa4020a7bba62999df633bba0ea8f83f48b9e01b0861d3b3c796840f982ee6b14c3c4b7ad04fcfcc3774f81bff9aaf52a15751fedfdffffff02416c00000000000017a914bc791b2afdfe1e1b5650864a9297b20d74c61f4787d71d0000000000001976a9140a59837ccd4df25adc31cdad39be6a8d97557ed688ac00000000`],
          response: ``,
        },
        codeSampleLiquidTestnet: {
          esModule: [`0200000001fd5b5fcd1cb066c27cfc9fda5428b9be850b81ac440ea51f1ddba2f987189ac1010000008a4730440220686a40e9d2dbffeab4ca1ff66341d06a17806767f12a1fc4f55740a7af24c6b5022049dd3c9a85ac6c51fecd5f4baff7782a518781bbdd94453c8383755e24ba755c01410436d554adf4a3eb03a317c77aa4020a7bba62999df633bba0ea8f83f48b9e01b0861d3b3c796840f982ee6b14c3c4b7ad04fcfcc3774f81bff9aaf52a15751fedfdffffff02416c00000000000017a914bc791b2afdfe1e1b5650864a9297b20d74c61f4787d71d0000000000001976a9140a59837ccd4df25adc31cdad39be6a8d97557ed688ac00000000`],
          commonJS: [`0200000001fd5b5fcd1cb066c27cfc9fda5428b9be850b81ac440ea51f1ddba2f987189ac1010000008a4730440220686a40e9d2dbffeab4ca1ff66341d06a17806767f12a1fc4f55740a7af24c6b5022049dd3c9a85ac6c51fecd5f4baff7782a518781bbdd94453c8383755e24ba755c01410436d554adf4a3eb03a317c77aa4020a7bba62999df633bba0ea8f83f48b9e01b0861d3b3c796840f982ee6b14c3c4b7ad04fcfcc3774f81bff9aaf52a15751fedfdffffff02416c00000000000017a914bc791b2afdfe1e1b5650864a9297b20d74c61f4787d71d0000000000001976a9140a59837ccd4df25adc31cdad39be6a8d97557ed688ac00000000`],
          curl: [`0200000001fd5b5fcd1cb066c27cfc9fda5428b9be850b81ac440ea51f1ddba2f987189ac1010000008a4730440220686a40e9d2dbffeab4ca1ff66341d06a17806767f12a1fc4f55740a7af24c6b5022049dd3c9a85ac6c51fecd5f4baff7782a518781bbdd94453c8383755e24ba755c01410436d554adf4a3eb03a317c77aa4020a7bba62999df633bba0ea8f83f48b9e01b0861d3b3c796840f982ee6b14c3c4b7ad04fcfcc3774f81bff9aaf52a15751fedfdffffff02416c00000000000017a914bc791b2afdfe1e1b5650864a9297b20d74c61f4787d71d0000000000001976a9140a59837ccd4df25adc31cdad39be6a8d97557ed688ac00000000`],
          response: ``,
        },
      }
    }
  },
];

export const faqData = [
  {
    type: 'category',
    category: 'basics',
    fragment: 'basics',
    title: 'Basics',
    showConditions: bitcoinNetworks
  },
  {
    type: 'endpoint',
    category: 'basics',
    showConditions: bitcoinNetworks,
    fragment: 'what-is-a-mempool',
    title: 'What is a mempool?',
  },
  {
    type: 'endpoint',
    category: 'basics',
    showConditions: bitcoinNetworks,
    fragment: 'what-is-a-mempool-explorer',
    title: 'What is a mempool explorer?',
  },
  {
    type: 'endpoint',
    category: 'basics',
    showConditions: bitcoinNetworks,
    fragment: 'what-is-a-blockchain',
    title: 'What is a blockchain?',
  },
  {
    type: 'endpoint',
    category: 'basics',
    showConditions: bitcoinNetworks,
    fragment: 'what-is-a-block-explorer',
    title: 'What is a block explorer?',
  },
  {
    type: 'endpoint',
    category: 'basics',
    showConditions: bitcoinNetworks,
    fragment: 'what-is-mining',
    title: 'What is mining?',
  },
  {
    type: 'endpoint',
    category: 'basics',
    showConditions: bitcoinNetworks,
    fragment: 'what-are-mining-pools',
    title: 'What are mining pools?',
  },
  {
    type: 'endpoint',
    category: 'basics',
    showConditions: bitcoinNetworks,
    fragment: 'what-are-vb-wu',
    title: 'What are virtual bytes (vB) and weight units (WU)?',
  },
  {
    type: 'endpoint',
    category: 'basics',
    showConditions: bitcoinNetworks,
    fragment: 'what-is-svb',
    title: 'What is bits/vB?',
  },
  {
    type: 'category',
    category: 'help',
    fragment: 'help-stuck-transaction',
    title: 'Help! My transaction is stuck',
    showConditions: bitcoinNetworks
  },
  {
    type: 'endpoint',
    category: 'help',
    showConditions: bitcoinNetworks,
    fragment: 'why-is-transaction-stuck-in-mempool',
    title: 'Why isn\'t my transaction confirming?',
  },
  {
    type: 'endpoint',
    category: 'help',
    showConditions: bitcoinNetworks,
    fragment: 'how-to-get-transaction-confirmed-quickly',
    title: 'How can I get my transaction confirmed more quickly?',
  },
  {
    type: 'endpoint',
    category: 'help',
    showConditions: bitcoinNetworks,
    fragment: 'how-prevent-stuck-transaction',
    title: 'How can I prevent a transaction from getting stuck in the future?',
  },
  {
    type: 'category',
    category: 'using',
    fragment: 'using-this-website',
    title: 'Using this website',
    showConditions: bitcoinNetworks
  },
  {
    type: 'endpoint',
    category: 'how-to',
    showConditions: bitcoinNetworks,
    fragment: 'looking-up-transactions',
    title: 'How can I look up a transaction?',
  },
  {
    type: 'endpoint',
    category: 'how-to',
    showConditions: bitcoinNetworks,
    fragment: 'looking-up-addresses',
    title: 'How can I look up an address?',
  },
  {
    type: 'endpoint',
    category: 'how-to',
    showConditions: bitcoinNetworks,
    fragment: 'looking-up-blocks',
    title: 'How can I look up a block?',
  },
  {
    type: 'endpoint',
    category: 'how-to',
    showConditions: bitcoinNetworks,
    fragment: 'looking-up-fee-estimates',
    title: 'How can I look up fee estimates?',
  },
  {
    type: 'endpoint',
    category: 'how-to',
    showConditions: bitcoinNetworks,
    fragment: 'looking-up-historical-trends',
    title: 'How can I explore historical trends?',
  },
  {
    type: 'category',
    category: 'advanced',
    fragment: 'advanced',
    title: 'Advanced',
    showConditions: bitcoinNetworks
  },
  {
    type: 'endpoint',
    category: 'advanced',
    showConditions: bitcoinNetworks,
    fragment: 'what-is-full-mempool',
    title: 'What does it mean for the mempool to be "full"?',
  },
  {
    type: 'endpoint',
    category: 'advanced',
    showConditions: bitcoinNetworks,
    fragment: 'how-big-is-mempool-used-by-mempool-space',
    title: 'How big is the mempool used by this explorer?',
    options: { officialOnly: true },
  },
  {
    type: 'endpoint',
    category: 'advanced',
    showConditions: bitcoinNetworks,
    fragment: 'what-is-memory-usage',
    title: 'What is memory usage?',
  },
  {
    type: 'endpoint',
    category: 'advanced',
    showConditions: bitcoinNetworks,
    fragment: 'why-empty-blocks',
    title: 'Why are there empty blocks?',
  },
  {
    type: 'endpoint',
    category: 'advanced',
    showConditions: bitcoinNetworks,
    fragment: 'why-block-timestamps-dont-always-increase',
    title: 'Why don\'t block timestamps always increase?',
  },
  {
    type: 'endpoint',
    category: 'advanced',
    showConditions: bitcoinNetworks,
    fragment: 'why-dont-fee-ranges-match',
    title: 'Why doesn\'t the fee range shown for a block match the feerates of transactions within the block?',
  },
  {
    type: 'endpoint',
    category: 'advanced',
    showConditions: bitcoinNetworks,
    fragment: 'how-do-transaction-filters-work',
    title: 'How do transaction filters work?',
  },
  {
    type: 'endpoint',
    category: 'advanced',
    showConditions: bitcoinNetworks,
    fragment: 'what-are-sigops',
    title: 'What are sigops?',
  },
  {
    type: 'endpoint',
    category: 'advanced',
    showConditions: bitcoinNetworks,
    fragment: 'what-is-adjusted-vsize',
    title: 'What is adjusted vsize?',
  },
  {
    type: 'endpoint',
    category: 'advanced',
    showConditions: bitcoinNetworks,
    fragment: 'why-do-the-projected-block-fee-ranges-overlap',
    title: 'Why do the projected block fee ranges overlap?',
  },
  {
    type: 'category',
    category: 'self-hosting',
    fragment: 'self-hosting',
    title: 'Self-Hosting',
    showConditions: bitcoinNetworks
  },
  {
    type: 'endpoint',
    category: 'self-hosting',
    showConditions: bitcoinNetworks,
    fragment: 'who-runs-this-website',
    title: 'Who runs this website?',
  },
  {
    type: 'endpoint',
    category: 'self-hosting',
    showConditions: bitcoinNetworks,
    fragment: 'host-my-own-instance-server',
    title: 'How can I host an instance on my own server?',
  },
  {
    type: 'endpoint',
    category: 'self-hosting',
    showConditions: bitcoinNetworks,
    fragment: 'install-mempool-with-docker',
    title: 'Can I install this explorer using Docker?',
  },
  {
    type: 'endpoint',
    category: 'self-hosting',
    showConditions: bitcoinNetworks,
    fragment: 'address-lookup-issues',
    title: 'Why do I get an error for certain address lookups on my own instance?',
  }
];

export const electrumApiDocsData = [
  {
    type: 'category',
    category: 'server',
    fragment: 'server-methods',
    title: 'Server Methods',
    showConditions: bitcoinNetworks.concat(liquidNetworks)
  },
  {
    type: 'endpoint',
    category: 'server',
    fragment: 'server-version',
    title: 'server.version',
    description: {
      default: 'Returns the server version and protocol version.'
    },
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    requestExample: '{"jsonrpc":"2.0","id":1,"method":"server.version","params":[]}',
    responseExample: `{
  "jsonrpc": "2.0",
  "id": 1,
  "result": ["mempool-electrs v3.3.0", "1.4"]
}`
  },
  {
    type: 'endpoint',
    category: 'server',
    fragment: 'server-banner',
    title: 'server.banner',
    description: {
      default: 'Returns the server banner message.'
    },
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    requestExample: '{"jsonrpc":"2.0","id":1,"method":"server.banner","params":[]}',
    responseExample: `{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "Welcome to mempool-electrs 3.3.0"
}`
  },
  {
    type: 'endpoint',
    category: 'server',
    fragment: 'server-ping',
    title: 'server.ping',
    description: {
      default: 'A simple ping to check if the server is responsive.'
    },
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    requestExample: '{"jsonrpc":"2.0","id":1,"method":"server.ping","params":[]}',
    responseExample: `{
  "jsonrpc": "2.0",
  "id": 1,
  "result": null
}`
  },
  {
    type: 'category',
    category: 'blockchain',
    fragment: 'blockchain-methods',
    title: 'Blockchain Methods',
    showConditions: bitcoinNetworks.concat(liquidNetworks)
  },
  {
    type: 'endpoint',
    category: 'blockchain',
    fragment: 'blockchain-block-header',
    title: 'blockchain.block.header',
    description: {
      default: 'Returns the block header at a given height. Optionally includes a merkle proof if <code>cp_height</code> is specified.'
    },
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    requestExample: '{"jsonrpc":"2.0","id":1,"method":"blockchain.block.header","params":[500000]}',
    responseExample: `{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "000000201929eb850a74427d0440cf6b518308837566cd6d0662790000000000000000001f6231ed3de07345b607ec2a39b2d01bec2fe10dfb7f516ba4958a42691c95316d0a385a459600185599fc5c"
}`
  },
  {
    type: 'endpoint',
    category: 'blockchain',
    fragment: 'blockchain-block-headers',
    title: 'blockchain.block.headers',
    description: {
      default: 'Returns a range of block headers. Maximum of 2016 headers can be requested at once.'
    },
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    requestExample: '{"jsonrpc":"2.0","id":1,"method":"blockchain.block.headers","params":[500000, 3]}',
    responseExample: `{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "count": 3,
    "hex": "000000201929eb850a74427d0440cf6b518308837566cd6d0662790000000000000000001f6231ed3de07345b607ec2a39b2d01bec2fe10dfb7f516ba4958a42691c95316d0a385a459600185599fc5c00000020045d94a1c33354c3759cc0512dcc49fd81bf4c3637fb24000000000000000000d4ee4e4683ad039ad67465c39acd4d569037b592afce6a920949b5d0cacfdb560d0b385a4596001862682d4b00000020924eb7e8ded72ae19fa6de6ec94ef940866f21b359995c000000000000000000f2131f2ac82b701b1bbc27a2952f4bd1093220a952c3a84226a72bf250ec4380c00b385a45960018cc2de362",
    "max": 2016
  }
}`
  },
  {
    type: 'endpoint',
    category: 'blockchain',
    fragment: 'blockchain-headers-subscribe',
    title: 'blockchain.headers.subscribe',
    description: {
      default: 'Subscribe to new block headers. Returns the current best block header and sends notifications when new blocks are found.'
    },
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    requestExample: '{"jsonrpc":"2.0","id":1,"method":"blockchain.headers.subscribe","params":[]}',
    responseExample: `{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "height": 932110,
    "hex": "0080fc20e679a5ad18c5a262e5dc72709e025e0987ee461170f300000000000000000000436161d7868d22dbaf5b1ff8414edbdb059db796987f68fdc166f912e677a205272a6669f2eb0117008ec971"
  }
}`
  },
  {
    type: 'endpoint',
    category: 'blockchain',
    fragment: 'blockchain-estimatefee',
    title: 'blockchain.estimatefee',
    description: {
      default: 'Returns the estimated transaction fee for confirmation within a given number of blocks. Returns fee in QBT/kB, or -1 if estimation is not available.'
    },
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    requestExample: '{"jsonrpc":"2.0","id":1,"method":"blockchain.estimatefee","params":[6]}',
    responseExample: `{
  "jsonrpc": "2.0",
  "id": 1,
  "result": 0.00005000
}`
  },
  {
    type: 'endpoint',
    category: 'blockchain',
    fragment: 'blockchain-relayfee',
    title: 'blockchain.relayfee',
    description: {
      default: 'Returns the minimum relay fee for low-priority transactions in QBT/kB.'
    },
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    requestExample: '{"jsonrpc":"2.0","id":1,"method":"blockchain.relayfee","params":[]}',
    responseExample: `{
  "jsonrpc": "2.0",
  "id": 1,
  "result": 1e-6
}`
  },
  {
    type: 'category',
    category: 'scripthash',
    fragment: 'scripthash-methods',
    title: 'Script Hash Methods',
    showConditions: bitcoinNetworks.concat(liquidNetworks)
  },
  {
    type: 'endpoint',
    category: 'scripthash',
    fragment: 'blockchain-scripthash-get-balance',
    title: 'blockchain.scripthash.get_balance',
    description: {
      default: 'Returns the confirmed and unconfirmed balance for a script hash. Script hashes are the SHA256 hash of the output script (scriptPubKey), encoded as hexadecimal with the bytes reversed.<br><br><b>Not available on Liquid networks.</b>'
    },
    showConditions: bitcoinNetworks,
    requestExample: '{"jsonrpc":"2.0","id":1,"method":"blockchain.scripthash.get_balance","params":["740485f380ff6379d11ef6fe7d7cdd68aea7f8bd0d953d9fdf3531fb7d531833"]}',
    responseExample: `{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "confirmed": 5001009380,
    "unconfirmed": 0
  }
}`
  },
  {
    type: 'endpoint',
    category: 'scripthash',
    fragment: 'blockchain-scripthash-get-history',
    title: 'blockchain.scripthash.get_history',
    description: {
      default: 'Returns the transaction history for a script hash. Returns an array of objects containing transaction ID, height, and fee (for mempool transactions).'
    },
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    requestExample: '{"jsonrpc":"2.0","id":1,"method":"blockchain.scripthash.get_history","params":["740485f380ff6379d11ef6fe7d7cdd68aea7f8bd0d953d9fdf3531fb7d531833"]}',
    responseExample: `{
  "jsonrpc": "2.0",
  "id": 1,
  "result": [
    {
      "height": 0,
      "tx_hash": "4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b"
    },
    {
      "height": 172165,
      "tx_hash": "08901b81e39bc61d632c93241c44ec3763366bd57444b01494481ed46079c898"
    },
    {
      "height": 800570,
      "tx_hash": "b338282600dcb99fcf112159b2504e179d343691fc70d1882b3721d0a7664b5c"
    },
    {
      "height": 821323,
      "tx_hash": "f59c0ea559a4a22933ea2d71224002b5a60dcc885351ce67c58ba0bb0a53df49"
    },
    {
      "height": 821358,
      "tx_hash": "dfe1986a5392f7ffa82d95caac650dba064237871b8600c0a99ec86fd0f96443"
    },
    {
      "height": 844542,
      "tx_hash": "2cc7cd85d75b113fa8bf4d80aded938ab261bae8ce1b85afe066e84024276d9b"
    },
    {
      "height": 882493,
      "tx_hash": "85c5ffbe348a762b4eebd024fa7d166bf773fea1af5b37b485ab33e79f664dce"
    },
    {
      "height": 895701,
      "tx_hash": "8ee94a203a24490d8449c5c6e40c615200ed04d031172481738ad68717902355"
    },
    {
      "height": 895706,
      "tx_hash": "07a14d470d796f3407181f63f48a23756d9e63a10f31e709887aa871fda6b5e3"
    },
    {
      "height": 916656,
      "tx_hash": "bda4c8b2a99324f6b27bb7c9996ae942dee3fd3120cb72fddfe618914502012b"
    },
    {
      "height": 928418,
      "tx_hash": "edf0dc50de7065ec2cfcb223091746bacce2ba2c139bcd3a748fdeb18e3741b3"
    }
  ]
}`
  },
  {
    type: 'endpoint',
    category: 'scripthash',
    fragment: 'blockchain-scripthash-listunspent',
    title: 'blockchain.scripthash.listunspent',
    description: {
      default: 'Returns the list of unspent transaction outputs for a script hash.'
    },
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    requestExample: '{"jsonrpc":"2.0","id":1,"method":"blockchain.scripthash.listunspent","params":["740485f380ff6379d11ef6fe7d7cdd68aea7f8bd0d953d9fdf3531fb7d531833"]}',
    responseExample: `{
  "jsonrpc": "2.0",
  "id": 1,
  "result": [
    {
      "height": 821323,
      "tx_hash": "f59c0ea559a4a22933ea2d71224002b5a60dcc885351ce67c58ba0bb0a53df49",
      "tx_pos": 0,
      "value": 1337
    },
    {
      "height": 844542,
      "tx_hash": "2cc7cd85d75b113fa8bf4d80aded938ab261bae8ce1b85afe066e84024276d9b",
      "tx_pos": 0,
      "value": 1000
    },
    {
      "height": 916656,
      "tx_hash": "bda4c8b2a99324f6b27bb7c9996ae942dee3fd3120cb72fddfe618914502012b",
      "tx_pos": 0,
      "value": 777
    },
    {
      "height": 895701,
      "tx_hash": "8ee94a203a24490d8449c5c6e40c615200ed04d031172481738ad68717902355",
      "tx_pos": 0,
      "value": 777
    },
    {
      "height": 821358,
      "tx_hash": "dfe1986a5392f7ffa82d95caac650dba064237871b8600c0a99ec86fd0f96443",
      "tx_pos": 0,
      "value": 1031
    },
    {
      "height": 928418,
      "tx_hash": "edf0dc50de7065ec2cfcb223091746bacce2ba2c139bcd3a748fdeb18e3741b3",
      "tx_pos": 1,
      "value": 1000
    },
    {
      "height": 895706,
      "tx_hash": "07a14d470d796f3407181f63f48a23756d9e63a10f31e709887aa871fda6b5e3",
      "tx_pos": 1,
      "value": 777
    },
    {
      "height": 882493,
      "tx_hash": "85c5ffbe348a762b4eebd024fa7d166bf773fea1af5b37b485ab33e79f664dce",
      "tx_pos": 0,
      "value": 2009
    },
    {
      "height": 800570,
      "tx_hash": "b338282600dcb99fcf112159b2504e179d343691fc70d1882b3721d0a7664b5c",
      "tx_pos": 0,
      "value": 672
    },
    {
      "height": 172165,
      "tx_hash": "08901b81e39bc61d632c93241c44ec3763366bd57444b01494481ed46079c898",
      "tx_pos": 0,
      "value": 1000000
    },
    {
      "height": 0,
      "tx_hash": "4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b",
      "tx_pos": 0,
      "value": 5000000000
    }
  ]
}`
  },
  {
    type: 'endpoint',
    category: 'scripthash',
    fragment: 'blockchain-scripthash-subscribe',
    title: 'blockchain.scripthash.subscribe',
    description: {
      default: 'Subscribe to notifications for a script hash. Returns the current status hash and sends notifications when the history changes.'
    },
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    requestExample: '{"jsonrpc":"2.0","id":1,"method":"blockchain.scripthash.subscribe","params":["740485f380ff6379d11ef6fe7d7cdd68aea7f8bd0d953d9fdf3531fb7d531833"]}',
    responseExample: `{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "891ef581d38edb24d1750114c0bcf51ea4c1726b4ea9ae36932646f93a56c550"
}`
  },
  {
    type: 'endpoint',
    category: 'scripthash',
    fragment: 'blockchain-scripthash-unsubscribe',
    title: 'blockchain.scripthash.unsubscribe',
    description: {
      default: 'Unsubscribe from notifications for a script hash.'
    },
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    requestExample: '{"jsonrpc":"2.0","id":1,"method":"blockchain.scripthash.unsubscribe","params":["740485f380ff6379d11ef6fe7d7cdd68aea7f8bd0d953d9fdf3531fb7d531833"]}',
    responseExample: `{
  "jsonrpc": "2.0",
  "id": 1,
  "result": true
}`
  },
  {
    type: 'category',
    category: 'transaction',
    fragment: 'transaction-methods',
    title: 'Transaction Methods',
    showConditions: bitcoinNetworks.concat(liquidNetworks)
  },
  {
    type: 'endpoint',
    category: 'transaction',
    fragment: 'blockchain-transaction-broadcast',
    title: 'blockchain.transaction.broadcast',
    description: {
      default: 'Broadcast a raw transaction to the network. Returns the transaction ID on success.'
    },
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    requestExample: '{"jsonrpc":"2.0","id":1,"method":"blockchain.transaction.broadcast","params":["0200000001..."]}',
    responseExample: `{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "bbf3c490cf501e8485c5b43cd2e6263ba68c503b17db91db80a28a0cd4ec6391"
}`
  },
  {
    type: 'endpoint',
    category: 'transaction',
    fragment: 'blockchain-transaction-get',
    title: 'blockchain.transaction.get',
    description: {
      default: 'Returns a raw transaction by its transaction ID. Returns hex-encoded raw transaction.'
    },
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    requestExample: '{"jsonrpc":"2.0","id":1,"method":"blockchain.transaction.get","params":["bbf3c490cf501e8485c5b43cd2e6263ba68c503b17db91db80a28a0cd4ec6391"]}',
    responseExample: `{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "020000000001010000000000000000000000000000000000000000000000000000000000000000ffffffff5d0378380e049bc164692f466f756e6472792055534120506f6f6c202364726f70676f6c642ffabe6d6dd44f35d084e35ea9a357464d0c2510e43bb568a5b29ef898d3e7e8690c1f90b9010000000000000036491a5a7d13020000000000ffffffff04eb7ac612000000002200207086320071974eef5e72eaa01dd9096e10c0383483855ea6b344259c244f73c20000000000000000266a24aa21a9ed3384fdddc3722e862f962a0878460114bf4dc2430e6fd3205e9537da28b45d0600000000000000002f6a2d434f52450158d8efc838d2de558eedeabce631c7dff92c947ae6d18fda214e5b9f350ffc7b6cf3058b9026e76500000000000000002b6a2952534b424c4f434b3ae99adb1d2ac81cc7d3680512413dcae46d51a79f039615b4e3eff61000805db10120000000000000000000000000000000000000000000000000000000000000000000000000"
}`
  },
  {
    type: 'endpoint',
    category: 'transaction',
    fragment: 'blockchain-transaction-get-merkle',
    title: 'blockchain.transaction.get_merkle',
    description: {
      default: 'Returns the merkle proof for a transaction. Requires the transaction to be confirmed.'
    },
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    requestExample: '{"jsonrpc":"2.0","id":1,"method":"blockchain.transaction.get_merkle","params":["08901b81e39bc61d632c93241c44ec3763366bd57444b01494481ed46079c898", 172165]}',
    responseExample: `{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "block_height": 172165,
    "merkle": [
      "221057f51521fd35428760dcb60ad4a413778abfe0bde1e1eca8ecad3ff99aa8",
      "dc53cbc515d5577181ac2c0f7a2644b1ad65e54c820c9d92a57ee4c309216938",
      "bff85650005199e957d22721ef5b62c3c87baeca8a72e20436444511f2b897ef",
      "91c7603e7ec8c15f09b1aad2f41f7be0d951f7d8e148596d90123440748d2ba2",
      "16a0b5e409e6f0bffb25296f82cb250e504f66cdda8aedb35a11da33f6175bf8",
      "4222062909f5eacc0a97b7e12ecc24261e50c1c21c7c52391f3c1bc17570b086",
      "0f889caf2f4e3435e9a4a7334c9a323c032452159991a1a66908db722925e865"
    ],
    "pos": 28
  }
}`
  },
  {
    type: 'endpoint',
    category: 'transaction',
    fragment: 'blockchain-transaction-id-from-pos',
    title: 'blockchain.transaction.id_from_pos',
    description: {
      default: 'Returns the transaction ID at a given position in a block. Optionally includes the merkle proof.'
    },
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    requestExample: '{"jsonrpc":"2.0","id":1,"method":"blockchain.transaction.id_from_pos","params":[172165, 28, false]}',
    responseExample: `{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "08901b81e39bc61d632c93241c44ec3763366bd57444b01494481ed46079c898"
}`
  },
  {
    type: 'category',
    category: 'mempool',
    fragment: 'mempool-methods',
    title: 'Mempool Methods',
    showConditions: bitcoinNetworks.concat(liquidNetworks)
  },
  {
    type: 'endpoint',
    category: 'mempool',
    fragment: 'mempool-get-fee-histogram',
    title: 'mempool.get_fee_histogram',
    description: {
      default: 'Returns a histogram of transaction fees in the mempool. Each entry is a pair of [fee_rate, cumulative_vsize] where fee_rate is in bits per virtual byte.'
    },
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    requestExample: '{"jsonrpc":"2.0","id":1,"method":"mempool.get_fee_histogram","params":[]}',
    responseExample: `{
  "jsonrpc": "2.0",
  "id": 1,
  "result": [
    [10.0, 50000],
    [5.0, 150000],
    [2.0, 300000],
    [1.0, 500000]
  ]
}`
  }
];
