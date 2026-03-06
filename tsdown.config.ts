import { defineConfig } from "tsdown";

export default defineConfig([
  {
    entry: "src/index.ts",
    target: "es6",
    format: "esm",
    sourcemap: true,
    publint: true,
    platform: "browser",
    copy: "src/index.css",
    deps: {
      onlyAllowBundle: [],
    },
  },
  {
    entry: "src/index-umd.ts",
    target: "es6",
    format: "umd",
    outputOptions: {
      name: "CriiptoAuth",
      exports: "default",
    },
    platform: "browser",
    deps: { alwaysBundle: ["*"] },
  },
]);
