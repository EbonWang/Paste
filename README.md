# Paste

<div align="center">
  <h3>一个简洁高效的跨平台剪贴板管理器</h3>
  <p>A Simple and Efficient Cross-platform Clipboard Manager</p>
</div>

<!-- > 基于 [Duducoco/DcPaste](https://github.com/Duducoco/DcPaste) 移植，功能与核心逻辑保持一致， -->
> 界面为 Windows 11 Fluent 风格（不透明 Mica 底色 + 卡片化列表）。

## ✨ 特性 | Features

- 🚀 **轻量快速** - 基于 Electron 构建，启动迅速，占用资源少
- 📋 **多格式支持** - 支持纯文本、富文本(RTF)、HTML、图片、文件路径
- 🔍 **快速搜索** - 实时搜索历史记录，快速定位所需内容
- ⌨️ **键盘导航** - 支持方向键选择、Enter 确认，无需鼠标操作
- 🎯 **全局快捷键** - `Alt+D` 快速唤起/隐藏窗口
- 💾 **自动保存** - 剪贴板历史自动保存，重启不丢失
- 🗑️ **智能清理** - 自动清理 7 天前的历史记录
- 🎨 **主题适配** - 自动跟随系统深色/浅色主题
- 🔒 **隐私保护** - 系统锁屏时自动暂停监控
- 🪟 **无干扰设计** - 无边框窗口，失焦自动隐藏
- 🪟 **Windows 11 界面** - Fluent 2 设计令牌、Mica 底色、卡片化列表、跟随系统深浅色

## 📸 截图 | Screenshots

<div align="center">
  <img src="resources/index.png" alt="Paste Screenshot" width="800">
  <p><i>Paste 主界面</i></p>
</div>

## 🖥️ 系统要求 | Requirements

- Windows 10/11
- macOS 10.13+
- Linux (支持 AppImage、Snap、Deb)

## 📦 安装 | Installation

### 从源码构建

1. 克隆仓库
```bash
git clone https://github.com/EbonWang/Paste.git
cd Paste
```

2. 安装依赖
```bash
yarn
```

3. 构建应用
```bash
# Windows
yarn build:win

# macOS
yarn build:mac

# Linux
yarn build:linux
```

构建完成后，安装包位于 `dist` 目录。

## 🚀 使用方法 | Usage

### 一键启动（Windows）

双击项目根目录的 `start.bat` 即可。脚本会自动完成：

1. 检测 Node.js 环境
2. 首次运行时安装依赖（`node_modules` 已存在则跳过）
3. 下载 Electron 运行时（已存在则跳过）
4. 构建前端与主进程代码
5. 后台启动应用，脚本窗口随即关闭

需要查看运行日志时，用 `start.bat --console` 前台启动。

### 启动应用

应用启动后会自动最小化到系统托盘，不会显示主窗口。

### 快捷键

- `Alt+D` - 显示/隐藏剪贴板历史窗口
- `↑/↓` - 在历史记录中上下移动
- `Enter` - 选择当前项并写入剪贴板
- `Esc` - 隐藏窗口（失焦自动隐藏）

### 搜索功能

在搜索框中输入关键词可以实时过滤历史记录，支持：
- 文本内容搜索
- 富文本内容搜索
- 文件路径搜索

### 托盘菜单

右键点击托盘图标可以：
- 退出应用

## 🛠️ 开发 | Development

### 开发模式

```bash
# 启动开发服务器（支持热重载）
yarn dev
```

### 代码格式化

```bash
# 格式化代码
yarn format

# 运行 ESLint 检查并自动修复
yarn lint
```

### 构建测试

```bash
# 仅构建代码（不打包）
yarn build

# 构建并打包为未压缩目录（用于测试）
yarn build:unpack
```

### 生成应用图标

```bash
yarn electron:generate-icons
```

## 🏗️ 技术栈 | Tech Stack

- **框架**: [Electron](https://www.electronjs.org/) - 跨平台桌面应用框架
- **前端**: [Vue 3](https://vuejs.org/) - 渐进式 JavaScript 框架
- **样式**: 原生 CSS（Windows 11 / Fluent 2 设计令牌，深浅色自适应），未使用组件库
- **构建工具**: [electron-vite](https://electron-vite.org/) - 快速的 Electron 开发构建工具
- **打包工具**: [electron-builder](https://www.electron.build/) - 应用打包和分发

> 相比原项目移除了 Vuetify 与其图标字体依赖：列表改为自实现的轻量虚拟滚动，
> 视觉层完全由 `src/renderer/src/assets/fluent.css` 中的设计令牌驱动，启动更快、观感更统一。

### 核心依赖

- `electron-clipboard-ex` - 增强的剪贴板功能（支持文件路径读取）
- `electron-store` - 持久化配置存储
- `@johnlindquist/node-window-manager` - 跨平台窗口管理（**可选**，原生模块）

> `@johnlindquist/node-window-manager` 需要本机具备 C++ 编译环境才能安装。
> 未编译成功时 `src/main/windowManager.js` 会自动降级，仅不再"隐藏后自动聚焦回上一个窗口"，
> 剪贴板功能不受影响。

## 📁 项目结构 | Project Structure

```
Paste/
├── src/
│   ├── main/               # 主进程
│   │   ├── clipboard/      # 剪贴板核心功能
│   │   │   ├── clipboardObserver.js   # 剪贴板监控
│   │   │   ├── clipboardHistory.js    # 历史记录管理
│   │   │   └── clipboardItem.js       # 数据模型
│   │   ├── ipc/            # IPC 通信处理
│   │   ├── windowManager.js           # 窗口管理
│   │   └── index.js        # 应用入口
│   ├── preload/            # 预加载脚本
│   └── renderer/           # 渲染进程（Vue 应用）
│       └── src/
│           ├── assets/
│           │   └── fluent.css         # Windows 11 设计令牌与全局样式
│           └── view/
│               └── ClipBoard.vue      # 主界面组件
├── resources/              # 应用资源（图标等）
├── build/                  # 构建资源
└── dist/                   # 打包输出目录
```

## 🤝 贡献 | Contributing

欢迎提交 Issue 和 Pull Request！

## 📄 许可证 | License

本项目采用 MIT 许可证。

## 👨‍💻 作者 | Author

**EbonWang**

- GitHub: [@EbonWang](https://github.com/EbonWang)

---

<div align="center">
  如果这个项目对你有帮助，请给它一个 ⭐️
</div>
