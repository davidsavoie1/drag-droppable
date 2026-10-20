import globals from "globals";
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import svelte from "eslint-plugin-svelte";

export default [
  js.configs.recommended,
  ...svelte.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
      globals: {
        ...globals.browser,
      },
      sourceType: "module",
    },
  },
  {
    files: ["src/**/*.js"],
    rules: {
      "no-console": "warn",
      "no-unused-vars": ["error", { ignoreRestSiblings: true }],
    },
  },
  {
    ignores: ["dist", "node_modules"],
  },
  prettier, // disables style rules in ESLint that conflict with Prettier
];
