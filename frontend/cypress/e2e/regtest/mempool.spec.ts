import { loadSeed, qbitCli, qbitCliJson, RegtestSeed, rowValues } from '../../support/regtest';

describe('mempool', () => {
  let seed: RegtestSeed;
  let txid: string;

  before(() => {
    loadSeed().then((loaded) => {
      seed = loaded;
      qbitCli(`-rpcwallet=${seed.wallet}`, 'getnewaddress', 'mempool-spec', 'p2mr').then((address) => {
        qbitCli(`-rpcwallet=${seed.wallet}`, '-named', 'sendtoaddress', `address=${address}`, 'amount=1', 'fee_rate=25').then((sent) => {
          txid = sent;
        });
      });
    });
  });

  it('projects the next block from the mempool', () => {
    qbitCliJson<{ size: number }>('getmempoolinfo').then(({ size }) => {
      cy.visit('/regtest/');
      cy.get('[data-cy="mempool-block-0-transaction-count"]').invoke('text').should('match', new RegExp(`\\b${size} transactions?\\b`));
      // This chain was mined in seconds, so the ETA is its shortest wording.
      // The block target itself shows in the difficulty state below.
      cy.get('[data-cy="mempool-block-0-time"]').should('contain.text', 'In ~1 minute');
      cy.request('/regtest/api/v1/difficulty-adjustment').its('body.targetSpacingMs').should('equal', 60000);
      // Lanes belong to mined blocks: a projected block can land in either one
      cy.get('[data-cy="mempool-block-0"]').find('[data-cy="cadence-lane-badge"]').should('not.exist');

      cy.visit('/regtest/mempool-block/0');
      cy.contains('Next Block');
      rowValues('Transactions').invoke('text').should('match', new RegExp(`\\b${size}\\b`));
    });
  });

  it('shows fee rates in bits/vB', () => {
    cy.visit('/regtest/');
    ['No Priority', 'Low Priority', 'Medium Priority', 'High Priority'].forEach((tier) => {
      cy.get('.fee-estimation-wrapper').should('contain.text', tier);
    });
    cy.get('.fee-estimation-wrapper').should('contain.text', 'bits/vB');

    cy.visit(`/regtest/tx/${txid}`);
    cy.contains('Unconfirmed');
    rowValues('ETA').should('contain.text', 'In ~1 minute');
    // The wallet rounds its fee up, so the rate can land just above the one it was asked for
    rowValues('Fee rate').invoke('text').should('match', /25\.\d bits\/vB/);
  });
});
