import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "react/no-unescaped-entities": "off",
      "react-hooks/exhaustive-deps": "warn",
      "prefer-const": "off",
      "@typescript-eslint/no-unused-vars": "warn"
    }
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "*.js",
    "**/*.js",
    "scratch/**",
    "scripts/**",
    "old-sheets-api.ts",
    ".partykit/**",
    ".wrangler/**",
    ".swc/**",
    "test-results/**",
    "playwright-report/**",
    "hchps-work-manager/**",
    "functions/**"
  ]),
]);

export default eslintConfig;
