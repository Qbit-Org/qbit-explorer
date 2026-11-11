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

  // The block list on /blocks or the mining dashboard shows the block at `height`: its row's height
  // cell links to it
  function expectListed(hash: string, height: number): void {
    cy.get(`app-blocks-list a[href$="/block/${hash}"]`, { timeout: 30000 })
      .invoke('text')
      .should((text) => expect(Number(text.replace(/\D/g, ''))).to.equal(height));
  }

  // The list shows each height once, newest first, with no gap
  function expectConsecutiveHeights(): void {
    cy.get('app-blocks-list td.height a').should(($links) => {
      const heights = $links.toArray().map((link) => Number(link.textContent?.replace(/\D/g, '')));
      expect(heights).to.deep.equal(heights.map((_, i) => heights[0] - i));
    });
  }

  // Mines a permissionless block at `height`, then replaces it with two AuxPoW blocks while the page
  // is open: the list should show them in its place, without a reload.
  function replaceListedTip(height: number): void {
    minePermissionless().then((replaced) => {
      expectListed(replaced, height);
      qbitCli('invalidateblock', replaced);
      mineAuxpow().then((replacement) => {
        mineAuxpow().then((next) => {
          expectListed(next, height + 1);
          expectListed(replacement, height);
          cy.get(`app-blocks-list a[href$="/block/${replaced}"]`).should('not.exist');
          expectConsecutiveHeights();
        });
      });
    });
  }

  it('updates /blocks and the mining dashboard\'s latest blocks when the other lane replaces the tip', () => {
    qbitCliJson<number>('getblockcount').then((tip) => {
      cy.visit('/regtest/blocks');
      qbitCli('getblockhash', String(tip)).then((tipHash) => expectListed(tipHash, tip));
      replaceListedTip(tip + 1);

      cy.visit('/regtest/mining');
      cy.get('[data-cy="latest-blocks"] td.height a').should('have.length', 6);
      replaceListedTip(tip + 3);
    });
  });

  // The browser keeps an answer from /api/v1/blocks for 60 seconds. cy.intercept() doesn't see the
  // answers it takes from that cache.
  function clearBrowserCache(): void {
    cy.wrap(Cypress.automation('remote:debugger:protocol', { command: 'Network.clearBrowserCache' }), { log: false });
  }

  // From the mining dashboard to /blocks, in the page: the tab keeps the websocket's blocks
  function openBlocksFromMiningDashboard(): void {
    cy.contains('a.title-link', 'Recent Blocks').click();
    cy.location('pathname').should('match', /\/regtest\/blocks/);
  }

  it('shows the skeleton on /blocks until the API answers', () => {
    let delay = 0;
    clearBrowserCache();
    cy.intercept({ method: 'GET', pathname: '/regtest/api/v1/blocks' }, (req) => {
      req.on('response', (res) => {
        // nothing for the browser to keep: /blocks asks the API itself
        res.headers['cache-control'] = 'no-store';
        res.setDelay(delay);
      });
    });
    cy.visit('/regtest/mining');
    cy.get('[data-cy="latest-blocks"] td.height a').should('have.length', 6).then(() => {
      delay = 4000;
    });
    openBlocksFromMiningDashboard();
    cy.get('app-blocks-list .skeleton-loader').should('exist');
    cy.get('app-blocks-list td.height a').should('not.exist');
    cy.get('app-blocks-list td.height a', { timeout: 30000 }).should('have.length', 15);
  });

  it('does not bring back a block a reorg removed from the browser\'s copy of /blocks', () => {
    qbitCliJson<number>('getblockcount').then((tip) => {
      cy.visit('/regtest/mining');
      minePermissionless().then((removed) => {
        expectListed(removed, tip + 1);
        // /blocks asks the API now, and the browser keeps that answer
        clearBrowserCache();
        openBlocksFromMiningDashboard();
        expectListed(removed, tip + 1);
        cy.get('#btn-pools').click();
        cy.get('[data-cy="latest-blocks"] td.height a').should('have.length', 6);
        // The node goes back to `tip`, and the backend sends that reorg at once. The list /blocks
        // opens after it gets the browser's copy, which has the removed block on top.
        qbitCli('invalidateblock', removed);
        cy.get(`app-blocks-list a[href$="/block/${removed}"]`, { timeout: 30000 }).should('not.exist');
        openBlocksFromMiningDashboard();
        cy.get('app-blocks-list td.height a').should('have.length', 15);
        qbitCli('getblockhash', String(tip)).then((tipHash) => expectListed(tipHash, tip));
        cy.get(`app-blocks-list a[href$="/block/${removed}"]`).should('not.exist');
        expectConsecutiveHeights();
      });
    });
  });

  // Each row of the list links to the node's block at its height
  function expectNodeBlocks(): void {
    cy.get('app-blocks-list td.height a').each(($link) => {
      const height = $link.text().replace(/\D/g, '');
      qbitCli('getblockhash', height).then((hash) => expect($link.attr('href')).to.match(new RegExp(`/block/${hash}$`)));
    });
  }

  // A network's two origins can be on different chains for a while. When the API's blocks don't fit
  // the websocket's chain, /blocks asks twice more, 10 seconds apart, then shows the blocks that fit:
  // here the websocket's eight, and none of the API's.
  it('shows /blocks from the websocket\'s blocks when the API is on another chain', () => {
    qbitCliJson<number>('getblockcount').then((tip) => {
      // Until the next block after a reorg, as after the tests above, the backend's list for a page
      // that connects holds all its cached blocks, which cover /blocks: then none of the API's answers
      // needs asking again. Once the websocket has sent a new block, the list holds eight.
      cy.visit('/regtest/');
      minePermissionless();
      cy.get(`#bitcoin-block-${tip + 1}`, { timeout: 30000 }).should('exist');
      clearBrowserCache();
      cy.intercept({ method: 'GET', pathname: '/regtest/api/v1/blocks' }, (req) => {
        req.continue((res) => {
          // another hash at each height, after the websocket's first blocks
          res.body = res.body.map((block: { id: string }) => ({ ...block, id: block.id.split('').reverse().join('') }));
          res.setDelay(2000);
        });
      }).as('blocks');
      cy.visit('/regtest/blocks');
      cy.get('app-blocks-list td.height a', { timeout: 45000 }).should('have.length', 8);
      cy.get('app-blocks-list .spinner-border', { timeout: 45000 }).should('not.exist');
      expectNodeBlocks();
      expectConsecutiveHeights();
      // it has stopped asking: no request in longer than the 10 seconds between them
      cy.get('@blocks.all').then((requests) => {
        expect(requests.length).to.be.at.least(3);
        cy.wait(12000);
        cy.get('@blocks.all').should('have.length', requests.length);
      });
    });
  });

  it('shows page 2 of the new chain after a reorg to a shorter chain takes its heights', () => {
    qbitCliJson<number>('getblockcount').then((tip) => {
      minePermissionless().then((first) => {
        Cypress._.times(15, () => minePermissionless());
        qbitCli('getblockhash', String(tip + 16)).then((newTip) => {
          cy.visit('/regtest/blocks');
          expectListed(newTip, tip + 16);
        });
        // page 2 shows the heights from tip + 1 down, once the API's first answer counted 16 more
        clearBrowserCache();
        cy.visit('/regtest/blocks/2');
        expectListed(first, tip + 1);
        // the node goes back to `tip`: page 2 of that chain shows the heights from tip - 15 down
        qbitCli('invalidateblock', first);
        qbitCli('getblockhash', String(tip - 15)).then((hash) => expectListed(hash, tip - 15));
        cy.get(`app-blocks-list a[href$="/block/${first}"]`).should('not.exist');
        expectConsecutiveHeights();
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
