// NOT RUN in the sandbox this was written in (no browser download available there).
// To use:  npm i -D @playwright/test && npx playwright install chromium && npx playwright test e2e
// Start the app first:  npm run build && npx next start -p 3111
import { test, expect } from "@playwright/test";
const base = process.env.BASE_URL ?? "http://localhost:3111";

test("gravity bridge sliders change the readout and the page says it is unvalidated", async ({ page }) => {
  await page.goto(`${base}/gravity-bridge`);
  await expect(page.getByText("Unvalidated hypothesis")).toBeVisible();
  const before = await page.locator("[aria-live=polite]").first().innerText();
  await page.getByLabel(/Oxygen:/).fill("30");
  await expect(page.locator("[aria-live=polite]").first()).not.toHaveText(before);
});

test("materials check grades an unknown material as no evidence", async ({ page }) => {
  await page.goto(`${base}/materials`);
  await expect(page.getByText("No evidence").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Download CSV" })).toBeVisible();
});

test("brief downloads markdown", async ({ page }) => {
  await page.goto(`${base}/brief`);
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download Markdown" }).click()]);
  expect(dl.suggestedFilename()).toBe("microfire-mission-brief.md");
});

test("unseen map cell can be selected and explains itself", async ({ page }) => {
  await page.goto(`${base}/unseen`);
  await page.getByRole("button", { name: /0.25 centimetres per second/ }).first().click();
  await expect(page.getByText(/dim blue/).first()).toBeVisible();
});
