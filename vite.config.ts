import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => ({
  base:
    process.env.VITE_BASE_PATH || (mode === "demo" ? "/florist-market/" : "/"),
  define: {
    "import.meta.env.VITE_BROWSER_DEMO": JSON.stringify(
      mode === "demo" ? "true" : "false",
    ),
  },
  plugins: [react()],
  server: { host: "127.0.0.1" },
  build: { outDir: "dist", sourcemap: false },
}));
