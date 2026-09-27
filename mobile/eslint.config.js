const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
    expoConfig,
    {
        ignores: [
            "dist-parity/**",
            "test/**",
            "src/**/*.test.ts",
            "node_modules/**",
        ],
    },
]);
