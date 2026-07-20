// 觅源 SeekAll - lint-staged 配置
// v0.5: docs-site 是 vitepress 静态站，packages 是 SDK + 规则包，apps/admin 是 Vue3 SPA
// 三者均不参与项目 lint（用各自的工具链）
// 路径含空格（Claude Code Haha），每个文件路径必须用引号包起来
// lint-staged 传的是绝对路径，filter 用 includes 判断
const isProjectFile = (p) => {
  const n = p.replace(/\\/g, "/");
  return (
    !n.includes("/apps/docs-site/") &&
    !n.includes("/apps/admin/") &&
    !n.includes("/apps/user-spa/") &&
    !n.includes("/packages/")
  );
};
const quote = (p) => `"${p}"`;

module.exports = {
  "*.{ts,tsx}": (files) => {
    const f = files.filter(isProjectFile).map(quote);
    return f.length === 0
      ? []
      : [`eslint --fix ${f.join(" ")}`, `prettier --write ${f.join(" ")}`];
  },
  "*.{vue,js,cjs}": (files) => {
    const f = files.filter(isProjectFile).map(quote);
    return f.length === 0
      ? []
      : [`eslint --fix ${f.join(" ")}`, `prettier --write ${f.join(" ")}`];
  },
  "*.{json,md,css,scss}": (files) => {
    const f = files.filter(isProjectFile).map(quote);
    return f.length === 0 ? [] : [`prettier --write ${f.join(" ")}`];
  },
};
