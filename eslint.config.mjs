import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Stray console.log/info never reaches a log drain with a severity —
      // route through `@/lib/logger`. warn/error carry their own level.
      "no-console": ["warn", { allow: ["warn", "error"] }],
      // `const { a: _a, ...rest } = props` is the idiom for stripping props
      // before spreading; an underscore prefix marks the intentional discard.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    // @react-pdf/renderer's <Image> is a PDF primitive with no alt prop.
    files: ["src/components/pdf/**"],
    rules: { "jsx-a11y/alt-text": "off" },
  },
  {
    // One-off CLI scripts report to the terminal; console is their output.
    files: ["scripts/**"],
    rules: { "no-console": "off" },
  },
]);

export default eslintConfig;
