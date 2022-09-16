module.exports = {
  parserOptions: {
    sourceType: "module"
  },
  parser: "@typescript-eslint/parser",
  env: {
    browser: true,
    es6: true
  },
  extends: "eslint:recommended",
  overrides: [
    {
      files: ["test/**"],
      plugins: ["jest"],
      extends: ["plugin:jest/recommended"],
      rules: { "jest/prefer-expect-assertions": "off" }
    }
  ],
  rules: {}
}