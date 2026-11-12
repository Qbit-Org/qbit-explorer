const mockDbQuery = jest.fn();
const mockAtomicQuery = jest.fn();

jest.mock('../../database', () => ({
  __esModule: true,
  default: {
    query: mockDbQuery,
    $atomicQuery: mockAtomicQuery,
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

import cpfpRepository from '../../repositories/CpfpRepository';
import transactionRepository from '../../repositories/TransactionRepository';

const txid = (fill: string): string => fill.repeat(64);
const ancestor = (fill: string): { txid: string, weight: number, fee: number } => ({ txid: txid(fill), weight: 400, fee: 1000 });
const statements = (): unknown[][] => mockDbQuery.mock.calls.map(([sql, params]) => [String(sql).replace(/\s+/g, ' ').trim(), params]);

// the two CPFP tables, as the statements CpfpRepository and
// TransactionRepository send change and read them
const clusterRows = new Map<string, { height: number, txs: Buffer, fee_rate: number }>();
const mappings = new Map<string, string>();
const hex = (value: unknown): string => Buffer.isBuffer(value) ? value.toString('hex') : String(value).toLowerCase();
const clusterRow = (root: string): object => ({ root: Buffer.from(root, 'hex'), ...clusterRows.get(root) });
const runStatement = async (sql: string, params: any[] = []): Promise<unknown> => {
  const statement = sql.replace(/\s+/g, ' ').trim();
  if (statement.startsWith('SELECT * FROM compact_cpfp_clusters WHERE root = UNHEX(?)')) {
    return [clusterRows.has(hex(params[0])) ? [clusterRow(hex(params[0]))] : []];
  }
  if (statement.startsWith('SELECT txs, height, root from compact_cpfp_clusters WHERE height = ?')) {
    return [[...clusterRows.keys()].filter(root => clusterRows.get(root)?.height === params[0]).map(clusterRow)];
  }
  if (statement.startsWith('SELECT HEX(txid) as id, HEX(cluster) as root FROM compact_transactions WHERE txid = UNHEX(?)')) {
    const root = mappings.get(hex(params[0]));
    return [root ? [{ id: hex(params[0]).toUpperCase(), root: root.toUpperCase() }] : []];
  }
  if (statement.startsWith('DELETE FROM compact_transactions WHERE txid = UNHEX(?) AND cluster =')) {
    if (mappings.get(hex(params[0])) === hex(params[1])) {
      mappings.delete(hex(params[0]));
    }
  } else if (statement.startsWith('DELETE from compact_cpfp_clusters WHERE height = ?')) {
    for (const [root, row] of clusterRows) {
      if (row.height === params[0]) {
        clusterRows.delete(root);
      }
    }
  } else if (statement.startsWith('UPDATE compact_cpfp_clusters SET height = ?, txs = ?, fee_rate = ? WHERE root = UNHEX(?)')) {
    if (clusterRows.has(hex(params[3]))) {
      clusterRows.set(hex(params[3]), { height: params[0], txs: params[1], fee_rate: params[2] });
    }
  } else if (statement.startsWith('INSERT INTO compact_transactions')) {
    mappings.set(hex(params[0]), hex(params[1]));
  } else if (statement.startsWith('INSERT IGNORE INTO compact_cpfp_clusters')) {
    for (let i = 0; i < params.length; i += 4) {
      if (!clusterRows.has(hex(params[i]))) {
        clusterRows.set(hex(params[i]), { height: params[i + 1], txs: params[i + 2], fee_rate: params[i + 3] });
      }
    }
  } else if (statement.startsWith('INSERT IGNORE INTO compact_transactions')) {
    for (let i = 0; i < params.length; i += 2) {
      if (!mappings.has(hex(params[i]))) {
        mappings.set(hex(params[i]), hex(params[i + 1]));
      }
    }
  } else {
    throw new Error(`unexpected statement: ${statement}`);
  }
  return [{ affectedRows: 1 }];
};

describe('CpfpRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // c and a's cluster at 100, root c
  const root = Buffer.from(txid('c'), 'hex');
  const mockClusterAt100 = (): void => {
    mockDbQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT')) {
        return [[{ txs: Buffer.from(cpfpRepository.pack([ancestor('c'), ancestor('a')])), height: 100, root }]];
      }
      return [{ affectedRows: 1 }];
    });
  };

  test('$deleteClustersAt deletes every mapping of the transactions in its clusters, as upstream does', async () => {
    mockClusterAt100();

    await cpfpRepository.$deleteClustersAt(100);

    expect(statements().slice(1)).toEqual([
      ['DELETE FROM compact_transactions WHERE txid = UNHEX(?)', [txid('c')]],
      ['DELETE FROM compact_transactions WHERE txid = UNHEX(?)', [txid('a')]],
      ['DELETE from compact_cpfp_clusters WHERE height = ?', [100]],
    ]);
  });

  test('$deleteClustersAtKeepingMovedTxs deletes a transaction\'s mapping only while it maps to a cluster it deletes', async () => {
    // a block higher up that holds c and a now can map them to its own
    // cluster, which has to stay
    mockClusterAt100();

    await cpfpRepository.$deleteClustersAtKeepingMovedTxs(100);

    expect(statements().slice(1)).toEqual([
      ['DELETE FROM compact_transactions WHERE txid = UNHEX(?) AND cluster = ?', [txid('c'), root]],
      ['DELETE FROM compact_transactions WHERE txid = UNHEX(?) AND cluster = ?', [txid('a'), root]],
      ['DELETE from compact_cpfp_clusters WHERE height = ?', [100]],
    ]);
  });

  test('$moveCluster saves a block\'s cluster over the row with its root, and unmaps the members it drops', async () => {
    // the row with root c holds c, a, b and d, from a cluster at 100. 101's
    // cluster with root c holds only c and a: b and d are unmapped while
    // they map to c, and c and a are mapped to it.
    mockDbQuery.mockImplementation(async (sql: string) => sql.includes('SELECT')
      ? [[{ root: Buffer.from(txid('c'), 'hex'), height: 100, txs: Buffer.from(cpfpRepository.pack([ancestor('c'), ancestor('a'), ancestor('b'), ancestor('d')])), fee_rate: 5 }]]
      : [{ affectedRows: 1 }]);
    const cluster = { root: txid('c'), height: 101, txs: [ancestor('c'), ancestor('a')], effectiveFeePerVsize: 5 };

    await cpfpRepository.$moveCluster(cluster, [txid('c'), txid('a')]);

    const unmap = 'DELETE FROM compact_transactions WHERE txid = UNHEX(?) AND cluster = UNHEX(?)';
    const upsert = 'INSERT INTO compact_transactions ( txid, cluster ) VALUE (UNHEX(?), UNHEX(?)) ON DUPLICATE KEY UPDATE cluster = UNHEX(?) ;';
    expect(statements()).toEqual([
      ['SELECT * FROM compact_cpfp_clusters WHERE root = UNHEX(?)', [txid('c')]],
      [unmap, [txid('b'), txid('c')]],
      [unmap, [txid('d'), txid('c')]],
      ['UPDATE compact_cpfp_clusters SET height = ?, txs = ?, fee_rate = ? WHERE root = UNHEX(?)', [101, Buffer.from(cpfpRepository.pack(cluster.txs)), 5, txid('c')]],
      [upsert, [txid('c'), txid('c'), txid('c')]],
      [upsert, [txid('a'), txid('c'), txid('c')]],
    ]);
  });

  test('a member a moved cluster drops is mapped to its own block\'s cluster once that is saved, not to the moved one', async () => {
    // As the chain check repairs 100: c and a were mined again at 101 in a
    // cluster with root c, b stays in the block now at 100, in its cluster
    // with root e, and no block holds d. Saving 100's clusters inserts
    // mappings only for transactions that have none.
    clusterRows.clear();
    mappings.clear();
    clusterRows.set(txid('c'), { height: 100, txs: Buffer.from(cpfpRepository.pack([ancestor('c'), ancestor('a'), ancestor('b'), ancestor('d')])), fee_rate: 5 });
    for (const fill of ['c', 'a', 'b', 'd']) {
      mappings.set(txid(fill), txid('c'));
    }
    mockDbQuery.mockImplementation(runStatement);
    mockAtomicQuery.mockImplementation(async (queries: { query: string, params: any[] }[]) => {
      for (const { query, params } of queries) {
        await runStatement(query, params);
      }
    });
    const clusterAt100 = { root: txid('e'), height: 100, txs: [{ txid: txid('e'), weight: 400, fee: 4000 }, { txid: txid('b'), weight: 400, fee: 400 }], effectiveFeePerVsize: 5.5 };

    await cpfpRepository.$moveCluster({ root: txid('c'), height: 101, txs: [ancestor('c'), ancestor('a')], effectiveFeePerVsize: 5 }, [txid('c'), txid('a')]);
    await cpfpRepository.$deleteClustersAtKeepingMovedTxs(100);
    await cpfpRepository.$batchSaveClusters([clusterAt100]);

    expect(mappings.get(txid('b'))).toBe(txid('e'));
    expect(mappings.has(txid('d'))).toBe(false);
    expect(mappings.get(txid('a'))).toBe(txid('c'));
    expect(await transactionRepository.$getCpfpInfo(txid('b'))).toEqual({
      descendants: [clusterAt100.txs[0]],
      ancestors: [],
      effectiveFeePerVsize: 5.5,
    });
  });
});
