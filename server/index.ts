import express from "express";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { ZodError } from "zod";
import { openDatabase } from "./db";
import { DomainError, StoreService } from "./service";
import { seed } from "./seed";
import type { Operation } from "../shared/types";

const port = Number(process.env.PORT ?? 4173);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("PORT должен быть числом от 1024 до 65535");
const db = openDatabase(resolve(process.env.DB_PATH ?? "data/florist.sqlite"));
const service = new StoreService(db);
seed(service);
const app = express();
app.disable("x-powered-by");
const csrfToken = randomBytes(32).toString("hex");
app.use((req, res, next) => {
  const host = req.headers.host;
  if (host !== `localhost:${port}` && host !== `127.0.0.1:${port}`) {
    res
      .status(403)
      .json({ error: "Доступ разрешён только с этого компьютера" });
    return;
  }
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Cross-Origin-Resource-Policy": "same-origin",
  });
  if (req.path.startsWith("/api/")) {
    res.set("Cache-Control", "no-store");
    const origin = req.headers.origin;
    if (
      (origin &&
        origin !== `http://127.0.0.1:${port}` &&
        origin !== `http://localhost:${port}`) ||
      req.headers["sec-fetch-site"] === "cross-site"
    ) {
      res.status(403).json({ error: "Запрос с другого сайта отклонён" });
      return;
    }
    if (req.method !== "GET" && req.headers["x-csrf-token"] !== csrfToken) {
      res
        .status(403)
        .json({ error: "Обновите страницу перед выполнением операции" });
      return;
    }
  }
  next();
});
app.use(express.json({ limit: "100kb" }));
app.get("/api/health", (_req, res) => res.json({ status: "ok", mode: "demo" }));
app.get("/api/state", (_req, res) =>
  res.json({ ...service.state(), csrfToken }),
);
app.post("/api/operations/:operation", (req, res) => {
  try {
    const result = service.execute(
      req.params.operation as Operation,
      req.body,
      req.headers["idempotency-key"] as string,
    );
    res.json({ result, state: { ...service.state(), csrfToken } });
  } catch (e) {
    if (e instanceof ZodError) {
      res.status(400).json({
        error: `Проверьте поля: ${e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
      });
    } else if (e instanceof DomainError) {
      res.status(409).json({ error: e.message });
    } else {
      console.error(
        "Operation failed:",
        e instanceof Error ? e.message : "unknown",
      );
      res
        .status(500)
        .json({ error: "Не удалось провести операцию. Данные не изменены." });
    }
  }
});
app.use("/api", (_req, res) =>
  res.status(404).json({ error: "Маршрут не найден" }),
);
if (process.argv.includes("--dev")) {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  const dist = resolve("dist");
  if (!existsSync(resolve(dist, "index.html")))
    throw new Error("Сначала выполните npm run build");
  app.use((_req, res, next) => {
    res.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
    );
    next();
  });
  app.use(express.static(dist));
  app.get("/{*path}", (_req, res) => res.sendFile(resolve(dist, "index.html")));
}
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    res.status(400).json({
      error:
        err instanceof SyntaxError
          ? "Некорректный JSON"
          : "Некорректный запрос",
    });
  },
);
const server = app.listen(port, "127.0.0.1", () =>
  console.log(
    `Флорист Маркет: http://127.0.0.1:${port}\nУчебный режим · данные сохраняются локально`,
  ),
);
function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
