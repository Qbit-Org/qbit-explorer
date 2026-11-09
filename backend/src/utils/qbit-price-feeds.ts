// qbit has no QBT price feed yet: upstream's feeds price BTC. While this is
// false the price updater stores no price, so no block is ever linked to one.
// Kept free of imports, so that modules such as api/common can read it
// without loading the price updater.
export const QBIT_PRICE_FEEDS_AVAILABLE = false;
