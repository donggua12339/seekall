// 觅源 SeekAll - 通用表格行类型（admin 后台列表页共用）
// 重构恢复文件（GLM 5.2 版本丢失，按引用 admin 文件重建）

export interface TableRow {
  id: string | number | bigint
  [key: string]: unknown
}
