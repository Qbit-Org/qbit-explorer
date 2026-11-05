import { loadSeed, qbitCliJson, RegtestSeed, rowValues } from '../../support/regtest';

describe('block page', () => {
  let seed: RegtestSeed;

  before(() => {
    loadSeed().then((loaded) => {
      seed = loaded;
    });
  });

  it('shows a block with qbit weight and subsidy', () => {
    const hash = seed.permissionlessBlocks[0];
    qbitCliJson<{ height: number, size: number, weight: number }>('getblock', hash, '1').then((block) => {
      qbitCliJson<{ subsidy: number, totalfee: number }>('getblockstats', String(block.height), '["subsidy","totalfee"]').then((stats) => {
        cy.visit(`/regtest/block/${hash}`);
        cy.contains('h1', 'Block').should('contain.text', block.height);
        rowValues('Hash').find('a').should('have.attr', 'title', hash);
        // No witness discount, so weight equals size
        expect(block.weight).to.equal(block.size);
        rowValues('Size').should('contain.text', `${block.size} B`);
        rowValues('Weight').should('contain.text', `${block.weight} WU`);
        // The stepped-down subsidy, not Bitcoin's halving schedule
        rowValues('Subsidy + fees').should('contain.text', `${Number(((stats.subsidy + stats.totalfee) / 1e8).toFixed(3))} QBT`);
        cy.contains(/halving/i).should('not.exist');
      });
    });
  });
});
