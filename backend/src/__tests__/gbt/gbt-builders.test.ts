// Runs the TypeScript block template builder (tx-selection-worker.ts) and the Rust one
// (rust/gbt, MEMPOOL.RUST_GBT) through MempoolBlocks on the same qbit mempools, and
// compares the projected blocks they produce.

jest.mock('worker_threads', () => {
  // Run tx-selection-worker.ts in this thread: Worker.postMessage reaches the handler the
  // worker registers on parentPort, and what the handler posts back becomes the Worker's
  // 'message' event.
  const { EventEmitter } = jest.requireActual('events');
  const parentPort: any = new EventEmitter();
  let worker: any;
  parentPort.postMessage = (message): void => { worker.emit('message', message); };
  class Worker extends EventEmitter {
    constructor() {
      super();
      worker = this;
      require('../../api/tx-selection-worker');
    }
    postMessage(message): void {
      parentPort.emit('message', message);
    }
  }
  return { Worker, parentPort };
});

import mempoolBlocks from '../../api/mempool-blocks';
import transactionUtils from '../../api/transaction-utils';
import { IEsploraApi } from '../../api/bitcoin/esplora-api.interface';
import { MempoolBlockWithTransactions, MempoolTransactionExtended } from '../../mempool.interfaces';

// P2MR spends from qbit mainnet: vsize equals weight and they have no sigops
const qbitStandardTransactions = require('../api/test-data/qbit-standard-txs.json');
const { etching, mint } = require('../api/test-data/qbit-p2mr-qscriptions.json');
const templates: IEsploraApi.Transaction[] = [qbitStandardTransactions[0], etching, mint];

type Mempool = { [txid: string]: MempoolTransactionExtended };

interface TxSpec {
  fee: number;
  weight?: number;
  sigops?: number;
  parents?: number[]; // indexes of earlier transactions this one spends
}

