<script setup>
import { ref, shallowRef, computed, onMounted, onUnmounted, nextTick, watch, triggerRef } from 'vue'

// ---------------------------------------------------------------------------
// 状态
// ---------------------------------------------------------------------------

// 使用 shallowRef 避免深度响应，提升大数组性能
const clipboardHistory = shallowRef([])
const selectedIndex = ref(0)
const searchText = ref('')

// 虚拟滚动相关
const ITEM_HEIGHT = 64
const scrollTop = ref(0)
const viewportHeight = ref(420)
const scrollerRef = ref(null)
const searchRef = ref(null)
const shellRef = ref(null)

let removeClipboardListener = null
let removeShownListener = null
let resizeObserver = null

// ---------------------------------------------------------------------------
// 生命周期
// ---------------------------------------------------------------------------

/**
 * 在mounted时请求剪贴板历史数据
 */
onMounted(async () => {
  clipboardHistory.value = await window.clipboard.initClipboardHistory()
  await nextTick()
  focusOnSearch()
  playEntrance()

  // 监听剪贴板历史数据变化，并保存移除函数
  removeClipboardListener = window.clipboard.onAddClipboardItem((item) => {
    clipboardHistory.value.unshift(item)
    triggerRef(clipboardHistory) // 手动触发更新
  })

  // 窗口每次被唤起时，重放入场动画并把焦点还给搜索框
  if (window.clipboard.onWindowShown) {
    removeShownListener = window.clipboard.onWindowShown(() => {
      playEntrance()
      resetSelectedIndex()
      if (scrollerRef.value) scrollerRef.value.scrollTop = 0
      focusOnSearch()
    })
  }

  // 测量可视区高度，供虚拟滚动使用
  if (scrollerRef.value && typeof ResizeObserver !== 'undefined') {
    viewportHeight.value = scrollerRef.value.clientHeight
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        viewportHeight.value = entry.contentRect.height
      }
    })
    resizeObserver.observe(scrollerRef.value)
  }
})

// 组件卸载时移除监听器
onUnmounted(() => {
  if (removeClipboardListener) {
    removeClipboardListener()
    removeClipboardListener = null
  }
  if (removeShownListener) {
    removeShownListener()
    removeShownListener = null
  }
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
})

// ---------------------------------------------------------------------------
// 交互
// ---------------------------------------------------------------------------

// 搜索框获取焦点
function focusOnSearch() {
  if (searchRef.value) {
    searchRef.value.focus()
  }
}

// 入场动画（每次窗口唤起重放）
function playEntrance() {
  const el = shellRef.value
  if (!el) return
  el.classList.remove('is-entering')
  void el.offsetWidth // 强制重排以重启动画
  el.classList.add('is-entering')
}

/**
 * 将timestamp为timestamp的item移动到第0个位置
 * @param timestamp
 */
function moveToTop(timestamp) {
  const index = clipboardHistory.value.findIndex((item) => item.timestamp === timestamp)
  if (index !== -1) {
    const deletedItem = clipboardHistory.value.splice(index, 1)[0]
    clipboardHistory.value.unshift(deletedItem)
    triggerRef(clipboardHistory) // 手动触发更新
  }
}

// 判断一个项目是否有有效内容
function hasValidContent(item) {
  if (item.type === 'image' && item.image_url) return true
  if (item.type === 'files' && item.file_paths && item.file_paths.length > 0) return true
  if (item.text) return true
  return false
}

// 计算属性:根据搜索框内容剪贴板历史
const filteredHistory = computed(() => {
  // 先过滤掉空记录
  const validHistory = clipboardHistory.value.filter(hasValidContent)

  if (!searchText.value) return validHistory
  const lowerCaseSearch = searchText.value.toLowerCase()
  return validHistory.filter((item) => {
    if (item.type === 'text') {
      // 防止 item.text 为 null/undefined
      return (item.text || '').toLowerCase().includes(lowerCaseSearch)
    } else if (item.type === 'files') {
      // 防止 item.file_paths 为 null/undefined
      return (item.file_paths || []).join('\n').toLowerCase().includes(lowerCaseSearch)
    }
    return false
  })
})

function resetSelectedIndex() {
  selectedIndex.value = 0
}

