const incident = {
  id: "R#501",
  title: "Admin Smoke",
  area: "Bridge",
  severity: "medium",
  status: "open",
  reportedDate: new Date().toISOString(),
};

describe("Admin update flow", () => {
  it("submits assign action", () => {
    cy.intercept("POST", "**/api/reports/*", { statusCode: 200, body: { data: { ok: true } } }).as("updateReport");

    cy.visit("/incidents", {
      onBeforeLoad(win) {
        win.localStorage.setItem("dash:incidents", JSON.stringify([incident]));
      },
    });

    cy.contains("button", "Details").click();
    cy.contains("button", "Assign").click();
    cy.wait("@updateReport").its("request.body").should((body) => {
      expect(body).to.have.property("status", "assigned");
    });
  });
});
