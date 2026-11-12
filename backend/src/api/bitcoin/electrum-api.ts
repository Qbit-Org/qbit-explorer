import config from '../../config';
import Client from '@mempool/electrum-client';
import { AbstractBitcoinApi } from './bitcoin-api-abstract-factory';
import { IEsploraApi } from './esplora-api.interface';
import { IElectrumApi } from './electrum-api.interface';
import BitcoinApi from './bitcoin-api';
import logger from '../../logger';
import crypto from 'crypto-js';
import loadingIndicators from '../loading-indicators';
import memoryCache from '../memory-cache';
import mempool from '../mempool';
import { AFTER_TXID_NOT_FOUND, isTxNotInMempoolOrChainError } from '../../utils/api';

class BitcoindElectrsApi extends BitcoinApi implements AbstractBitcoinApi {
  private electrumClient: any;

  constructor(bitcoinClient: any) {
    super(bitcoinClient);

    const electrumConfig = { client: 'mempool-v2', version: '1.4' };
    const electrumPersistencePolicy = { retryPeriod: 1000, maxRetry: Number.MAX_SAFE_INTEGER, callback: null };

    const electrumCallbacks = {
      onConnect: (client, versionInfo) => { logger.info(`Connected to Electrum Server at ${config.ELECTRUM.HOST}:${config.ELECTRUM.PORT} (${JSON.stringify(versionInfo)})`); },
      onClose: (client) => { logger.info(`Disconnected from Electrum Server at ${config.ELECTRUM.HOST}:${config.ELECTRUM.PORT}`); },
      onError: (err) => { logger.err(`Electrum error: ${JSON.stringify(err)}`); },
      onLog: (str) => { logger.debug(str); },
    };

    this.electrumClient = new Client(
      config.ELECTRUM.PORT,
      config.ELECTRUM.HOST,
      config.ELECTRUM.TLS_ENABLED ? 'tls' : 'tcp',
      null,
      electrumCallbacks
    );

    this.electrumClient.initElectrum(electrumConfig, electrumPersistencePolicy)
      .then(() => { })
      .catch((err) => {
        logger.err(`Error connecting to Electrum Server at ${config.ELECTRUM.HOST}:${config.ELECTRUM.PORT}`);
      });
  }

  /** @asyncUnsafe */
  async $getAddress(address: string): Promise<IEsploraApi.Address> {
    const addressInfo = await this.bitcoindClient.validateAddress(address);
    if (!addressInfo || !addressInfo.isvalid) {
      throw new Error('Invalid Bitcoin address');
    }

    try {
      const balance = await this.$getScriptHashBalance(addressInfo.scriptPubKey);
      const history = await this.$getScriptHashHistory(addressInfo.scriptPubKey);

      const unconfirmed = history.filter((h) => h.fee).length;

      return {
        'address': addressInfo.address,
        'chain_stats': {
          'funded_txo_count': 0,
          'funded_txo_sum': balance.confirmed ? balance.confirmed : 0,
          'spent_txo_count': 0,
          'spent_txo_sum': balance.confirmed < 0 ? balance.confirmed : 0,
          'tx_count': history.length - unconfirmed,
        },
        'mempool_stats': {
          'funded_txo_count': 0,
          'funded_txo_sum': balance.unconfirmed > 0 ? balance.unconfirmed : 0,
          'spent_txo_count': 0,
          'spent_txo_sum': balance.unconfirmed < 0 ? -balance.unconfirmed : 0,
          'tx_count': unconfirmed,
        },
        'electrum': true,
      };
    } catch (e: any) {
      throw new Error(typeof e === 'string' ? e : e && e.message || e);
    }
  }

  /** @asyncUnsafe */
  async $getAddressTransactions(address: string, lastSeenTxId?: string): Promise<IEsploraApi.Transaction[]> {
    const addressInfo = await this.bitcoindClient.validateAddress(address);
    if (!addressInfo || !addressInfo.isvalid) {
      throw new Error('Invalid Bitcoin address');
    }

    try {
      loadingIndicators.setProgress('address-' + address, 0);
      const history = await this.$getScriptHashHistory(addressInfo.scriptPubKey);
      return await this.$getHistoryPage(history, lastSeenTxId, 'address-' + address);
    } catch (e: any) {
      loadingIndicators.setProgress('address-' + address, 100);
      throw new Error(typeof e === 'string' ? e : e && e.message || e);
    }
  }

