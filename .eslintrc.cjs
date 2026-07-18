// 根 ESLint 配置 - 仅作为 root barrier 阻止向上查找
// v0.5: 各 app 自带 .eslintrc（apps/api/.eslintrc.js），根目录无业务代码
// apps/admin 和 apps/docs-site 用各自的工具链（vite + vue-tsc），不参与根 lint
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
    "apps/admin/",
    "packages/",
    "*.config.cjs",
    ".lintstagedrc.cjs",
  ],
};
