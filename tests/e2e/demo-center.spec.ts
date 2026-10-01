import { expect, test } from "@playwright/test";
import { demoIds } from "../../src/features/demo-center/datasets";
import { getDemo } from "../../src/features/demo-center/model";
import { simulateImprovement } from "../../src/core/process/simulation";
import { formatDuration } from "../../src/features/process-explorer/formatters";

test("central filters school and company without mixing processes", async ({
  page,
}, info) => {
  await page.goto("/demo/center");
  await expect(
    page.getByRole("heading", { name: "Da operação à próxima decisão." }),
  ).toBeVisible();
  await expect(
    page.getByText("Dados sintéticos utilizados para fins demonstrativos.", {
      exact: false,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("center-desktop.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Escola", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Matrículas", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Mensalidades", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Chamados empresariais", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Empresa", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Chamados empresariais", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Matrículas", exact: true }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("center-mobile.png"),
    fullPage: true,
  });
});
for (const id of demoIds)
  test(`${id}: complete guided journey, real export, neutral scenario and reset`, async ({
    page,
    request,
  }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const { dataset, result } = getDemo(id);
    await page.goto(`/demo/center/${id}`);
    await expect(
      page.getByRole("heading", { name: dataset.name, exact: true }),
    ).toBeVisible();
    const download = page.getByRole("link", { name: "Baixar CSV sintético" });
    const response = await request.get((await download.getAttribute("href"))!);
    expect(response.ok()).toBe(true);
    expect((await response.text()).trim().split(/\r?\n/)).toHaveLength(
      dataset.records.length + 1,
    );
    await page
      .getByRole("button", { name: "Continuar →", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "O processo descoberto nos eventos" }),
    ).toBeFocused();
    await expect(
      page.getByRole("button", { name: "Aumentar zoom" }),
    ).toBeVisible();
    await page.screenshot({
      path: info.outputPath(`${id}-process.png`),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Continuar →", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: result.bottleneck!.activity,
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Continuar →", exact: true })
      .click();
    const slider = page.getByRole("slider", { name: "Redução do intervalo" });
    await slider.focus();
    await slider.press("Home");
    await expect(slider).toHaveValue("0");
    const comparison = page.getByTestId("scenario-comparison");
    await expect(comparison).toContainText("0min de redução (0.0%)");
    await slider.press("End");
    await page
      .getByRole("combobox", { name: "Capacidade estimada" })
      .selectOption("1.5");
    const calculated = simulateImprovement(dataset.records, {
      name: "Check",
      activityAdjustments: {
        [result.bottleneck!.activity]: {
          waitReductionPct: 80,
          capacityMultiplier: 1.5,
        },
      },
      slaThresholdSeconds: dataset.slaHours * 3600,
    });
    await expect(comparison).toContainText(
      formatDuration(calculated.simulated.avgCycleSeconds),
    );
    await page
      .getByRole("button", { name: "Continuar →", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Da hipótese à decisão", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Estimativa baseada no modelo", { exact: false }),
    ).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`${id}-impact-mobile.png`),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Reiniciar apresentação", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "O ponto de partida: registros operacionais",
      }),
    ).toBeVisible();
    await page
      .getByRole("navigation", { name: "Etapas da apresentação" })
      .getByRole("button")
      .nth(3)
      .click();
    await expect(slider).toHaveValue("30");
    await expect(
      page.getByRole("combobox", { name: "Capacidade estimada" }),
    ).toHaveValue("1");
    for (let index = 0; index < 5; index++) {
      await page
        .getByRole("navigation", { name: "Etapas da apresentação" })
        .getByRole("button")
        .nth(index)
        .click();
      const overflow = await page.evaluate(() => ({
        width: window.innerWidth,
        scroll: document.documentElement.scrollWidth,
        elements: Array.from(document.querySelectorAll("main *"))
          .filter(
            (element) =>
              element.getBoundingClientRect().right > window.innerWidth + 1 &&
              getComputedStyle(element).position !== "absolute",
          )
          .slice(0, 8)
          .map((element) => element.className),
      }));
      expect(
        overflow.scroll,
        `Mobile stage ${index}: ${JSON.stringify(overflow)}`,
      ).toBeLessThanOrEqual(overflow.width);
    }
    await page
      .getByRole("navigation", { name: "Etapas da apresentação" })
      .getByRole("button")
      .nth(1)
      .click();
    await page.screenshot({
      path: info.outputPath(`${id}-process-mobile.png`),
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
test("invalid demonstration returns a recoverable 404", async ({ page }) => {
  const response = await page.goto("/demo/center/unknown");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Demonstração não encontrada" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Voltar à central" }).click();
  await expect(
    page.getByRole("heading", { name: "Da operação à próxima decisão." }),
  ).toBeVisible();
});
