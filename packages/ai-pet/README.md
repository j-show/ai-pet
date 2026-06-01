# AI Pet

基于 [Tauri 2](https://v2.tauri.app/) 的透明桌面宠物，支持 **macOS / Windows**。加载与 Codex 数字宠物包相同格式的资源（`pet.json` + 雪碧图）。

## 宠物包格式

每个宠物目录需包含：

| 文件               | 说明                                          |
| ------------------ | --------------------------------------------- |
| `pet.json`         | 元数据（id、displayName、spritesheetPath 等） |
| `spritesheet.webp` | 雪碧图动画（由 `pet.json` 引用）              |

示例见 [`public/default/`](public/default/)（内置默认宠物 Sugarwing），或 [`../pet-skins/sugarwing/`](../pet-skins/sugarwing/)。

可选扩展字段（省略时使用标准 Codex 9 行动画布局，见 `src/pet/codex-defaults.ts`）：

- `atlas` — `{ columns, cellWidth, cellHeight }`
- `animations` — 各状态 `{ state, row, frames, fps?, loop? }`

## 宠物加载顺序

1. **`~/.ai-pet/pets/<petId>/`** — 用户自定义宠物（优先）
2. **`public/default/`** — 内置默认宠物（回退）

当 `PET` 配置无效、指定 id 在用户目录中不存在或加载失败时，自动回退到内置默认宠物。

## 用户配置

首次启动会自动创建：

- `~/.ai-pet/.env` — 环境变量（参考 [`env.example`](env.example)）
- `~/.ai-pet/pets/` — 用户宠物目录

```env
PET=sugarwing
AI_PET_ANIMATION_TICK=250
AI_PET_THEME=auto
```

| 变量                    | 说明                                  | 默认        |
| ----------------------- | ------------------------------------- | ----------- |
| `PET`                   | 默认宠物 id                           | `sugarwing` |
| `AI_PET_ANIMATION_TICK` | 动画帧间隔（毫秒）                    | `250`       |
| `AI_PET_THEME`          | 界面主题：`auto` \| `light` \| `dark` | `auto`      |

`auto` 跟随系统亮/暗色，影响文字框与右键菜单样式。

宠物 id 优先级：`?pet=` URL 参数 > `~/.ai-pet/.env` 中的 `PET` > 内置默认 `sugarwing`。

## 开发

在仓库根目录（推荐）：

```bash
pnpm pet:dev          # 启动 Tauri 开发模式
pnpm pet:open aipet://base
pnpm pet:build        # 构建前端 + 打包应用
```

或在 `ai-pet/` 目录：

```bash
pnpm install
pnpm dev              # tauri dev
pnpm open aipet://waving
pnpm sync-pets        # 可选：从 ../pet-skins/sugarwing 同步到 public/default
```

`tauri dev` / `tauri build` 前会尝试运行 `sync-pets.mjs`：若 `packages/pet-skins/sugarwing` 存在则**合并**更新 `public/default/`（保留目标目录中源未提供的文件，例如已提交的雪碧图）；否则使用已有的 `public/default/`。

指定宠物启动（开发模式）：

```bash
pnpm tauri dev -- --url "http://localhost:1420/?pet=sugarwing&debug=protocol"
```

### 协议调试

在 **应用窗口** 的 DevTools 控制台（非终端）打印收到的 `aipet://` 协议；开启后还会：

- 自动打开 WebView 开发者工具（需重新编译/启动应用）
- 在窗口左下角显示协议日志浮层

配置（修改 `~/.ai-pet/.env` 后需**完全重启** AI Pet）：

```env
AI_PET_DEBUG_PROTOCOL=true
```

或开发 URL：`?debug=protocol`

启动后应看到黄色警告：`[ai-pet protocol] debug ON`；若为 `OFF` 或 `not found`，说明 `.env` 未加载或键名有误（勿加 `#` 注释）。

**注意**：`pnpm pet:open` 的终端输出里不会出现协议日志，请在宠物窗口按 `Ctrl+Shift+I` 查看控制台，或看左下角浮层。

## 交互

| 操作 | 行为                                                     |
| ---- | -------------------------------------------------------- |
| 拖动 | 移动窗口；左/右拖触发跑步动画（开始 → 循环 → 结束）      |
| 单击 | 播放挥手动画，结束后回到 idle                            |
| 右键 | 弹出菜单（退出）                                         |
| 空闲 | 每 25～55 秒随机播放一次 `jumping`，回到 idle 后继续调度 |

## 应用协议 `aipet://`

开发中推荐 `pnpm pet:open`（走 Vite dev bridge）；已构建应用后可用系统默认 handler（macOS `open`、Windows `start`、Linux `xdg-open`）。首次使用系统 handler 需先 `pnpm pet:build` 并启动一次应用以注册 URL scheme。

### 自动播放

| URL            | 行为                                         |
| -------------- | -------------------------------------------- |
| `aipet://base` | 回到自动播放：`idle` 循环 + 空闲随机动画调度 |

### 动画

`aipet://{key}?loop=true|false&count=N&default=true`，`loop` 默认 `true`。`count` 表示完整播放该动画 N 轮后回到待机状态，指定 `count` 时忽略 `loop`。`runing` 为 `running` 别名。

**`default=true`**：该动画临时取代 `aipet://base`，**循环播放**该动画（忽略 manifest 中的 `loop: false` 与 URL 中的 `loop=false`）；仅 `aipet://base` 可取消。

| key | 动画 | `loop=false` 时 | `count=N` 时 | `default=true` 时 |
| --- | ---- | --------------- | ------------ | ------------------- |
| `waving` | 挥手 | 播完回待机 | 播完 N 轮回待机 | 设为临时 base，循环 waving |
| `jumping` | 跳跃 | 同上 | 同上 | 同上 |
| `failed` | 失败 | 同上 | 同上 | 同上 |
| `waiting` | 等待 | 同上 | 同上 | 同上 |
| `running` | 跑步 | 同上 | 同上 | 同上 |
| `review` | 审查 | 同上 | 同上 | 同上 |

```bash
pnpm pet:open aipet://waving
pnpm pet:open 'aipet://waving?loop=false'
pnpm pet:open 'aipet://running?default=true'
pnpm pet:open 'aipet://failed?count=3'
pnpm pet:open aipet://base
```

### 文字框

| URL                                    | 行为                 |
| -------------------------------------- | -------------------- |
| `aipet://text` | 关闭全部文字框 |
| `aipet://text?sid={SID}` | 关闭指定会话文字框 |
| `aipet://text?sid={SID}&tl=...&icon=...&txt=...` | 显示/更新文字框（相同 sid 覆盖，不同 sid 向下堆叠） |

| 参数   | 说明                                                          |
| ------ | ------------------------------------------------------------- |
| `tl`   | 标题，单行省略；需 URL 编码                                   |
| `icon` | `warn`（橙三角）\| `error`（红）\| `info`（蓝）；不传则不显示 |
| `txt`  | 正文，最多 5 行省略；支持 `%0A` 换行                          |

悬停文字框左上角出现 × 按钮可关闭。窗口以右上角为锚点扩展，避免宠物被裁切。

```bash
pnpm pet:open aipet://text
pnpm pet:open 'aipet://text?tl=标题&icon=info&txt=正文内容'
pnpm pet:open 'aipet://text?icon=warn&txt=多行%0A文字'
```

## 构建

```bash
pnpm tauri build                    # 安装包（Windows: msi 等）
pnpm build:portable:win             # 仅 release exe，不打包安装器
pnpm sync-version                   # 将 package.json 版本同步到 Cargo / tauri conf
pnpm export                         # 复制 exe 与 bundle 到仓库根 dist/
pnpm build                          # msi + portable exe + export（Windows）
```

Windows 便携版产物：`src-tauri/target/release/ai-pet.exe`（需系统已安装 WebView2 Runtime）。

若项目目录迁移后 Rust 构建报找不到旧路径下的文件，先清理再构建：

```bash
pnpm clean && pnpm build
```

产物位于 `src-tauri/target/release/bundle/`（`.app` / `.dmg` / `.msi` 等）。

应用图标（macOS `.icns`、Windows `.ico`）由 `src-tauri/icons/icon-source.png`（1024×1024 PNG）生成；`pnpm icon` 仅从四边 flood-fill 去掉外侧黑底，猫头内部的黑色屏幕区域保留不透明：

```bash
pnpm icon   # 在 packages/ai-pet 目录，或 pnpm -F ai-pet icon
```

## 目录结构

```
ai-pet/
├── public/default/       # 内置默认宠物（提交进仓库）
├── scripts/
│   ├── sync-pets.mjs     # skins → public/default（合并复制）
│   ├── sync-version.mjs  # package.json → Cargo / tauri conf
│   ├── export-dist.mjs   # 构建产物 → 仓库根 dist/
│   └── aipet-open.mjs    # 协议调试
├── src/
│   ├── config/user-env.ts
│   └── pet/              # 加载、动画、协议、文字框
└── src-tauri/
    ├── icons/            # icon-source.png → icon.icns / icon.ico
    └── ...               # Rust 后端与打包配置
```
