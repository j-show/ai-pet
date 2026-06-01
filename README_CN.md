# AI Pet

AI Pet monorepo：Tauri 桌面宠物应用与 Codex 皮肤部署 CLI。

[English README](README.md)

## 环境要求

- Node.js **≥ 22**（见 `package.json` 的 `engines`）
- 交互式终端（`pnpm deploy` 需要 TTY）

## 安装与命令

```bash
pnpm install
```

| 命令 | 说明 |
| --- | --- |
| `pnpm deploy` | 交互式将 `packages/pet-skins/` 复制到 `~/.ai-pet/pets` |
| `pnpm pet:dev` | 启动 AI Pet 桌面应用（开发） |
| `pnpm pet:build` | 构建 AI Pet（Tauri） |
| `pnpm pet:open` | 通过开发桥或系统处理打开 `aipet://` |
| `pnpm lint` / `pnpm fix:eslint` | ESLint（含自动修复） |
| `pnpm typecheck` | TypeScript 类型检查（`packages/ai-pet`） |
| `pnpm test` | `pet-skins` 单元测试 |

`deploy`：`↑`/`↓` 切换、`Enter` 安装/卸载（`*` 已安装）、`Ctrl+C` 退出。

安装方式：将 `packages/pet-skins/<petId>/` **复制**到 `~/.ai-pet/pets/<petId>/`。

## 目录结构

| 路径 | 说明 |
| --- | --- |
| `packages/ai-pet/` | Tauri 桌面宠物 |
| `packages/pet-skins/<petId>/` | 可部署 Codex 宠物包 |
| `runs/<run-name>/` | 生成流水线中间产物（可选） |

### `pet.json` 字段

以 `packages/pet-skins/sugarwing/pet.json` 为准：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 与目录名一致 |
| `displayName` | string | 显示名称 |
| `description` | string | 描述 |
| `spritesheetPath` | string | 相对本目录的雪碧图 |

将生成产物复制到 `packages/pet-skins/<petId>/` 即可新增皮肤。

## 相关文档

- [`packages/ai-pet/README.md`](packages/ai-pet/README.md)
- [`packages/pet-skins/README.md`](packages/pet-skins/README.md)
