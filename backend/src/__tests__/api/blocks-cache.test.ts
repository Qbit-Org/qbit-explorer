const mockSaveCacheToDisk = jest.fn();
const mockUpdateBlocks = jest.fn();

jest.mock('../../api/disk-cache', () => ({
  __esModule: true,
  default: {
    $saveCacheToDisk: mockSaveCacheToDisk,
  },
}));

jest.mock('../../api/redis-cache', () => ({
  __esModule: true,
  default: {
    $updateBlocks: mockUpdateBlocks,
  },
}));

// Keep this focused cache test from starting the pool updater and Rust GBT
// garbage-collection timers pulled in by Blocks' production dependency graph.
jest.mock('../../repositories/PoolsRepository', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../../api/websocket-handler', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../../api/backend-info', () => ({
  __esModule: true,
  default: {},
}));

import blocks from '../../api/blocks';
import { LUXOR_BLOCK_4214_HEADER } from '../fixtures/qbit-auxpow-headers';

describe('Blocks tip-cache refresh', () => {
  const blockHash = '196368e129d102606180225fe67baee0ede4f82fc192e0f71f3305ac0c36a9bf';
  const unknownPool = { id: 0, name: 'Unknown', slug: 'unknown', minerNames: null };
  const luxorPool = { id: 2, name: 'Luxor', slug: 'luxor', minerNames: null };

  const blockWith = (header: string, pool: typeof unknownPool): any => ({
    id: blockHash,
    extras: {
      header,
      pool: { ...pool },
      auxpow: null,
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    blocks.setBlocks([]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('propagates a known qbit-side pool while keeping the fuller cached header', async () => {
    const cachedBlock = blockWith(LUXOR_BLOCK_4214_HEADER, unknownPool);
    const databaseBlock = blockWith(LUXOR_BLOCK_4214_HEADER.slice(0, 160), luxorPool);
    blocks.setBlocks([cachedBlock]);
    jest.spyOn(blocks, '$indexBlock').mockResolvedValue(databaseBlock);

    await blocks.$refreshCachedBlocks();

    expect(cachedBlock.extras.pool).toEqual(luxorPool);
    expect(cachedBlock.extras.header).toBe(LUXOR_BLOCK_4214_HEADER);
    expect(cachedBlock.extras.auxpow?.parentBlockHash).toBe('00000000000000000001c942edeed03c29f5f524c2b1e141ed4adf63a8ecf5e0');
  });

  test('does not downgrade a known cached pool from a truncated Unknown row', async () => {
    const cachedBlock = blockWith(LUXOR_BLOCK_4214_HEADER, luxorPool);
    const databaseBlock = blockWith(LUXOR_BLOCK_4214_HEADER.slice(0, 160), unknownPool);
    blocks.setBlocks([cachedBlock]);
    jest.spyOn(blocks, '$indexBlock').mockResolvedValue(databaseBlock);

    await blocks.$refreshCachedBlocks();

    expect(cachedBlock.extras.pool).toEqual(luxorPool);
    expect(cachedBlock.extras.header).toBe(LUXOR_BLOCK_4214_HEADER);
    expect(mockSaveCacheToDisk).toHaveBeenCalledTimes(1);
    expect(mockUpdateBlocks).toHaveBeenCalledWith([cachedBlock]);
  });
});