// 处理点击列表项 - 使用 timestamp 而非 index 来定位
async function handleClickItem(timestamp) {
  // 找到项目在 filteredHistory 中的实际索引
  const index = filteredHistory.value.findIndex((item) => item.timestamp === timestamp)
  if (index === -1) return
  selectedIndex.value = index
  window.clipboard.write2Clipboard(timestamp)
  moveToTop(timestamp)
  focusOnSearch()
  resetSelectedIndex()
}

// 处理键盘事件列表项
async function handleKeyDown(event) {
  if (event.key === 'ArrowUp') {
    event.preventDefault()
    selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
  } else if (event.key === 'ArrowDown') {
    event.preventDefault()
    // 防止越界：当列表为空时不处理
    if (filteredHistory.value.length === 0) return
    selectedIndex.value = Math.min(selectedIndex.value + 1, filteredHistory.value.length - 1)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    // 防止空数组访问
    if (filteredHistory.value.length === 0) return
    const selectedItem = filteredHistory.value[selectedIndex.value]
    if (!selectedItem) return
    const selectedItemTimestamp = selectedItem.timestamp
    moveToTop(selectedItemTimestamp)
    window.clipboard.write2Clipboard(selectedItemTimestamp)
    resetSelectedIndex()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    if (window.clipboard.hideWindow) {
      window.clipboard.hideWindow()
    }
  }
}

function onScroll(event) {
  scrollTop.value = event.target.scrollTop
}

// ---------------------------------------------------------------------------
// 虚拟滚动
// ---------------------------------------------------------------------------

const totalHeight = computed(() => filteredHistory.value.length * ITEM_HEIGHT)
const overscan = 4
const startIndex = computed(() =>
  Math.max(0, Math.floor(scrollTop.value / ITEM_HEIGHT) - overscan)
)
const endIndex = computed(() =>
  Math.min(
    filteredHistory.value.length,
    Math.ceil((scrollTop.value + viewportHeight.value) / ITEM_HEIGHT) + overscan
  )
)
const visibleItems = computed(() => {
  const list = []
  for (let i = startIndex.value; i < endIndex.value; i++) {
    const item = filteredHistory.value[i]
    if (item) list.push({ item, index: i })
  }
  return list
})

// 监听selectedIndex变化，让对应的列项滚动到可视区域
watch(selectedIndex, async () => {
  await nextTick()
  const el = scrollerRef.value
  if (!el) return
  const top = selectedIndex.value * ITEM_HEIGHT
  const bottom = top + ITEM_HEIGHT
  if (top < el.scrollTop) {
    el.scrollTop = top
  } else if (bottom > el.scrollTop + el.clientHeight) {
    el.scrollTop = bottom - el.clientHeight
  }
})

// 监听搜索内容变化，重置选中索引并回到顶部
watch(searchText, () => {
  selectedIndex.value = 0
  if (scrollerRef.value) scrollerRef.value.scrollTop = 0
})

// ---------------------------------------------------------------------------
// 展示辅助
// ---------------------------------------------------------------------------

const TYPE_LABEL = {
  text: '文本',
  files: '文件',
  image: '图像',
  unknown: '内容'
}

function typeLabel(item) {
  return TYPE_LABEL[item.type] || TYPE_LABEL.unknown
}

// 取路径末尾的文件名，兼容 Windows / macOS 分隔符
function baseName(filePath) {
  if (!filePath) return ''
  const parts = String(filePath).split(/[\\/]/)
  return parts[parts.length - 1] || filePath
}

// 文件标题：最多展示 3 个文件名
function fileTitle(item) {
  const paths = item.file_paths || []
  const names = paths.slice(0, 3).map(baseName)
  const rest = paths.length - names.length
  return rest > 0 ? `${names.join('、')} 等 ${paths.length} 项` : names.join('、')
}

function timeAgo(timestamp) {
  if (!timestamp) return ''
  const diff = Date.now() - timestamp
  const minute = Math.floor(diff / 60000)
  if (minute < 1) return '刚刚'
  if (minute < 60) return `${minute} 分钟前`
  const hour = Math.floor(minute / 60)
  if (hour < 24) return `${hour} 小时前`
  const day = Math.floor(hour / 24)
  return `${day} 天前`
}

function clearSearch() {
  searchText.value = ''
  focusOnSearch()
}
</script>