  async $getScriptHash(scripthash: string): Promise<IEsploraApi.ScriptHash> {
    try {
      const balance = await this.electrumClient.blockchainScripthash_getBalance(scripthash);
      let history = memoryCache.get<IElectrumApi.ScriptHashHistory[]>('Scripthash_getHistory', scripthash);
      if (!history) {
        history = await this.electrumClient.blockchainScripthash_getHistory(scripthash);
        memoryCache.set('Scripthash_getHistory', scripthash, history, 2);
      }

      const unconfirmed = history ? history.filter((h) => h.fee).length : 0;

      return {
        'scripthash': scripthash,
        'chain_stats': {
          'funded_txo_count': 0,
          'funded_txo_sum': balance.confirmed ? balance.confirmed : 0,
          'spent_txo_count': 0,
          'spent_txo_sum': balance.confirmed < 0 ? balance.confirmed : 0,
          'tx_count': (history?.length || 0) - unconfirmed,
        },
        'mempool_stats': {
          'funded_txo_count': 0,
          'funded_txo_sum': balance.unconfirmed > 0 ? balance.unconfirmed : 0,
          'spent_txo_count': 0,
          'spent_txo_sum': balance.unconfirmed < 0 ? -balance.unconfirmed : 0,
          'tx_count': unconfirmed,
        },
        'electrum': true,
      };
    } catch (e: any) {
      throw new Error(typeof e === 'string' ? e : e && e.message || e);
    }
  }

  /** @asyncUnsafe */
  async $getAddressUtxos(address: string): Promise<IEsploraApi.UTXO[]> {
    const addressInfo = await this.bitcoindClient.validateAddress(address);
    if (!addressInfo || !addressInfo.isvalid) {
      throw new Error('Invalid Bitcoin address');
    }
    const scripthash = this.encodeScriptHash(addressInfo.scriptPubKey);
    return this.$getScriptHashUtxos(scripthash);
  }

  async $getScriptHashTransactions(scripthash: string, lastSeenTxId?: string): Promise<IEsploraApi.Transaction[]> {
    try {
      loadingIndicators.setProgress('address-' + scripthash, 0);
      let history = memoryCache.get<IElectrumApi.ScriptHashHistory[]>('Scripthash_getHistory', scripthash);
      if (!history) {
        history = await this.electrumClient.blockchainScripthash_getHistory(scripthash);
        memoryCache.set('Scripthash_getHistory', scripthash, history, 2);
      }
      if (!history) {
        throw new Error('failed to get scripthash history');
      }
      return await this.$getHistoryPage(history, lastSeenTxId, 'address-' + scripthash);
    } catch (e: any) {
      loadingIndicators.setProgress('address-' + scripthash, 100);
      throw new Error(typeof e === 'string' ? e : e && e.message || e);
    }
  }

  /** @asyncUnsafe */
  async $getScriptHashUtxos(scripthash: string): Promise<IEsploraApi.UTXO[]> {
    const utxos = await this.$getScriptHashUnspent(scripthash);
    const result: IEsploraApi.UTXO[] = [];
    for(const utxo of utxos) {
      if(utxo.height===0) {
        //Unconfirmed
        result.push({
          txid: utxo.tx_hash,
          vout: utxo.tx_pos,
          status: {
            confirmed: false
          },
          value: utxo.value
        });
      } else {
        //Confirmed
        const blockHash = await this.$getBlockHash(utxo.height);
        const block = await this.$getBlock(blockHash);
        result.push({
          txid: utxo.tx_hash,
          vout: utxo.tx_pos,
          status: {
            confirmed: true,
            block_height: utxo.height,
            block_hash: blockHash,
            block_time: block.timestamp
          },
          value: utxo.value
        });
      }
    }
    return result;
  }

