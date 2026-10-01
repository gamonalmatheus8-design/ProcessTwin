import { expect, test } from "@playwright/test";
import {
  demoSyncIdentity,
  demoSyncMapping,
  ordersSync01,
} from "../../src/features/sync/demo-data";
import { prepareRecurringCsv } from "../../src/features/sync/recurring-csv";
const hash = prepareRecurringCsv(
  ordersSync01,
  demoSyncMapping,
  demoSyncIdentity,
).schemaHash;
test("Sheets browser setup requires preview, mapping and explicit confirmation (synthetic API fixture)", async ({
  page,
}, info) => {
  const actions: Record<string, unknown>[] = [];
  await page.route("**/api/processes/*/sheets", async (route) => {
    const body = route.request().postDataJSON();
    actions.push(body);
    const value =
      body.action === "status"
        ? { connected: true }
        : body.action === "preview"
          ? {
              sampleCsv: ordersSync01,
              total: 100,
              schemaHash: hash,
              savedMapping: null,
            }
          : {
              connectorId: "new",
              datasetId: "dataset",
              run: {
                id: "run",
                status: "succeeded",
                accepted_count: 100,
                updated_count: 0,
                duplicate_count: 0,
                invalid_count: 0,
                fetched_count: 100,
                analysis_status: "succeeded",
              },
              message: "Sincronização concluída.",
            };
    await route.fulfill({ json: value });
  });
  await page.goto("/test-fixtures/sheets");
  await page
    .getByRole("button", { name: "Google Sheets", exact: false })
    .click();
  await page
    .getByLabel("Link ou ID da planilha")
    .fill("https://docs.google.com/spreadsheets/d/" + "a".repeat(30));
  await page.getByLabel("Nome exato da aba").fill("Orders");
  await page.getByLabel("Sincronizar diariamente").check();
  await page
    .getByRole("button", { name: "Carregar amostra para revisão" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Confirme o mapeamento" }),
  ).toBeVisible();
  await expect(page.getByLabel("ID estável do evento")).toHaveValue("event_id");
  expect(actions.some((a) => a.action === "create")).toBe(false);
  await page.getByRole("button", { name: "Revisar confirmação" }).click();
  await expect(
    page.getByRole("heading", { name: "Confirmação da fonte" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("sheets-confirm-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Confirmar e sincronizar" }).click();
  expect(actions.find((a) => a.action === "create")).toEqual(
    expect.objectContaining({
      confirmed: true,
      schedule: 1440,
      schemaHash: hash,
      identity: demoSyncIdentity,
    }),
  );
  await expect(
    page.getByText("Sincronização concluída.", { exact: true }),
  ).toBeVisible();
});
test("paused Sheets history exposes scheduled failure and review preserves the stable ID (synthetic API fixture)", async ({
  page,
}, info) => {
  let review: Record<string, unknown> | undefined;
  await page.route("**/api/processes/*/sheets", async (route) => {
    const body = route.request().postDataJSON();
    if (body.action === "review") review = body;
    await route.fulfill({
      json:
        body.action === "status"
          ? { connected: true }
          : body.action === "preview"
            ? {
                sampleCsv: ordersSync01,
                total: 100,
                schemaHash: hash,
                savedMapping: {
                  canonical_mapping: demoSyncMapping,
                  identity_config: demoSyncIdentity,
                },
              }
            : {
                connectorId: body.connectorId,
                datasetId: "dataset",
                run: {
                  id: "run",
                  status: "succeeded",
                  accepted_count: 0,
                  updated_count: 0,
                  duplicate_count: 100,
                  invalid_count: 0,
                  fetched_count: 100,
                  analysis_status: "skipped",
                },
                message: "Nenhuma mudança detectada.",
              },
    });
  });
  await page.goto("/test-fixtures/sheets");
  await expect(
    page.getByRole("button", { name: "Sincronizar agora" }),
  ).toBeDisabled();
  await expect(page.getByText("Agendada", { exact: true })).toBeVisible();
  await expect(page.getByText("5s", { exact: true })).toBeVisible();
  await page.screenshot({
    path: info.outputPath("sheets-history-desktop.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Revisar / reconectar" }).click();
  await page
    .getByRole("button", { name: "Carregar amostra para revisão" })
    .click();
  await expect(page.getByLabel("ID estável do evento")).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("sheets-review-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Revisar confirmação" }).click();
  await page.getByRole("button", { name: "Confirmar e sincronizar" }).click();
  expect(review).toEqual(
    expect.objectContaining({
      confirmed: true,
      connectorId: "22222222-2222-4222-8222-222222222222",
    }),
  );
  await expect(
    page.getByText("Nenhuma mudança detectada.", { exact: true }),
  ).toBeVisible();
});
