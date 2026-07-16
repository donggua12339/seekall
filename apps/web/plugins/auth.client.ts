// 觅源 SeekAll - 客户端 auth 插件
// 客户端启动时自动从 localStorage 恢复登录态
// 重构恢复文件（GLM 5.2 版本丢失，重建最小可用版本）

export default defineNuxtPlugin(() => {
  const authStore = useAuthStore()
  authStore.loadFromStorage()
})
