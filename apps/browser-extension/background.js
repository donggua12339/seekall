/**
 * 觅源 SeekAll 浏览器插件 - 后台 Service Worker
 * - 右键菜单搜索
 * - 地址栏 omnibox 搜索
 */

const API_URL = 'https://seekall.winmelon.cn'

// 创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'seekall-search',
    title: '用 SeekAll 搜索 "%s"',
    contexts: ['selection'],
  })
})

// 右键菜单点击
chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === 'seekall-search' && info.selectionText) {
    const keyword = encodeURIComponent(info.selectionText)
    chrome.tabs.create({
      url: `${API_URL}/search?q=${keyword}`,
    })
  }
})

// 地址栏 omnibox 搜索
chrome.omnibox.onInputEntered.addListener((text) => {
  const keyword = encodeURIComponent(text.trim())
  chrome.tabs.update({
    url: `${API_URL}/search?q=${keyword}`,
  })
})

chrome.omnibox.setDefaultSuggestion({
  description: '用 SeekAll 搜索资源',
})
