import priceUpdater, { QBIT_PRICE_FEEDS_AVAILABLE } from '../../tasks/price-updater';

describe('qbit price updater stub', () => {
  it('keeps qbit fiat price feeds disabled', async () => {
    expect(QBIT_PRICE_FEEDS_AVAILABLE).toBe(false);

    await priceUpdater.$initializeLatestPriceWithDb();
    await priceUpdater.$run();

    const prices = priceUpdater.getLatestPrices();
    expect(prices.time).toBe(0);
    for (const [currency, price] of Object.entries(prices)) {
      if (currency !== 'time') {
        expect(price).toBe(-1);
      }
    }
  });
});
