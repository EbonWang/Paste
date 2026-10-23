// 窗口聚焦/恢复辅助模块
// @johnlindquist/node-window-manager 为原生模块，若当前环境未编译成功则优雅降级，
// 仅失去"隐藏后自动聚焦回上一个窗口"的能力，不影响剪贴板核心功能。
let windowManager = null

try {
  windowManager = require('@johnlindquist/node-window-manager').windowManager
} catch (error) {
  console.warn(
    '[Paste] node-window-manager 不可用，已禁用"恢复到上一个窗口"能力：',
    error && error.message
  )
}

let previousWindow = null

// 同步获取，不阻塞主流程
function getPreviousWindow() {
  if (!windowManager) return
  try {
    previousWindow = windowManager.getActiveWindow()
  } catch (error) {
    console.error('Error getting active window:', error)
  }
}

// 异步激活，不阻塞隐藏窗口
function activatePreviousWindow() {
  if (!previousWindow) return
  // 使用 setImmediate 异步执行，避免阻塞
  setImmediate(() => {
    try {
      previousWindow.bringToTop()
    } catch (error) {
      console.error('Error activating previous window:', error)
    }
  })
}

export { getPreviousWindow, activatePreviousWindow }
