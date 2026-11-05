const mockAxiosGet = jest.fn();
const mockDbQuery = jest.fn();
const mockSetMiningPools = jest.fn();
const mockMigratePoolsJson = jest.fn();
const mockLoggerWarn = jest.fn();
const mockLoggerErr = jest.fn();

const actualFs = jest.requireActual('fs');
let vendoredPoolsJson: any = { pools: [] };
let vendoredFileExists = true;

function mockUpdaterModules(poolsUrl: string, treeUrl: string): void {
  jest.doMock('axios', () => ({
    __esModule: true,
    default: {
      get: mockAxiosGet,
    },
  }));

  jest.doMock('../../api/pools-parser', () => ({
    __esModule: true,
    default: {
      setMiningPools: mockSetMiningPools,
      migratePoolsJson: mockMigratePoolsJson,
    },
  }));

  jest.doMock('../../config', () => ({
    __esModule: true,
    default: {
      DATABASE: {
        ENABLED: true,
      },
      MEMPOOL: {
        ENABLED: true,
        NETWORK: 'testnet4',
        POOLS_JSON_URL: poolsUrl,
        POOLS_JSON_TREE_URL: treeUrl,
        POOLS_UPDATE_DELAY: 0,
        AUTOMATIC_POOLS_UPDATE: false,
        USER_AGENT: 'mempool',
        EXTERNAL_MAX_RETRY: 1,
        EXTERNAL_RETRY_INTERVAL: 0,
      },
      SOCKS5PROXY: {
        ENABLED: false,
      },
    },
  }));

  jest.doMock('../../database', () => ({
    __esModule: true,
    default: {
      query: mockDbQuery,
    },
  }));

  jest.doMock('../../api/backend-info', () => ({
    __esModule: true,
    default: {
      getBackendInfo: jest.fn(() => ({ version: 'test' })),
    },
  }));

  jest.doMock('../../api/common', () => ({
    __esModule: true,
    Common: {
      sleep$: jest.fn(),
    },
  }));

  jest.doMock('../../logger', () => ({
    __esModule: true,
    default: {
      debug: jest.fn(),
      err: mockLoggerErr,
      info: jest.fn(),
      warn: mockLoggerWarn,
    },
  }));

  // Serve a controlled pools-qbit.json so tests do not depend on the real
  // vendored file content; everything else falls through to the real fs.
  jest.doMock('fs', () => ({
    __esModule: true,
    ...actualFs,
    existsSync: jest.fn((filePath: any) =>
      filePath.toString().endsWith('pools-qbit.json') ? vendoredFileExists : actualFs.existsSync(filePath)),
    readFileSync: jest.fn((filePath: any, options: any) =>
      filePath.toString().endsWith('pools-qbit.json') ? JSON.stringify(vendoredPoolsJson) : actualFs.readFileSync(filePath, options)),
  }));
}

