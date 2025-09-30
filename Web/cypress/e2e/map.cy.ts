describe("Map smoke", () => {
  it("renders the map card and legend", () => {
    cy.visit("/map");
    cy.get(".map-card").should("exist");
    cy.get(".map-legend").should("exist");
  });
});
