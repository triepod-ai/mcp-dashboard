import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      // TypeScript rules that work without type information
      "@typescript-eslint/no-explicit-any": "warn", // Warn about any usage, encourage proper typing
      "@typescript-eslint/no-unused-vars": "warn", // Align with compiler unused checks
      "@typescript-eslint/no-non-null-assertion": "warn", // Warn about ! operator usage
      "@typescript-eslint/ban-ts-comment": "warn", // Warn about @ts-ignore usage
      "@typescript-eslint/prefer-as-const": "warn", // Prefer as const assertions
      "@typescript-eslint/no-empty-interface": "warn", // Warn about empty interfaces
      // Note: Rules requiring type information are left to TypeScript compiler
    },
  },
);
