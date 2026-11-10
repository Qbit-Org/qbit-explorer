import { loadSeed, qbitCli, qbitCliJson, RegtestSeed, rowValues } from '../../support/regtest';

interface BumpFeeResult {
  txid: string;
  origfee: number;
  fee: number;
  errors: string[];
}

// The backend records a replacement only if the transaction it replaces was in
// the backend's own mempool first, so the spec waits on the backend's state
// before each step instead of sleeping.
describe('RBF replacement', () => {
  let seed: RegtestSeed;
  // Every transaction the spec sends, so that it can confirm those still waiting
  const sent: string[] = [];

  before(() => {
    loadSeed().then((loaded) => {
      seed = loaded;
    });
  });

  // Mine whatever the spec left unconfirmed, so the specs after it, and a re-run,
  // find the shared mempool as it was. The spec spends only confirmed coins, so
  // its transactions make a valid block on their own.
  after(() => {
    if (!seed) {
      return;
    }
    qbitCliJson<string[]>('getrawmempool').then((mempool) => {
      const unconfirmed = sent.filter((txid) => mempool.includes(txid));
      if (!unconfirmed.length) {
        return;
      }
      qbitCli(`-rpcwallet=${seed.wallet}`, 'getnewaddress', 'rbf-spec', 'p2mr').then((address) => {
        qbitCliJson<{ hash: string }>('generateblock', address, JSON.stringify(unconfirmed)).then(() => {
          qbitCliJson<number>('getblockcount').then((height) => {
            waitForApi<number>(`the backend at height ${height}`, '/regtest/api/v1/blocks/tip/height',
              ({ status, body }) => status === 200 && Number(body) === height);
          });
        });
      });
    });
  });

  // Poll a backend route every half second until check() accepts its response
  function waitForApi<T>(description: string, url: string, check: (response: Cypress.Response<T>) => boolean, attemptsLeft = 60): void {
    cy.request<T>({ url, log: false, failOnStatusCode: false }).then((response) => {
      if (check(response)) {
        return;
      }
      if (attemptsLeft <= 1) {
        throw new Error(`gave up waiting for ${description}`);
      }
      cy.wait(500, { log: false });
      waitForApi(description, url, check, attemptsLeft - 1);
    });
  }

  // transaction-times answers 0 for a transaction the backend's mempool doesn't hold
  function waitForBackendMempool(txid: string): void {
    waitForApi<number[]>(`${txid} in the backend's mempool`, `/regtest/api/v1/transaction-times?txId[]=${txid}`,
      ({ status, body }) => status === 200 && body[0] > 0);
  }

  // The fee rate a timeline node shows. No witness discount, so it is the fee over the weight.
  function expectFeeRate(txid: string, min: number, max: number): void {
    cy.get(`.rbf-timeline #node-${txid} .fee-rate`).should(($rate) => {
      const rate = Number(/([\d.,]+)\s*bits\/vB/.exec($rate.text())?.[1].replace(/,/g, '') ?? NaN);
      expect(rate, `fee rate of ${txid} in bits/vB`).to.be.within(min, max);
    });
  }

  function expectTimeline(original: string, replacement: string, selected: string): void {
    cy.contains('h2', 'RBF Timeline', { timeout: 30000 });
    [original, replacement].forEach((txid) => {
      cy.get(`.rbf-timeline #node-${txid}`).should(txid === selected ? 'have.class' : 'not.have.class', 'selected')
        .find(`a.shape-border[href$="/tx/${txid}"]`).should('exist');
    });
    // The original signals RBF, so the timeline doesn't mark the replacement as full RBF
    cy.get(`.rbf-timeline #node-${original} a.shape-border`).should('have.class', 'rbf');
    cy.get('.rbf-timeline .fullrbf').should('not.exist');
    expectFeeRate(original, 9.5, 11);
    expectFeeRate(replacement, 28, 32);
  }

  function expectReplaced(original: string, replacement: string): void {
    cy.contains('.title-block .alert', 'This transaction has been replaced by:', { timeout: 30000 })
      .find(`a[href$="/tx/${replacement}"]`).should('exist');
    cy.get('.title-block app-confirmations').should('contain.text', 'Replaced');
    // A replaced transaction gets no ETA
    cy.get('td').should(($cells) => {
      expect($cells.toArray().map((cell) => cell.textContent?.trim())).to.not.include('ETA');
    });
    expectTimeline(original, replacement, original);
  }

  it('shows a bumpfee replacement on the replaced transaction\'s page', () => {
    const wallet = `-rpcwallet=${seed.wallet}`;
    qbitCli(wallet, 'getnewaddress', 'rbf-spec', 'p2mr').then((address) => {
      // Confirmed coins only: an unconfirmed parent would keep the cleanup block from being valid
      const options = '{"replaceable":true,"minconf":1}';
      qbitCliJson<{ complete: boolean, txid: string }>(wallet, '-named', 'send', `outputs=[{"${address}":1}]`, 'fee_rate=10', `options=${options}`).then(({ complete, txid: original }) => {
        expect(complete).to.equal(true);
        sent.push(original);
        waitForBackendMempool(original);
        cy.visit(`/regtest/tx/${original}`);
        cy.get('.title-block app-confirmations').should('contain.text', 'Unconfirmed');
        // The ETA comes over the websocket, so the page now tracks the transaction
        rowValues('ETA').should('contain.text', 'In ~1 minute');
        cy.contains('h2', 'RBF Timeline').should('not.exist');

        qbitCliJson<BumpFeeResult>(wallet, 'bumpfee', original, '{"fee_rate":30}').then(({ txid: replacement, errors }) => {
          sent.push(replacement);
          expect(errors).to.deep.equal([]);

          // The open page learns of the replacement over the websocket
          expectReplaced(original, replacement);

          // A new visit finds the replaced transaction in the backend's RBF cache
          cy.reload();
          expectReplaced(original, replacement);

          // The replacement's page shows the same timeline, from its side
          cy.visit(`/regtest/tx/${replacement}`);
          expectTimeline(original, replacement, replacement);
          cy.get('.title-block app-confirmations').should('contain.text', 'Unconfirmed');
          cy.contains('This transaction has been replaced by').should('not.exist');
        });
      });
    });
  });
});
