// src/background.js
import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  globalShortcut,
  screen,
  nativeTheme,
  powerMonitor
} from 'electron'
import { join } from 'path'
import { ClipboardObserver } from './clipboard/clipboardObserver.js'
import { ClipboardHistory } from './clipboard/clipboardHistory.js'
import { registerIpcHandlers } from './ipc'
import { hideWindow, showWindow } from './utils.js'
const WINDOW_WIDTH = 720
const WINDOW_HEIGHT = 520

let mainWindow
let tray = null
let clipboardHistory = null // 提升为模块级变量，用于退出时保存数据

const WHITE_ICON = join(__dirname, '../../resources', 'white.png')
const BLACK_ICON = join(__dirname, '../../resources', 'black.png')

// 与 renderer 侧 Mica 底色保持一致，避免窗口创建/显示瞬间的白闪与黑闪
const LIGHT_SURFACE = '#F3F3F3'
const DARK_SURFACE = '#202020'

app.setLoginItemSettings({
  openAtLogin: true,
  args: ['--process-start-args', '"--hidden"']
})

// 通知渲染层窗口已显示，用于重放入场动画
function notifyShown() {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
    mainWindow.webContents.send('window-shown')
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    resizable: false,
    //删除滚动条以及滚动条的样式
    frame: false,
    show: false, // 默认隐藏
    // 不透明窗口：Windows 11 Mica 底色，避免透明导致的穿透效果
    transparent: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? DARK_SURFACE : LIGHT_SURFACE,
    icon: nativeTheme.shouldUseDarkColors ? WHITE_ICON : BLACK_ICON,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // 隐藏任务栏图标
  mainWindow.setSkipTaskbar(true)

  mainWindow.loadFile(join(__dirname, '../renderer/index.html'))

  //失去焦点 自动隐藏
  mainWindow.on('blur', async () => {
    // mainWindow.hide();
    hideWindow(mainWindow)
  })

  mainWindow.on('close', async (e) => {
    e.preventDefault()
    mainWindow.setSkipTaskbar(true)
    hideWindow(mainWindow)
  })

  tray = new Tray(nativeTheme.shouldUseDarkColors ? WHITE_ICON : BLACK_ICON)
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '退出',
      click: function () {
        mainWindow.destroy()
        app.quit()
      }
    }
  ])
  tray.setContextMenu(contextMenu)
  tray.setToolTip('Paste')

  tray.on('click', () => {
    showWindow(mainWindow)
    notifyShown()
  })

  // 监听系统主题变化
  nativeTheme.on('updated', () => {
    tray.setImage(nativeTheme.shouldUseDarkColors ? WHITE_ICON : BLACK_ICON)
    mainWindow.setIcon(nativeTheme.shouldUseDarkColors ? WHITE_ICON : BLACK_ICON)
    mainWindow.setBackgroundColor(nativeTheme.shouldUseDarkColors ? DARK_SURFACE : LIGHT_SURFACE)
  })
}

let clipboardObserver = null
let cleanupIpcHandlers = null

app.on('ready', () => {
  createWindow()
  const ret = globalShortcut.register('Alt+D', () => {
    if (mainWindow.isVisible()) {
      hideWindow(mainWindow)
    } else {
      // 在显示窗口之前记录当前活动窗口
      const cursorPos = screen.getCursorScreenPoint()
      const currentDisplay = screen.getDisplayNearestPoint(cursorPos)
      const { bounds } = currentDisplay
      const x = bounds.x + Math.round((bounds.width - WINDOW_WIDTH) / 2)
      const y = bounds.y + Math.round((bounds.height - WINDOW_HEIGHT) / 2)

      mainWindow.setBounds({
        width: WINDOW_WIDTH,
        height: WINDOW_HEIGHT
      })
      mainWindow.setPosition(x, y)
      mainWindow.setResizable(false)
      showWindow(mainWindow)
      mainWindow.focus()
      notifyShown()
    }
  })

  clipboardHistory = new ClipboardHistory(mainWindow)
  clipboardObserver = new ClipboardObserver(clipboardHistory)
  cleanupIpcHandlers = registerIpcHandlers({ clipboardHistory })

  if (!ret) {
    console.log('Registration failed')
  }

  // 开始监控剪切板变化
  //如果已经是start状态，则不重复启动
  if (!clipboardObserver.isStart) {
    clipboardObserver.start()
  }
})

const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    // 当运行第二个实例时,将会聚焦到mainWindow个窗口
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
      showWindow(mainWindow)
      notifyShown()
    }
  })
}
powerMonitor.on('lock-screen', () => {
  if (clipboardObserver && clipboardObserver.isStart) {
    clipboardObserver.stop()
  }
})
powerMonitor.on('unlock-screen', () => {
  //如果已经是start状态，则不重复启动
  if (clipboardObserver && !clipboardObserver.isStart) {
    clipboardObserver.start()
  }
})

app.on('will-quit', () => {
  // 注销所有快捷键
  globalShortcut.unregisterAll()
  if (clipboardObserver && clipboardObserver.isStart) {
    clipboardObserver.stop()
  }
  // 立即保存剪贴板历史（防止防抖延迟导致数据丢失）
  if (clipboardHistory) {
    clipboardHistory.saveNow()
  }
  // 清理 IPC 监听器
  if (cleanupIpcHandlers) {
    cleanupIpcHandlers()
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.destroy()
  }
})
