import { expect, test } from "@playwright/test";

test("demo goes from 100 to 120 events; repeated export skips analysis", async ({page}) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto("/demo/sync");
  await page.getByRole("button", {name:"1. Sincronizar orders-sync-01.csv"}).click();
  await expect(page.getByRole("heading", {name:"Live Dataset: 100 eventos"})).toBeVisible();
  await page.getByRole("button", {name:"2. Sincronizar orders-sync-02.csv"}).click();
  await expect(page.getByRole("heading", {name:"Live Dataset: 120 eventos"})).toBeVisible();
  await expect(page.getByText("2 análises executadas.", {exact:false})).toBeVisible();
  await page.getByRole("button", {name:"2. Sincronizar orders-sync-02.csv"}).click();
  await expect(page.getByRole("heading", {name:"Nenhuma mudança detectada."})).toBeVisible();
  await expect(page.getByRole("heading", {name:"Live Dataset: 120 eventos"})).toBeVisible();
  await expect(page.getByText("2 análises executadas.", {exact:false})).toBeVisible();
  await expect(page.getByText("Nova análise executada:", {exact:false})).toContainText("Não");
  expect(errors).toEqual([]);
});

test("pilot switches to school examples and offers a usable CSV", async ({page,request}) => {
  await page.goto("/pilot");
  await page.getByRole("button", {name:"Escola",exact:true}).click();
  await expect(page.getByRole("heading", {name:"Matrículas",exact:true})).toBeVisible();
  const link=page.getByRole("link", {name:"Baixar primeira exportação"});
  const href=await link.getAttribute("href");
  expect(href).toBe("/examples/pilot/enrollment-sync-01.csv");
  const file=await request.get(href!); expect(file.ok()).toBe(true);
  const rows=(await file.text()).trim().split(/\r?\n/);
  expect(rows[0]).toBe("event_id,matricula_id,etapa,data_evento,responsavel");
  expect(rows).toHaveLength(101);
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("anonymous connector visit preserves its intended login destination", async ({page}) => {
  const destination="/processes/00000000-0000-4000-8000-000000000001/connectors";
  await page.goto(destination);
  await expect(page.getByRole("heading", {name:"Entre no ProcessTwin"})).toBeVisible();
  expect(new URL(page.url()).searchParams.get("next")).toBe(destination);
});

test("existing public journeys remain accessible", async ({page}) => {
  const errors: string[]=[]; page.on("pageerror",error=>errors.push(error.message));
  for(const route of ["/", "/auth", "/processes/new", "/demo", "/demo/intake", "/demo/explorer", "/demo/simulation"]){
    const response=await page.goto(route); expect(response?.ok()).toBe(true);
    await expect(page.locator("h1").first()).toBeVisible();
  }
  expect(errors).toEqual([]);
});