function seededRandom(seed: number): () => number {
  // mulberry32
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeMempool(specs: TxSpec[], seed = 1): Mempool {
  const random = seededRandom(seed);
  const txids = specs.map(() => Array.from({ length: 64 }, () => Math.floor(random() * 16).toString(16)).join(''));
  const mempool: Mempool = {};
  specs.forEach((spec, index) => {
    const template = templates[index % templates.length];
    const tx = JSON.parse(JSON.stringify(template));
    // keep only what Esplora returns, so the backend derives the vsize and fee rates itself
    for (const key of ['order', 'vsize', 'adjustedVsize', 'feePerVsize', 'adjustedFeePerVsize', 'effectiveFeePerVsize']) {
      delete tx[key];
    }
    tx.txid = txids[index];
    tx.size = tx.weight = spec.weight ?? template.weight;
    tx.fee = spec.fee;
    tx.sigops = spec.sigops ?? 0;
    tx.status = { confirmed: false };
    tx.vin = (spec.parents?.length ? spec.parents : [null]).map(parent => ({
      ...tx.vin[0],
      txid: parent === null ? tx.vin[0].txid : txids[parent],
      vout: 0,
    }));
    mempool[tx.txid] = transactionUtils.extendMempoolTransaction(tx);
  });
  return mempool;
}

// CPFP chains and some transactions with two in-mempool parents, at unique fee rates
function randomSpecs(count: number, seed: number): TxSpec[] {
  const random = seededRandom(seed);
  const specs: TxSpec[] = [];
  for (let index = 0; index < count; index++) {
    const weight = templates[index % templates.length].weight + Math.floor(random() * 200);
    const spec: TxSpec = { weight, fee: Math.round(weight * (1 + random() * 49)) };
    if (index > 2 && random() < 0.3) {
      spec.parents = [Math.floor(random() * index)];
      if (random() < 0.15) {
        const second = Math.floor(random() * index);
        if (second !== spec.parents[0]) {
          spec.parents.push(second);
        }
      }
    }
    specs.push(spec);
  }
  return specs;
}

// Fee statistics add up rates in block order, and the builders order a package's
// transactions differently, so compare them to 9 decimal places.
const round = (rate: number): number => Math.round(rate * 1e9) / 1e9;

function summarize(blocks: MempoolBlockWithTransactions[], mempool: Mempool) {
  return {
    blocks: blocks.map((block, index) => ({
      txids: [...block.transactionIds].sort(),
      blockSize: block.blockSize,
      blockVSize: block.blockVSize,
      nTx: block.nTx,
      totalFees: block.totalFees,
      // The eighth block stacks the rest of the mempool. MempoolBlocks sizes its fee statistics
      // by the Rust builder's block weight, which counts the 4,000 WU reserved for the coinbase,
      // but by the transactions' weight for the TypeScript builder.
      ...(index < 7 ? { medianFee: round(block.medianFee), feeRange: block.feeRange.map(round) } : {}),
    })),
    rates: Object.fromEntries(Object.values(mempool).map(tx => [tx.txid, tx.effectiveFeePerVsize])),
    clusters: Object.fromEntries(Object.values(mempool).map(tx => [
      tx.txid,
      [...(tx.ancestors || []), ...(tx.descendants || [])].map(relative => relative.txid).sort(),
    ])),
  };
}

async function buildWithBoth(mempool: Mempool) {
  const txids = Object.keys(mempool);
  const typescriptMempool: Mempool = JSON.parse(JSON.stringify(mempool));
  const rustMempool: Mempool = JSON.parse(JSON.stringify(mempool));
  const typescriptBlocks = await mempoolBlocks.$makeBlockTemplates(txids, typescriptMempool, undefined, true, false);
  // start from an empty Rust mempool, as the backend does before a full rebuild
  (mempoolBlocks as any).resetRustGbt();
  const rustBlocks = await mempoolBlocks.$rustMakeBlockTemplates(txids, rustMempool, undefined, true, false);
  return {
    typescript: summarize(typescriptBlocks, typescriptMempool),
    rust: summarize(rustBlocks, rustMempool),
  };
}

describe('Rust and TypeScript block template builders', () => {
  test('rate qbit P2MR transactions by weight', async () => {
    // 1 sat per weight unit is 1 sat/vB when vsize equals weight
    const mempool = makeMempool(Array.from({ length: 30 }, (_, index) => {
      const weight = templates[index % templates.length].weight;
      return { weight, fee: weight };
    }));
    const { typescript, rust } = await buildWithBoth(mempool);

    for (const result of [typescript, rust]) {
      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].feeRange).toStrictEqual(Array(7).fill(1));
      expect(Object.values(result.rates)).toStrictEqual(Array(30).fill(1));
    }
    expect(rust).toStrictEqual(typescript);
  });

  test('agree on CPFP packages', async () => {
    const mempool = makeMempool([
      { fee: 800 },
      { fee: 30_000, parents: [0] },
      { fee: 4_000, parents: [1] },
      { fee: 9_000 },
      { fee: 20_000, parents: [3, 0] },
    ]);
    const { typescript, rust } = await buildWithBoth(mempool);
    const [parent, child] = Object.keys(mempool);

    // the child pays for its parent: 30,800 sats over 779 + 4,431 WU
    expect(typescript.rates[parent]).toBe(30_800 / 5_210);
    expect(typescript.rates[child]).toBe(30_800 / 5_210);
    expect(typescript.clusters[parent]).toStrictEqual([child]);
    expect(rust).toStrictEqual(typescript);
  });

  test('agree at the 2,000,000 WU block limit', async () => {
    // with 4,000 WU reserved, 499 transactions of 3,992 WU fit and the 500th would reach the limit
    const mempool = makeMempool(Array.from({ length: 500 }, (_, index) => ({ weight: 3_992, fee: 100_000 - index })));
    const { typescript, rust } = await buildWithBoth(mempool);

    expect(typescript.blocks.map(block => block.nTx)).toStrictEqual([499, 1]);
    expect(rust).toStrictEqual(typescript);
  });

  test('agree on giving up a block once more than 1,000 packages fail', async () => {
    // 1,995,000 WU used is not within 4,000 WU of full, so the last small transaction still fits
    const mempool = makeMempool([
      ...Array.from({ length: 4 }, () => ({ weight: 400_000, fee: 4_000_000 })),
      { weight: 391_000, fee: 3_910_000 },
      ...Array.from({ length: 1_002 }, (_, index) => ({ weight: 10_000, fee: 20_000 - index })),
      { weight: 1_000, fee: 1_000 },
    ]);
    const { typescript, rust } = await buildWithBoth(mempool);

    expect(typescript.blocks[0].nTx).toBe(6);
    expect(rust).toStrictEqual(typescript);
  });

  test('agree on sigop-adjusted transactions', async () => {
    // 100 sigops cost 2,000 WU, more than either transaction weighs
    const mempool = makeMempool([
      { weight: 1_000, sigops: 100, fee: 6_000 },
      { weight: 1_000, sigops: 100, fee: 9_000, parents: [0] },
      { weight: 4_000, fee: 9_000 },
    ]);
    const { typescript, rust } = await buildWithBoth(mempool);

    expect(typescript.rates[Object.keys(mempool)[0]]).toBe(15_000 / 4_000);
    expect(rust).toStrictEqual(typescript);
  });

  test.each([
    ['a mempool smaller than one block', 150, 7],
    ['a mempool that fills eight blocks', 6_000, 8],
  ])('agree on %s', async (_, count, seed) => {
    const mempool = makeMempool(randomSpecs(count, seed), seed);
    const { typescript, rust } = await buildWithBoth(mempool);

    expect(rust.blocks.map(block => block.txids)).toStrictEqual(typescript.blocks.map(block => block.txids));
    expect(rust.rates).toStrictEqual(typescript.rates);
    expect(rust.clusters).toStrictEqual(typescript.clusters);
    expect(rust).toStrictEqual(typescript);
    if (count > 1_000) {
      expect(rust.blocks).toHaveLength(8);
    }
  });

  // Upstream differences that have nothing to do with qbit's weights. In both, the Rust
  // builder does what qbit's BlockAssembler does.
  describe('known differences', () => {
    test('a child that pays less than its ancestors waits for them in Rust', async () => {
      // CompareTxMemPoolEntryByAncestorFee ranks a transaction by the lower of its own and its
      // ancestors' feerate; the TypeScript builder ranks it by the ancestors' feerate only
      const mempool = makeMempool([
        { weight: 10_000, fee: 10_000 },
        { weight: 1_000, fee: 50_000, parents: [0] },
        { weight: 1_000, fee: 50_000, parents: [0] },
        { weight: 1_000, fee: 5_000, parents: [1, 2] },
      ]);
      const { typescript, rust } = await buildWithBoth(mempool);

      expect(Object.values(typescript.rates)).toStrictEqual(Array(4).fill(115_000 / 13_000));
      expect(Object.values(rust.rates)).toStrictEqual([60_000 / 11_000, 60_000 / 11_000, 60_000 / 11_000, 5]);
    });

    test('only Rust caps a block at 80,000 sigops', async () => {
      // MAX_BLOCK_SIGOPS_COST, with 400 reserved for the coinbase; the TypeScript builder
      // checks each package against the limit but never adds up the block's sigops
      const mempool = makeMempool(Array.from({ length: 5 }, (_, index) => ({ weight: 320_000, sigops: 16_000, fee: 1_000_000 - index })));
      const { typescript, rust } = await buildWithBoth(mempool);

      expect(typescript.blocks.map(block => block.nTx)).toStrictEqual([5]);
      expect(rust.blocks.map(block => block.nTx)).toStrictEqual([4, 1]);
    });
  });
});
