import { loadSeed, RegtestSeed, rowValues, seedOutput, showTransactionDetails } from '../../support/regtest';

describe('transaction page', () => {
  let seed: RegtestSeed;

  before(() => {
    loadSeed().then((loaded) => {
      seed = loaded;
    });
  });

  function visitSeedTransaction(type: string): void {
    cy.visit(`/regtest/tx/${seedOutput(seed, type).txid}`);
    showTransactionDetails();
  }

  function expectOutputType(label: string): void {
    rowValues('Type').should(($cells) => {
      expect($cells.toArray().map((cell) => cell.textContent?.trim())).to.include(label);
    });
  }

  function witnessItems(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get('[data-cy="tx-0"] .witness-item');
  }

  [
    ['legacy', 'P2PKH'],
    ['p2sh-segwit', 'P2SH'],
    ['p2mr', 'P2MR'],
    ['p2mr_leaf', 'P2MR'],
  ].forEach(([type, label]) => {
    it(`links the address of a ${label} output (${type})`, () => {
      visitSeedTransaction(type);
      cy.get(`[data-cy="tx-0"] a[href$="/address/${seedOutput(seed, type).address}"]`).should('exist');
      expectOutputType(label);
    });
  });

  // qbit-electrs only encodes Base58 and P2MR addresses, so these outputs show
  // their type instead. Mainnet and testnet4 don't allow them at all.
  [
    ['bech32', 'V0_P2WPKH'],
    ['p2wsh', 'V0_P2WSH'],
    ['bech32m', 'V1_P2TR'],
    ['reserved_witness_v3', 'Reserved witness v3'],
  ].forEach(([type, label]) => {
    it(`shows the type of an output with no address (${label})`, () => {
      visitSeedTransaction(type);
      cy.get(`[data-cy="tx-0"] a[href$="/address/${seedOutput(seed, type).address}"]`).should('not.exist');
      cy.get('[data-cy="tx-0"]').should('contain.text', label);
      expectOutputType(label);
    });
  });

  it('labels OP_RETURN and anchor outputs', () => {
    visitSeedTransaction('op_return+anchor');
    cy.get('[data-cy="tx-0"]').should('contain.text', 'OP_RETURN').and('contain.text', 'qbit-explorer regtest harness');
    cy.get('[data-cy="tx-0"]').should('contain.text', 'Anchor');
    expectOutputType('Anchor');
  });

  it('shows a PQC-signed P2MR spend', () => {
    visitSeedTransaction('p2mr');
    rowValues('Previous output type').first().should('contain.text', 'P2MR');
    rowValues('P2MR leaf script').first().should('contain.text', 'OP_CHECKSIGPQC');
    // The 3,680-byte signature starts cut short, and "Show all" expands it
    witnessItems().first().invoke('text').then((text) => expect(text.trim()).to.have.length(1000));
    witnessItems().first().parent().contains('Show all').click();
    witnessItems().first().invoke('text').then((text) => expect(text.trim()).to.have.length(2 * 3680));
  });

  it('shows a P2MR script-path spend', () => {
    visitSeedTransaction('p2mr_leaf_spend');
    witnessItems().then(($items) => {
      expect($items.toArray().map((item) => item.textContent?.trim())).to.deep.equal(['51', 'c1']);
    });
    rowValues('P2MR leaf script').should('contain.text', 'OP_PUSHNUM_1');
    rowValues('Previous output type').should('contain.text', 'P2MR');
    // No witness discount, so size, virtual size and weight are the same number
    rowValues('Size').should('contain.text', '101 B');
    rowValues('Virtual size').should('contain.text', '101 vB');
    rowValues('Weight').should('contain.text', '101 WU');
  });
});
