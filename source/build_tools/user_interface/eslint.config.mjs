import eslint from "@eslint/js";
import globals from "globals";
import path from "path";
import unicornPlugin from "eslint-plugin-unicorn";
import { configs as commentLengthConfigs } from "eslint-plugin-comment-length";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

// Initialise the compatibility utility with a string base directory.
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const compatibility = new FlatCompat({ baseDirectory: __dirname });

// Define the project root directory (5 levels up from the current directory).
const projectRoot = path.resolve(__dirname, "../../../../..");  // eslint-disable-line no-unused-vars

export default [
    eslint.configs.recommended,
    ...compatibility.config(commentLengthConfigs.recommended),
    {
        ignores: [],
    },
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: {
                ...globals.browser,
                ...globals.es2025,
                ...globals.node,
            },
        },
        plugins: {
            unicorn: unicornPlugin,
        },
        rules: {
            "camelcase": "error",
            "comma-dangle": ["error", "always-multiline"],
            "comment-length/limit-multi-line-comments": ["warn", { maxLength: 100 }],
            "comment-length/limit-single-line-comments": ["warn", { maxLength: 100 }],
            "eqeqeq": ["error", "always"],
            "indent": ["error", 4, { SwitchCase: 1 }],
            "no-console": "warn",
            "no-multi-spaces": "off",
            "no-redeclare": ["error", { "builtinGlobals": false }],
            "no-unexpected-multiline": "off",
            "object-curly-spacing": ["error", "always"],
            "prefer-const": "error",
            "quotes": ["warn", "double", { allowTemplateLiterals: true }],
            "semi": ["error", "always"],
            "sort-vars": "error",
            "space-before-function-paren": ["error", "always"],
            "unicorn/no-unused-properties": "error",
        },
    },
];
