import { loadSeed, qbitCli, qbitCliJson, RegtestSeed } from '../../support/regtest';

// This spec moves the chain's tip, so it leaves the seeded blocks in place and
// only replaces blocks that it mined itself.
describe('Cadence lanes across reorgs', () => {
  let seed: RegtestSeed;

  before(() => {
    loadSeed().then((loaded) => {
      seed = loaded;
    });
  });

  // A new address each time: within the same second, the same payout would
  // rebuild the very block that was just invalidated, which qbitd then refuses.
  function newAddress(): Cypress.Chainable<string> {
    return qbitCli(`-rpcwallet=${seed.wallet}`, 'getnewaddress', 'reorg-spec', 'p2mr');
  }

  function minePermissionless(): Cypress.Chainable<string> {
    // An empty block, so the mempool stays as it is
    return newAddress()
      .then((address) => qbitCliJson<{ hash: string }>('generateblock', address, '[]'))
      .then(({ hash }) => hash);
  }

  function auxpowCandidate(): Cypress.Chainable<{ hash: string, payload: string }> {
    return newAddress().then((address) => qbitCli('createauxblock', address)).then((template) => {
      return cy.task<string>('auxpowPayload', template).then((payload) => ({ hash: JSON.parse(template).hash, payload }));
    });
  }

  function mineAuxpow(): Cypress.Chainable<string> {
    return auxpowCandidate().then(({ hash, payload }) => {
      return qbitCli('submitauxblock', hash, payload).then((result) => {
        expect(result).to.equal('');
        return hash;
      });
    });
  }

  function expectLane(height: number, lane: string): void {
    cy.get(`#bitcoin-block-${height} [data-cy="blockchain-block-cadence-lane"] [data-lane="${lane}"]`, { timeout: 30000 }).should('exist');
  }

  // The backend notices a reorg when a block arrives above the height it last
  // saw, as it would on a live chain, so each replacement chain is one block
  // longer than the one it replaces.
  it('updates the block list when the other lane replaces the tip', () => {
    qbitCliJson<number>('getblockcount').then((tip) => {
      const height = tip + 1;
      cy.visit('/regtest/');

      minePermissionless().then((replaced) => {
        expectLane(height, 'permissionless');

        qbitCli('invalidateblock', replaced);
        mineAuxpow().then((replacement) => {
          mineAuxpow().then(() => {
            expectLane(height, 'auxpow');
            expectLane(height + 1, 'auxpow');

            qbitCli('invalidateblock', replacement);
            minePermissionless();
            minePermissionless();
            minePermissionless().then(() => {
              expectLane(height, 'permissionless');
              expectLane(height + 1, 'permissionless');
              expectLane(height + 2, 'permissionless');
            });
          });
        });

        // A direct link to the replaced block says what happened to it
        cy.visit(`/regtest/block/${replaced}`);
        cy.contains('h1', 'Stale Block');
      });
    });
  });

  it('does not show a stale AuxPoW submission', () => {
    auxpowCandidate().then(({ hash, payload }) => {
      minePermissionless().then((tipHash) => {
        qbitCli('submitauxblock', hash, payload).then((result) => {
          expect(result).to.equal('stale-prevblk');
        });
        qbitCli('getbestblockhash').then((best) => {
          expect(best).to.equal(tipHash);
        });
      });

      cy.visit(`/regtest/block/${hash}`);
      cy.contains('Error loading');
    });
  });
});
