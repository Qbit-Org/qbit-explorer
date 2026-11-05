// Helpers for the specs in cypress/e2e/regtest, which run against the stack
// that backend/scripts/qbit-regtest-harness.sh starts. "Regtest Harness" in
// docs/qbit-local-dev.md explains how to run them.

export interface SeedOutput {
  type: string;
  address: string;
  txid: string;
}

// The seed.json the harness writes
export interface RegtestSeed {
  wallet: string;
  auxpowBlocks: string[];
  permissionlessBlocks: string[];
  confirmed: SeedOutput[];
}

export function loadSeed(): Cypress.Chainable<RegtestSeed> {
  return cy.task<RegtestSeed>('regtestSeed');
}

export function seedOutput(seed: RegtestSeed, type: string): SeedOutput {
  const output = seed.confirmed.find((candidate) => candidate.type === type);
  if (!output) {
    throw new Error(`seed.json has no "${type}" output`);
  }
  return output;
}

export function qbitCli(...args: string[]): Cypress.Chainable<string> {
  return cy.task<string>('qbitCli', args);
}

export function qbitCliJson<T>(...args: string[]): Cypress.Chainable<T> {
  return qbitCli(...args).then((out) => cy.wrap<T>(JSON.parse(out), { log: false }));
}

// The cell next to a row's label, such as "Weight" on a block page. A label can
// repeat, as "Type" does for each output of a transaction, so this yields them all.
export function rowValues(label: string): Cypress.Chainable<JQuery<HTMLElement>> {
  return cy.get('td').filter((_, cell) => cell.textContent?.trim() === label).next();
}

// Show the details of every input and output on a transaction page
export function showTransactionDetails(): void {
  cy.get('[data-cy="tx-0"]').should('exist');
  cy.contains('button', 'Details').click();
  cy.contains('td', 'ScriptPubKey (ASM)');
}
