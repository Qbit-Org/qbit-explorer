import { loadSeed, qbitCliJson, RegtestSeed } from '../../support/regtest';

describe('Cadence mining lanes', () => {
  let seed: RegtestSeed;

  before(() => {
    loadSeed().then((loaded) => {
      seed = loaded;
    });
  });

  it('labels a permissionless block', () => {
    cy.visit(`/regtest/block/${seed.permissionlessBlocks[0]}`);
    cy.get('[data-cy="block-details-cadence-lane"] [data-lane="permissionless"]').should('contain.text', 'Permissionless');
    cy.get('[data-cy="block-details-cadence-lane"]').should('not.contain.text', 'Chain ID');
    cy.get('[data-cy="block-details-auxpow-parent"]').should('not.exist');
  });

  it('labels an AuxPoW block and shows its parent work', () => {
    cy.visit(`/regtest/block/${seed.auxpowBlocks[0]}`);
    // Mainnet's chain ID is 47; test chains share 31430
    cy.get('[data-cy="block-details-cadence-lane"] [data-lane="auxpow"]').should('contain.text', 'AuxPoW').and('contain.text', 'Chain ID 31430');
    cy.get('[data-cy="cadence-chain-id-warning"]').should('not.exist');
    cy.get('[data-cy="block-details-auxpow-parent"]').should('contain.text', 'Parent work hash');
  });

  it('tells the lanes apart in the block lists, in mining order', () => {
    const lanes = [
      ...seed.auxpowBlocks.map((hash) => ({ hash, lane: 'auxpow' })),
      ...seed.permissionlessBlocks.map((hash) => ({ hash, lane: 'permissionless' })),
    ];

    cy.visit('/regtest/blocks');
    lanes.forEach(({ hash, lane }) => {
      qbitCliJson<{ height: number }>('getblockheader', hash).then(({ height }) => {
        cy.get(`a[href$="/block/${hash}"]`).parents('tr').as('row');
        cy.get('@row').find('td.height a').invoke('text').then((text) => expect(Number(text.replace(/\D/g, ''))).to.equal(height));
        cy.get('@row').find(`[data-cy="blocks-list-cadence-lane"] [data-lane="${lane}"]`).should('exist');
      });
    });
    cy.get('[data-cy="blocks-list-cadence-lane"]').first().parents('tbody').find('td.height a').then(($links) => {
      const heights = $links.toArray().map((link) => Number(link.textContent?.replace(/\D/g, '')));
      expect(heights).to.deep.equal([...heights].sort((a, b) => b - a));
    });

    cy.visit('/regtest/');
    lanes.forEach(({ hash, lane }) => {
      qbitCliJson<{ height: number }>('getblockheader', hash).then(({ height }) => {
        cy.get(`#bitcoin-block-${height} [data-cy="blockchain-block-cadence-lane"] [data-lane="${lane}"]`).should('exist');
      });
    });
  });

  it('splits hashrate and difficulty by lane', () => {
    cy.visit('/regtest/graphs/mining/hashrate-difficulty');
    [/^Permissionless$/, /^AuxPoW$/, /^Difficulty \(Permissionless\)$/, /^Difficulty \(AuxPoW\)$/].forEach((series) => {
      cy.contains(series);
    });
    cy.contains(/halving/i).should('not.exist');
  });
});