<template>
  <div ref="shellRef" class="shell">
    <!-- 搜索 -->
    <header class="header">
      <div class="search" :class="{ 'is-focused': searchText.length > 0 }">
        <svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="M15.8 15.8 20 20" />
        </svg>
        <input
          ref="searchRef"
          v-model="searchText"
          class="search-input"
          type="text"
          placeholder="搜索剪贴板历史"
          spellcheck="false"
          autofocus
          @keydown="handleKeyDown"
        />
        <button v-if="searchText" class="search-clear" title="清空" @click="clearSearch">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="8" />
            <path d="M9.6 9.6l4.8 4.8M14.4 9.6l-4.8 4.8" />
          </svg>
        </button>
      </div>
    </header>

    <!-- 列表 -->
    <div ref="scrollerRef" class="scroller" @scroll.passive="onScroll">
      <div
        v-if="filteredHistory.length === 0"
        class="empty"
        :style="{ height: viewportHeight + 'px' }"
      >
        <svg class="empty-icon" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4.5" y="4" width="15" height="16" rx="3" />
          <path d="M8.5 4V3.2c0-.4.3-.7.7-.7h5.6c.4 0 .7.3.7.7V4" />
          <path d="M9 10.5h6M9 14h4" />
        </svg>
        <p class="empty-title">{{ searchText ? '没有匹配的结果' : '剪贴板还是空的' }}</p>
        <p class="empty-sub">
          {{ searchText ? '换个关键词试试' : '复制任意内容，它会自动出现在这里' }}
        </p>
      </div>

      <div v-else class="spacer" :style="{ height: totalHeight + 'px' }">
        <div class="window-slice" :style="{ transform: `translateY(${startIndex * ITEM_HEIGHT}px)` }">
          <div
            v-for="{ item, index } in visibleItems"
            :key="item.timestamp"
            class="row"
            :class="{ 'is-active': selectedIndex === index }"
            @click="handleClickItem(item.timestamp)"
          >
            <div class="icon" :data-type="item.type">
              <!-- 文本 -->
              <svg v-if="item.type === 'text'" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6.5 3.5h7l4.5 4.5V20a.5.5 0 0 1-.5.5H7a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5Z" />
                <path d="M13.5 3.5V8h4.5" />
                <path d="M9 12.5h6M9 16h4" />
              </svg>
              <!-- 文件 -->
              <svg v-else-if="item.type === 'files'" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M3.5 7.5a2 2 0 0 1 2-2h3.2l2 2.4h7.8a2 2 0 0 1 2 2v7.6a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2V7.5Z"
                />
              </svg>
              <!-- 图像 -->
              <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
                <circle cx="8.6" cy="9.6" r="1.5" />
                <path d="M4 16.5l4.4-4.2 3 2.8 3-2.6L20 16.5" />
              </svg>
            </div>

            <div class="content">
              <template v-if="item.type === 'text'">
                <p class="title">{{ item.text }}</p>
                <p class="sub">{{ typeLabel(item) }} · {{ timeAgo(item.timestamp) }}</p>
              </template>

              <template v-else-if="item.type === 'files'">
                <p class="title">{{ fileTitle(item) }}</p>
                <p class="sub">
                  {{ item.file_paths.length }} 个文件 · {{ timeAgo(item.timestamp) }}
                </p>
              </template>

              <template v-else>
                <p class="title">图像</p>
                <p class="sub">{{ typeLabel(item) }} · {{ timeAgo(item.timestamp) }}</p>
              </template>
            </div>

            <div v-if="item.type === 'image' && item.image_url" class="thumb">
              <img :src="item.image_url" alt="" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 状态栏 -->
    <footer class="footer">
      <div class="hints">
        <span class="hint"><kbd>↑</kbd><kbd>↓</kbd> 选择</span>
        <span class="hint"><kbd>⏎</kbd> 粘贴</span>
        <span class="hint"><kbd>esc</kbd> 关闭</span>
      </div>
      <div class="count">{{ filteredHistory.length }} 项</div>
    </footer>
  </div>
</template>

<style scoped>
/* ---------------------------------------------------------------------------
   外壳：不透明窗口，铺满整个客户区（Mica 底色）
   --------------------------------------------------------------------------- */
.shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--bg-app);
  /* 无边框窗口用 1px 内描边勾勒边界，避免浅色桌面下边缘发虚 */
  box-shadow: inset 0 0 0 1px var(--stroke-default);
}

.shell.is-entering {
  animation: shell-in 0.2s var(--ease-fluent) both;
}

@keyframes shell-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ---------------------------------------------------------------------------
   搜索栏
   --------------------------------------------------------------------------- */
