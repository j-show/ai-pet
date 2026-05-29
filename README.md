# codex-pets

Codex 数字宠物资源包与本地部署工具：将 `dist/` 下的宠物目录链接到 `~/.codex/pets`，供 Codex 应用加载。

## 环境要求

- Node.js **≥ 18**（见 `package.json` 的 `engines`）
- 交互式终端（`pnpm deploy` / `npm run deploy` 需要 TTY）

## 安装与命令

本仓库无运行时依赖，克隆后可直接使用：

```bash
npm run deploy
# 或
pnpm deploy
```

`deploy` 会打开全屏选择器：

- `↑` / `↓`（或 `k` / `j`）切换宠物
- `Enter` 安装或卸载当前项（`*` 表示已链接到 `~/.codex/pets`）
- `Ctrl+C` 退出

链接方式：Windows 使用目录 **junction**，macOS/Linux 使用 **dir** 符号链接。卸载只删除 `~/.codex/pets/<id>` 下的链接，不改动本仓库 `dist/` 源文件。

## 目录结构

| 路径 | 说明 |
|------|------|
| `dist/<petId>/` | 可部署的宠物包（每个子目录一个宠物） |
| `dist/<petId>/pet.json` | 宠物元数据（id、显示名、雪碧图路径等） |
| `dist/<petId>/spritesheet.webp` | 动画雪碧图（由 `pet.json` 的 `spritesheetPath` 引用） |
| `scripts/deploy.mjs` | 交互式安装/卸载 CLI |
| `runs/<run-name>/` | 单次生成流水线的中间产物与 QA 记录（非 deploy 必需） |

### `pet.json` 字段（当前 dist 包）

以 `dist/sugarwing/pet.json` 为准：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 宠物唯一标识，与目录名一致 |
| `displayName` | string | 界面显示名称 |
| `description` | string | 简短描述 |
| `spritesheetPath` | string | 相对本目录的雪碧图文件名 |

### `runs/` 示例（sugar-wing）

`runs/sugar-wing/` 保存一次完整生成过程的产物，便于审阅与复现，结构与外部生成工具输出一致，主要包括：

- `pet_request.json` — 生成规格（图集尺寸、动画行、色键等）
- `prompts/` — 图像生成用提示词（`base-pet.md`、各状态 `rows/*.md`）
- `frames/` — 按状态拆分的帧 PNG 与 `frames-manifest.json`
- `final/` — 合成雪碧图（`spritesheet.webp`）与 `validation.json`
- `qa/` — 联系表、`review.json`、`run-summary.json` 等

将 `runs/.../final/spritesheet.webp` 与对应 `pet.json` 复制到 `dist/<petId>/` 即可作为新的可部署包；具体打包步骤取决于你使用的生成流水线。

## 添加新宠物

1. 在 `dist/` 下新建目录，例如 `dist/my-pet/`。
2. 放入 `pet.json` 与 `spritesheet.webp`（路径与 `pet.json` 中 `spritesheetPath` 一致）。
3. 运行 `npm run deploy`，选中该目录并回车安装。

Codex 会从 `~/.codex/pets/<目录名>/` 读取包内容；目录名应与 `pet.json` 的 `id` 保持一致（现有 `sugarwing` 包即如此）。

## 相关源码

部署逻辑见 [`scripts/deploy.mjs`](scripts/deploy.mjs)。