describe('PoolsUpdater qbit vendored pool source', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    vendoredPoolsJson = { pools: [] };
    vendoredFileExists = true;
    mockMigratePoolsJson.mockResolvedValue(undefined);
    mockDbQuery.mockImplementation(async (sql: string) => {
      if (sql.startsWith('SELECT string')) {
        return [[{ string: 'legacy-bitcoin-sha' }]];
      }
      return [[], []];
    });
  });

  test('treats legacy Bitcoin pool URLs as disabled qbit pool source', async () => {
    mockUpdaterModules(
      'https://raw.githubusercontent.com/mempool/mining-pools/master/pools-v2.json',
      'https://api.github.com/repos/mempool/mining-pools/git/trees/master'
    );
    const { default: poolsUpdater, computeQbitPoolsSha } = await import('../../tasks/pools-updater');
    const expectedSha = computeQbitPoolsSha(vendoredPoolsJson);

    await poolsUpdater.updatePoolsJson();

    expect(mockAxiosGet).not.toHaveBeenCalled();
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('Legacy Bitcoin mining-pools URL configured'),
      'PoolsUpdater'
    );
    expect(mockSetMiningPools).toHaveBeenCalledWith({ pools: [] });
    expect(mockMigratePoolsJson).toHaveBeenCalledWith(expectedSha);
    expect(poolsUpdater.currentSha).toBe(expectedSha);
  });

  test('reloads vendored qbit pool source when DB marker is already current', async () => {
    vendoredPoolsJson = {
      pools: [
        { id: 1, name: 'Prism Pool', link: 'https://www.prismpool.io/', addresses: [], tags: ['/PRISM Pool/'] },
      ],
    };
    mockUpdaterModules('', '');
    const { default: poolsUpdater, computeQbitPoolsSha } = await import('../../tasks/pools-updater');
    const expectedSha = computeQbitPoolsSha(vendoredPoolsJson);
    mockDbQuery.mockImplementation(async (sql: string) => {
      if (sql.startsWith('SELECT string')) {
        return [[{ string: expectedSha }]];
      }
      return [[], []];
    });

    await poolsUpdater.updatePoolsJson();

    expect(mockSetMiningPools).toHaveBeenCalledWith(vendoredPoolsJson);
    expect(mockMigratePoolsJson).not.toHaveBeenCalled();
    expect(mockDbQuery).not.toHaveBeenCalledWith('START TRANSACTION;');
    expect(poolsUpdater.currentSha).toBe(expectedSha);
  });

  test('re-imports when the vendored pool set content changes', async () => {
    vendoredPoolsJson = {
      pools: [
        { id: 1, name: 'Prism Pool', link: 'https://www.prismpool.io/', addresses: [], tags: ['/PRISM Pool/'] },
      ],
    };
    mockUpdaterModules('', '');
    const { default: poolsUpdater, computeQbitPoolsSha } = await import('../../tasks/pools-updater');
    const staleSha = computeQbitPoolsSha({ pools: [] });
    const expectedSha = computeQbitPoolsSha(vendoredPoolsJson);
    mockDbQuery.mockImplementation(async (sql: string) => {
      if (sql.startsWith('SELECT string')) {
        return [[{ string: staleSha }]];
      }
      return [[], []];
    });

    await poolsUpdater.updatePoolsJson();

    expect(expectedSha).not.toBe(staleSha);
    expect(mockSetMiningPools).toHaveBeenCalledWith(vendoredPoolsJson);
    expect(mockMigratePoolsJson).toHaveBeenCalledWith(expectedSha);
    expect(mockDbQuery).toHaveBeenCalledWith('COMMIT;');
    expect(poolsUpdater.currentSha).toBe(expectedSha);
  });

  test('fails loudly instead of importing an empty set when pools-qbit.json is missing', async () => {
    vendoredFileExists = false;
    mockUpdaterModules('', '');
    const { default: poolsUpdater } = await import('../../tasks/pools-updater');

    await poolsUpdater.updatePoolsJson();

    expect(mockSetMiningPools).not.toHaveBeenCalled();
    expect(mockMigratePoolsJson).not.toHaveBeenCalled();
    expect(mockDbQuery).not.toHaveBeenCalledWith('START TRANSACTION;');
    expect(mockLoggerErr).toHaveBeenCalledWith(
      expect.stringContaining('PoolsUpdater failed'),
      'PoolsUpdater'
    );
    // the sha loaded from the db must be cleared so the startup guard in
    // index.ts aborts instead of running without loadable pool definitions
    expect(poolsUpdater.currentSha).toBeNull();
  });

  test('clears currentSha when vendored qbit import fails before commit', async () => {
    mockMigratePoolsJson.mockRejectedValue(new Error('migration failed'));
    mockUpdaterModules('', '');
    const { default: poolsUpdater } = await import('../../tasks/pools-updater');

    await poolsUpdater.updatePoolsJson();

    expect(mockDbQuery).toHaveBeenCalledWith('ROLLBACK;');
    expect(mockDbQuery).not.toHaveBeenCalledWith('COMMIT;');
    // the definition marker is written after the migration, so a failed
    // import must never have touched it
    expect(mockDbQuery).not.toHaveBeenCalledWith('DELETE FROM state where name="pools_json_sha"');
    expect(poolsUpdater.currentSha).toBeNull();
    expect(mockLoggerErr).toHaveBeenCalledWith(
      expect.stringContaining('Could not migrate mining pools'),
      'PoolsUpdater'
    );
  });
});
