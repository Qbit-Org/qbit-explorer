import { loadSeed, RegtestSeed, rowValues, seedOutput } from '../../support/regtest';

describe('address page', () => {
  let seed: RegtestSeed;

  before(() => {
    loadSeed().then((loaded) => {
      seed = loaded;
    });
  });

  [
    ['legacy', 'P2PKH', /^q/],
    ['p2sh-segwit', 'P2SH', /^s/],
    ['p2mr', 'P2MR', /^qbrt1z/],
    ['p2mr_leaf', 'P2MR', /^qbrt1z/],
  ].forEach(([type, label, prefix]: [string, string, RegExp]) => {
    it(`shows a ${label} address (${type})`, () => {
      const { address, txid } = seedOutput(seed, type);
      expect(address).to.match(prefix);
      cy.visit(`/regtest/address/${address}`);
      rowValues('Type').should('contain.text', label);
      rowValues('Total received').should('contain.text', '2.50000000 QBT');
      cy.get(`a[href$="/tx/${txid}"]`).should('exist');
    });
  });

  // The reason qbit-electrs gives reaches the page, as a 400 and not a 500
  [
    ['bech32', 'qbit P2MR address must use Bech32m, got Bech32'],
    ['p2wsh', 'qbit P2MR address must use Bech32m, got Bech32'],
    ['bech32m', 'invalid qbit P2MR witness version: expected 2, got 1'],
    ['reserved_witness_v3', 'invalid qbit P2MR witness version: expected 2, got 3'],
  ].forEach(([type, reason]) => {
    it(`explains why it has no page for a ${type} address`, () => {
      cy.visit(`/regtest/address/${seedOutput(seed, type).address}`);
      cy.contains('Error loading address data.');
      cy.contains(`400 Bad Request: ${reason}`);
    });
  });

  it('explains why it rejects a Bitcoin address', () => {
    cy.visit('/regtest/address/bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh');
    cy.contains('Error loading address data.');
    cy.contains('400 Bad Request: invalid qbit address HRP: expected qbrt, got bc');
  });
});