.header {
  padding: 12px 12px 10px;
}

/* Windows 11 文本框：4px 圆角 + 1px 描边，聚焦时描边转为强调色 */
.search {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 10px;
  border-radius: var(--radius-control);
  background: var(--bg-surface);
  border: 1px solid var(--stroke-default);
  transition:
    border-color 0.12s var(--ease-fluent),
    background 0.12s var(--ease-fluent);
}

.search:hover {
  border-color: var(--stroke-hover);
}

.search:focus-within {
  border-color: var(--accent);
  background: var(--bg-surface);
}

.search-icon {
  flex: none;
  width: 16px;
  height: 16px;
  fill: none;
  stroke: var(--text-secondary);
  stroke-width: 1.7;
  stroke-linecap: round;
}

.search-input {
  flex: 1;
  min-width: 0;
  height: 100%;
  font-size: 14px;
  color: var(--text-primary);
}

.search-clear {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border-radius: var(--radius-control);
  color: var(--text-secondary);
  transition:
    color 0.12s var(--ease-fluent),
    background 0.12s var(--ease-fluent);
}

.search-clear:hover {
  color: var(--text-primary);
  background: var(--fill-subtle);
}

.search-clear svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
}

/* ---------------------------------------------------------------------------
   列表
   --------------------------------------------------------------------------- */
.scroller {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0 8px;
}

.spacer {
  position: relative;
  width: 100%;
}

.window-slice {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  will-change: transform;
}

/* 行高度 56 + 上下各 4px 间距 = ITEM_HEIGHT(64)，与虚拟滚动计算保持一致 */
/* 每条记录是一张独立卡片：白底 + 1px 描边 + 6px 圆角 */
.row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 56px;
  margin: 4px 0;
  padding: 0 10px;
  border-radius: var(--radius-card);
  border: 1px solid var(--stroke-default);
  background: var(--bg-surface);
  cursor: default;
  transition:
    background 0.1s var(--ease-fluent),
    border-color 0.1s var(--ease-fluent);
}

.row:hover {
  background: var(--bg-surface-hover);
  border-color: var(--stroke-hover);
}

/* 选中态：强调色底纹 + 左侧 3px 强调色指示条 */
.row.is-active {
  background: var(--accent-soft);
  border-color: var(--accent);
}

.row.is-active::before {
  content: '';
  position: absolute;
  left: 3px;
  top: 50%;
  width: 3px;
  height: 20px;
  margin-top: -10px;
  border-radius: 2px;
  background: var(--accent);
}

.icon {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-control);
  background: var(--fill-subtle);
  transition: background 0.1s var(--ease-fluent);
}

.icon svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.icon[data-type='text'] {
  color: var(--tint-text);
}

.icon[data-type='files'] {
  color: var(--tint-files);
}

.icon[data-type='image'] {
  color: var(--tint-image);
}

.content {
  flex: 1;
  min-width: 0;
}

.title {
  font-size: 13.5px;
  line-height: 18px;
  font-weight: 400;
  color: var(--text-primary);
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  word-break: break-all;
}

.sub {
  margin-top: 1px;
  font-size: 12px;
  line-height: 16px;
  font-weight: 400;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.thumb {
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-control);
  border: 1px solid var(--stroke-default);
  overflow: hidden;
  background: var(--fill-subtle);
}

.thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* ---------------------------------------------------------------------------
   空状态
   --------------------------------------------------------------------------- */
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.empty-icon {
  width: 40px;
  height: 40px;
  margin-bottom: 6px;
  fill: none;
  stroke: var(--text-tertiary);
  stroke-width: 1.4;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0.7;
}

.empty-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.empty-sub {
  font-size: 12px;
  color: var(--text-secondary);
}

/* ---------------------------------------------------------------------------
   状态栏
   --------------------------------------------------------------------------- */
.footer {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 38px;
  padding: 0 14px;
  border-top: 1px solid var(--divider);
  background: var(--bg-app);
}

.hints {
  display: flex;
  align-items: center;
  gap: 14px;
}

.hint {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--text-secondary);
}

kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 3px;
  border: 1px solid var(--stroke-default);
  background: var(--bg-surface);
  font-family: var(--font-fluent);
  font-size: 10.5px;
  line-height: 1;
  color: var(--text-secondary);
}

.count {
  font-size: 12px;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}
</style>