  /**
   * Up to 10 transactions of a history, newest first, after lastSeenTxId as esplora pages them.
   *
   * @asyncUnsafe
   */
  private async $getHistoryPage(history: IElectrumApi.ScriptHashHistory[], lastSeenTxId: string | undefined, progressName: string): Promise<IEsploraApi.Transaction[]> {
    // Unconfirmed transactions (Electrum heights 0 and -1) are the newest. The txid breaks ties, so
    // pages cut after a txid hold together whatever order the server lists them in. Sort a copy, as
    // memoryCache shares the history.
    const sortHeight = (entry: IElectrumApi.ScriptHashHistory): number => entry.height > 0 ? entry.height : Number.MAX_SAFE_INTEGER;
    const sorted = [...history].sort((a, b) => (sortHeight(b) - sortHeight(a)) || (a.tx_hash < b.tx_hash ? -1 : a.tx_hash > b.tx_hash ? 1 : 0));

    const startingIndex = await this.$getHistoryIndexAfter(sorted, lastSeenTxId);
    const endIndex = Math.min(startingIndex + 10, sorted.length);
    const transactions: IEsploraApi.Transaction[] = [];
    for (let i = startingIndex; i < endIndex; i++) {
      transactions.push(await this.$getRawTransaction(sorted[i].tx_hash, false, true));
      loadingIndicators.setProgress(progressName, (i + 1) / endIndex * 100);
    }
    if (startingIndex >= endIndex) {
      // the loop takes any other page to 100, which clears the indicator
      loadingIndicators.setProgress(progressName, 100);
    }
    return transactions;
  }

  /**
   * Where a page of a newest-first history starts after lastSeenTxId, matching esplora: past the
   * end for a transaction that is not in the history, and Error(AFTER_TXID_NOT_FOUND), a 422, for
   * one the node does not have either, such as one that left the mempool.
   *
   * @asyncUnsafe
   */
  private async $getHistoryIndexAfter(history: IElectrumApi.ScriptHashHistory[], lastSeenTxId?: string): Promise<number> {
    if (!lastSeenTxId) {
      return 0;
    }
    const pos = history.findIndex((historicalTx) => historicalTx.tx_hash === lastSeenTxId);
    if (pos !== -1) {
      return pos + 1;
    }
    if (!mempool.getMempool()[lastSeenTxId]) {
      try {
        // the hex is enough to tell the transaction exists
        await this.bitcoindClient.getRawTransaction(lastSeenTxId, false);
      } catch (e) {
        // only a definite answer: with txindex disabled or still building, Core cannot rule a
        // confirmed transaction out, so that error goes on, and the route answers 503
        if (isTxNotInMempoolOrChainError(e)) {
          throw new Error(AFTER_TXID_NOT_FOUND);
        }
        throw e;
      }
    }
    return history.length;
  }

  private $getScriptHashUnspent(scriptHash: string): Promise<IElectrumApi.ScriptHashUtxos[]> {
    return this.electrumClient.blockchainScripthash_listunspent(scriptHash);
  }

  /** @asyncUnsafe */
  async $getTransactionMerkleProof(txId: string): Promise<IEsploraApi.MerkleProof> {
    const tx = await this.$getRawTransaction(txId);
    return this.electrumClient.blockchainTransaction_getMerkle(txId, tx.status.block_height);
  }

  private $getScriptHashBalance(scriptHash: string): Promise<IElectrumApi.ScriptHashBalance> {
    return this.electrumClient.blockchainScripthash_getBalance(this.encodeScriptHash(scriptHash));
  }

  private $getScriptHashHistory(scriptHash: string): Promise<IElectrumApi.ScriptHashHistory[]> {
    const fromCache = memoryCache.get<IElectrumApi.ScriptHashHistory[]>('Scripthash_getHistory', scriptHash);
    if (fromCache) {
      return Promise.resolve(fromCache);
    }
    return this.electrumClient.blockchainScripthash_getHistory(this.encodeScriptHash(scriptHash))
      .then((history) => {
        memoryCache.set('Scripthash_getHistory', scriptHash, history, 2);
        return history;
      });
  }

  private encodeScriptHash(scriptPubKey: string): string {
    const addrScripthash = crypto.enc.Hex.stringify(crypto.SHA256(crypto.enc.Hex.parse(scriptPubKey)));
    return addrScripthash!.match(/.{2}/g)!.reverse().join('');
  }

}

export default BitcoindElectrsApi;
