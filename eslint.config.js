import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["dist/**", "public/vendor/**"],
  },
  js.configs.recommended,
  {
    files: ["**/*.mjs", "public/*.js", "eslint.config.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
];
