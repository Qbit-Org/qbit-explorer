const mockDbQuery = jest.fn();

jest.mock('../../database', () => ({
  __esModule: true,
  default: {
    query: mockDbQuery,
  },
}));

import config from '../../config';
import { Common } from '../../api/common';
import BlocksRepository from '../../repositories/BlocksRepository';

// The queries behind the Block Fees, Block Fees Vs Subsidy and Block Rewards graphs
describe('BlocksRepository fee and reward history', () => {
  const network = config.MEMPOOL.NETWORK;
  const fiatPrice = config.FIAT_PRICE.ENABLED;
  const history: [string, () => Promise<unknown>, string][] = [
    ['fees', () => BlocksRepository.$getHistoricalBlockFees(600, '1 WEEK'), 'avgFees'],
    ['rewards', () => BlocksRepository.$getHistoricalBlockRewards(600, '1 WEEK'), 'avgRewards'],
  ];

  beforeEach(() => {
    // qbit mainnet keeps upstream's defaults, under which upstream links blocks to prices
    config.MEMPOOL.NETWORK = 'mainnet';
    config.FIAT_PRICE.ENABLED = true;
    mockDbQuery.mockReset();
    mockDbQuery.mockResolvedValue([[]]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    config.MEMPOOL.NETWORK = network;
    config.FIAT_PRICE.ENABLED = fiatPrice;
  });

  test('does not index block prices, since qbit has no QBT price feed', () => {
    expect(Common.blockPricesIndexingEnabled()).toBe(false);
  });

  test.each(history)('averages block %s without requiring a price', async (_, query, column) => {
    await query();

    const sql: string = mockDbQuery.mock.calls[0][0];
    expect(sql).toContain(`as ${column}`);
    expect(sql).not.toContain('prices');
  });

  test.each(history)('still joins block %s to their USD price where block prices are indexed', async (_, query) => {
    jest.spyOn(Common, 'blockPricesIndexingEnabled').mockReturnValue(true);

    await query();

    const sql: string = mockDbQuery.mock.calls[0][0];
    expect(sql).toContain('prices.USD');
    expect(sql).toContain('JOIN blocks_prices on blocks_prices.height = blocks.height');
    expect(sql).toContain('JOIN prices on prices.id = blocks_prices.price_id');
  });
});
