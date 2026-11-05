describe('qbit.org header and footer', () => {
  function footerLinks(column: string): Cypress.Chainable<string[]> {
    return cy.contains('.qbit-site-footer-group', column).find('a').then(($links) => $links.toArray().map((link) => link.textContent?.trim() ?? ''));
  }

  it('shows the footer columns qbit.org shows', () => {
    cy.intercept('/qbit-design/**').as('contract');
    cy.visit('/regtest/');
    cy.wait('@contract');
    cy.get('.qbit-header').should('exist');
    cy.get('.qbit-site-footer-group h2').then(($labels) => {
      expect($labels.toArray().map((label) => label.textContent)).to.deep.equal(['Explore', 'Docs', 'Stats', 'Resources']);
    });
    footerLinks('Explore').should('not.include', 'Home').and('include', 'Wallet');
    footerLinks('Docs').should('include', 'RPC Docs');
    footerLinks('Stats').should('include', 'Mempool');
    footerLinks('Resources').should('deep.equal', ['Changelog', 'Press']);
    cy.contains('.qbit-site-footer-group a', 'Changelog').should('have.attr', 'href', 'https://qbit.org/changelog');
    cy.contains('.qbit-site-footer-group a', 'RPC Docs').should('have.attr', 'target', '_blank');
    cy.get('link[rel="preconnect"][href="https://qbit.org"]').should('exist');

    cy.viewport(390, 844);
    cy.get('.qbit-hamburger').should('be.visible');
    cy.get('.qbit-subnav').should('not.be.visible');
  });

  it('turns off with QBIT_SITE_CHROME', () => {
    cy.intercept('GET', '/resources/config.js', (req) => {
      req.continue((res) => {
        res.body += '\nwindow.__env.QBIT_SITE_CHROME = false;\n';
      });
    });
    cy.intercept('/qbit-design/**').as('contract');
    cy.visit('/regtest/');

    cy.get('.qbit-subnav').should('exist');
    cy.get('.qbit-footer-explorer').should('exist');
    cy.get('.qbit-header').should('not.exist');
    cy.get('.qbit-footer').should('not.exist');
    cy.get('html').should('have.class', 'no-qbit-chrome');
    cy.get('link[rel="preconnect"][href="https://qbit.org"]').should('not.exist');
    // Long enough for the fetch the test above waits for
    cy.wait(2000);
    cy.get('@contract.all').should('have.length', 0);

    // The section bar replaces the hamburger menu on a phone
    cy.viewport(390, 844);
    cy.get('.qbit-subnav').should('be.visible').find('#btn-graphs').should('exist');
  });
});
