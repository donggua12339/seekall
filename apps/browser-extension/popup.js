/**
 * 觅源 SeekAll 浏览器插件 - 弹窗逻辑
 */

const API_URL = 'https://seekall.winmelon.cn' // 生产环境地址

const searchInput = document.getElementById('searchInput') as HTMLInputElement
const resultsDiv = document.getElementById('results') as HTMLDivElement

let searchTimer: ReturnType<typeof setTimeout> | null = null

searchInput.addEventListener('input', () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(doSearch, 500)
})

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    if (searchTimer) clearTimeout(searchTimer)
    doSearch()
  }
})

interface SearchResultItem {
  title: string
  url: string
  source: string
  sourceDisplayName: string
  category: string
  fileType?: string
  resourceMeta?: {
    password?: string | null
  }
}

interface SearchResponse {
  list: SearchResultItem[]
  total: number
  durationMs: number
  providers: string[]
}

async function doSearch() {
  const keyword = searchInput.value.trim()
  if (!keyword) {
    resultsDiv.innerHTML = '<div class="empty">输入关键词开始搜索</div>'
    return
  }

  resultsDiv.innerHTML = '<div class="loading">搜索中...</div>'

  try {
    const url = new URL('/api/v1/search', API_URL)
    url.searchParams.set('keyword', keyword)
    url.searchParams.set('page', '1')
    url.searchParams.set('pageSize', '20')

    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const data = (await res.json()) as { code: number; data: SearchResponse }
    if (data.code !== 0 || !data.data) {
      resultsDiv.innerHTML = '<div class="empty">搜索失败</div>'
      return
    }

    renderResults(data.data, keyword)
  } catch (err) {
    resultsDiv.innerHTML = `<div class="empty">搜索失败: ${(err as Error).message}</div>`
  }
}

function renderResults(results: SearchResponse, keyword: string) {
  if (results.list.length === 0) {
    resultsDiv.innerHTML = `<div class="empty">"${keyword}" 无结果</div>`
    return
  }

  const html = results.list
    .map((item) => {
      const password = item.resourceMeta?.password
        ? `<span class="password">🔑 ${item.resourceMeta.password}</span>`
        : ''
      return `
        <div class="result-item" data-url="${escapeHtml(item.url)}">
          <div class="result-title">${escapeHtml(item.title)}</div>
          <div class="result-meta">
            <span class="tag">${escapeHtml(item.sourceDisplayName)}</span>
            ${item.fileType ? `<span>${escapeHtml(item.fileType)}</span>` : ''}
            ${password}
          </div>
        </div>
      `
    })
    .join('')

  resultsDiv.innerHTML = html

  // 点击打开链接
  resultsDiv.querySelectorAll('.result-item').forEach((el) => {
    el.addEventListener('click', () => {
      const url = el.getAttribute('data-url')
      if (url) {
        // 先复制提取码（如果有），再打开链接
        chrome.tabs.create({ url })
      }
    })
  })
}

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// 如果有选中的文字，自动填入搜索框
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  chrome.scripting?.executeScript?.(
    { target: { tabId: tabs[0].id }, func: () => window.getSelection()?.toString() },
    (results) => {
      const selected = results?.[0]?.result
      if (selected && selected.trim()) {
        searchInput.value = selected.trim()
        doSearch()
      }
    },
  )
})
