const sampleIncident = {
  id: "R#999",
  title: "Cypress Realtime",
  area: "Test District",
  severity: "high",
  status: "open",
  reportedDate: new Date().toISOString(),
};

describe("Realtime bridge", () => {
  it("applies incident bus updates", () => {
    cy.visit("/incidents", {
      onBeforeLoad(win) {
        win.localStorage.setItem("dash:incidents", "[]");
      },
    });

    cy.window().then((win) => {
      win.dispatchEvent(new CustomEvent("data:incidents", { detail: [sampleIncident] }));
    });

    cy.contains("td", sampleIncident.id).should("exist");
    cy.contains("td", sampleIncident.title).should("exist");
  });
});
