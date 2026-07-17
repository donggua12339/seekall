// 根 ESLint 配置 - 仅作为 root barrier 阻止向上查找
// v0.5: 各 app 自带 .eslintrc（apps/api/.eslintrc.js），根目录无业务代码
module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
  rules: {},
  ignorePatterns: [
    "node_modules/",
    "dist/",
    "build/",
    "apps/docs-site/",
    "packages/",
    "*.config.cjs",
    ".lintstagedrc.cjs",
  ],
};
