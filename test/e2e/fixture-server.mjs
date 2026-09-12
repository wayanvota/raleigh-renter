import { createApp } from "../../src/server.mjs";
import { buildReportFixture, suggestAddressesFixture } from "./fixtures.mjs";

const app = createApp({
  suggestAddressesFn: suggestAddressesFixture,
  buildReportFn: buildReportFixture,
  checkDatabaseFn: async () => ({ ok: true, mode: "disabled" }),
  hasDatabaseFn: () => false
});

const port = Number(process.env.PORT || 3417);
app.listen(port, "127.0.0.1", () => {
  console.log(`Raleigh Renter deterministic E2E server listening on ${port}`);
});
