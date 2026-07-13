// 觅源 SeekAll - commitlint 配置
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'chore', 'ci', 'revert'],
    ],
    'subject-max-length': [2, 'always', 100],
    'subject-min-length': [2, 'always', 5],
  },
}
