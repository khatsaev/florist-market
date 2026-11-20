import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { request } from "node:http";

test("HTTP API: origin, CSRF, host protection, validation, persisted state and idempotency", async () => {
  const temp = mkdtempSync(join(tmpdir(), "florist-http-"));
  const port = 14873;
  const base = `http://127.0.0.1:${port}`;
  let output = "";
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "server/index.ts"],
    {
      env: {
        ...process.env,
        PORT: String(port),
        DB_PATH: join(temp, "test.sqlite"),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout.on("data", (b) => {
    output += b;
  });
  child.stderr.on("data", (b) => {
    output += b;
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Startup timeout: " + output)),
        10000,
      );
      const done = () => {
        if (output.includes(base)) {
          clearTimeout(timer);
          resolve();
        }
      };
      child.stdout.on("data", done);
      child.once("exit", () => {
        clearTimeout(timer);
        reject(new Error(output));
      });
    });
    const stateResponse = await fetch(base + "/api/state");
    assert.equal(stateResponse.status, 200);
    assert.equal(stateResponse.headers.get("cache-control"), "no-store");
    const state = await stateResponse.json();
    assert.equal(state.mode, "demo");
    assert.equal(state.products.length, 27);
    assert.equal(
      (
        await fetch(base + "/api/state", {
          headers: { Origin: "https://attacker.invalid" },
        })
      ).status,
      403,
    );
    const wrongHost = await new Promise<number | undefined>(
      (resolve, reject) => {
        const r = request(
          base + "/api/state",
          { headers: { Host: "attacker.invalid" } },
          (response) => {
            response.resume();
            resolve(response.statusCode);
          },
        );
        r.on("error", reject);
        r.end();
      },
    );
    assert.equal(wrongHost, 403);
    assert.equal(
      (
        await fetch(base + "/api/operations/finance.create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        })
      ).status,
      403,
    );
    const headers = {
      "Content-Type": "application/json",
      "X-CSRF-Token": state.csrfToken,
      "Idempotency-Key": randomUUID(),
    };
    const bad = await fetch(base + "/api/operations/finance.create", {
      method: "POST",
      headers,
      body: JSON.stringify({
        kind: "expense",
        category: "Test",
        amount: -100,
        description: "Test",
      }),
    });
    assert.equal(bad.status, 400);
    const req = {
      method: "POST",
      headers,
      body: JSON.stringify({
        kind: "expense",
        category: "Проверка API",
        amount: 100,
        description: "Тест API",
      }),
    };
    const first = await (
      await fetch(base + "/api/operations/finance.create", req)
    ).json();
    const second = await (
      await fetch(base + "/api/operations/finance.create", req)
    ).json();
    assert.equal(first.result.id, second.result.id);
    assert.equal(
      second.state.ledger.filter(
        (e: { reference: string }) => e.reference === first.result.id,
      ).length,
      1,
    );
    const root = await fetch(base);
    const importRequest = {
      method: "POST",
      headers: { ...headers, "Idempotency-Key": randomUUID() },
      body: readFileSync(
        new URL(
          "../public/imports/florist-market-catalog.json",
          import.meta.url,
        ),
        "utf8",
      ),
    };
    const importedResponse = await fetch(
      base + "/api/operations/product.import",
      importRequest,
    );
    assert.equal(importedResponse.status, 200);
    const imported = await importedResponse.json();
    assert.equal(imported.result.imported.length, 57);
    assert.equal(imported.state.products.length, 84);
    const repeated = await (
      await fetch(base + "/api/operations/product.import", importRequest)
    ).json();
    assert.deepEqual(repeated.result, imported.result);
    assert.equal(repeated.state.products.length, 84);
    assert.equal(root.status, 200);
    assert.ok(
      root.headers
        .get("content-security-policy")
        ?.includes("frame-ancestors 'none'"),
    );
    assert.ok((await root.text()).includes("Флорист Маркет"));
    assert.equal((await fetch(base + "/api/missing")).status, 404);
  } finally {
    child.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      if (child.exitCode !== null) resolve();
      else child.once("exit", () => resolve());
    });
    rmSync(temp, { recursive: true, force: true });
  }
});
