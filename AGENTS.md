# AGENTS.md

本项目是一个 **electron-vite** 项目（Electron + React + TypeScript，使用 electron-builder 打包）。

## 项目结构

```text
.
├──src
│  ├──main
│  │  ├──index.ts
│  │  └──...
│  ├──preload
│  │  ├──index.ts
│  │  └──...
│  └──renderer    # with vue, react, etc.
│     ├──src
│     │  ├──routes            # TanStack Router 文件式路由
│     │  │  ├──__root.tsx
│     │  │  ├──index.tsx
│     │  │  └──...
│     │  ├──lib               # http / queryClient / router context
│     │  ├──api               # 接口定义 + queryOptions
│     │  ├──router.tsx        # createRouter + Register 类型注册
│     │  ├──routeTree.gen.ts  # 自动生成，禁止手改
│     │  ├──main.tsx
│     │  └──...
│     ├──index.html
│     └──...
├──electron.vite.config.ts
├──package.json
└──...
```text

## 目录职责

- `src/main/`：Electron 主进程代码。入口 `src/main/index.ts`，负责创建窗口、注册 IPC、调用系统 API。
- `src/preload/`：预加载脚本。入口 `src/preload/index.ts`（类型声明见 `index.d.ts`），通过 `contextBridge` 向渲染进程暴露安全的 API。
- `src/renderer/`：渲染进程（前端）代码。`src/renderer/index.html` 为页面入口，`src/renderer/src/` 为前端源码（本项目当前使用 React + TypeScript，别名 `@renderer` 指向 `src/renderer/src`）。
- `electron.vite.config.ts`：electron-vite 配置，分别配置 `main` / `preload` / `renderer` 三部分构建。
- `electron-builder.yml`：打包配置。
- `build/`、`resources/`：打包图标等静态资源。

## 路由与数据请求

- **路由：TanStack Router（文件式）**。路由文件放在 `src/renderer/src/routes/`，`@tanstack/router-plugin` 会在 dev/build 时生成 `src/renderer/src/routeTree.gen.ts`（自动生成，**不要手改**，已加入 ESLint 忽略）。新增页面 = 新增 `routes/xxx.tsx` 并导出 `Route`。
- **路由实例**：`src/renderer/src/router.tsx`，通过 router context 注入 `queryClient`，并在 `declare module` 中注册路由类型（`Link` / `useNavigate` / `useSearch` 全类型推导）。生产环境（`file://`）自动切换为 hash history，避免打包后刷新/深链 404。
- **服务端状态：TanStack Query**。`src/renderer/src/lib/query-client.ts` 提供全局 `queryClient`（staleTime 30s、关闭窗口聚焦自动重取）。
- **HTTP：axios 实例**。`src/renderer/src/lib/http.ts` 只导出 `httpClient`（`axios.create`）：baseURL 读取 `VITE_API_BASE_URL`（见 `.env.example`）、默认超时、可选 token 注入（`setAuthTokenGetter`）。重试、错误与加载状态交给 TanStack Query。
- **接口层**：`src/renderer/src/api/*.ts`（按需新建）放纯 HTTP 函数与 `queryOptions`，组件和路由 loader 复用同一份配置。

```ts
// src/renderer/src/api/user.ts
import { queryOptions } from '@tanstack/react-query'
import { httpClient } from '../lib/http'

export const userQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['user', id] as const,
    queryFn: ({ signal }) => httpClient.get<User>(`/users/${id}`, { signal }).then((r) => r.data)
  })
```

- 在路由 `loader` 中预取：`loader: ({ context, params }) => context.queryClient.ensureQueryData(userQueryOptions(params.id))`。
- `httpClient` 是原生 axios 实例，返回完整 `AxiosResponse`，取数据用 `response.data`。

## 关键约定

- 三个进程相互隔离：主进程与渲染进程之间只能通过 preload + IPC 通信，禁止在渲染进程中直接使用 Node.js API。
- 构建产物输出到 `out/`，`package.json` 的 `main` 指向 `out/main/index.js`。
- 修改代码后请运行类型检查：`npm run typecheck`（含 `typecheck:node` 与 `typecheck:web`）。

## React Compiler

项目已启用 [React Compiler](https://react.dev/learn/react-compiler)（`babel-plugin-react-compiler` + `reactCompilerPreset`，见 `electron.vite.config.ts` 的 renderer 插件）。编译器会在构建时自动插入 memo 逻辑，**禁止手动使用 `useMemo` 和 `useCallback`**——它们会与编译器优化冲突，并带来不必要的维护成本。

## 前端状态管理选择

按数据来源选择状态方案，避免把服务端数据或应持久化的 UI 状态塞进 `useState` / `useReducer`。

| 数据类型 | 方案 | 示例 |
| -------- | ---- | ---- |
| 服务端数据 | **TanStack Query**（`useQuery` / `useInfiniteQuery` / `useMutation`） | 列表、详情、创建/删除 |
| 筛选、分页、排序等页面状态 | **URL search params**（TanStack Router `validateSearch`） | `?keyword=foo&sortBy=updatedAt` |
| 临时本地 UI 状态 | `useState` / `useReducer` | 弹窗开关、表单草稿、拖拽中间态 |

### Feature 模块结构

业务放在 `src/renderer/src/features/<module>/`。**按数据边界分文件，按文件数量决定要不要变成目录**——有则拆、无则扁平，不要为每个模块预先建空目录。

长大后的上限结构：

```text
features/<module>/
  query-keys.ts     # TanStack Query key 工厂（有服务端读写才需要）
  api.ts            # HTTP 纯函数，无 React；作为 queryFn / mutationFn
  hooks.ts          # 或 hooks/：Query 封装 + 业务 hook（超过约 2 个文件再拆目录）
  components/       # 从页面拆出的子组件（有第 2 个才建目录）
  utils.ts          # 或 utils/：模块工具（有第 2 个文件再拆目录）
  types.ts          # 仅前端私有类型；DTO 用 @drama-me/shared，不要再抄一份
  <page>.tsx        # 页面入口（路由只挂这一个组件）
  index.ts          # 对外导出：页面、query-keys、必要时 hooks
```

| 层 | 职责 | 谁可以引用 |
| -- | ---- | ---------- |
| `query-keys.ts` | key 工厂，如 `canvasKeys.list(filters)` | 模块 hooks |
| `api.ts` | `HttpClient` + `throwIfNotOk` | 仅作为 `queryFn` / `mutationFn` |
| `hooks.ts` | `useQuery` / `useInfiniteQuery` / `useMutation` | 页面与模块内组件 |
| `components/` | 模块 UI 子块 | 本模块页面 |
| `index.ts` | 模块对外承诺 | `routes/`、少数跨模块调用（如布局里的 `useSignOut`） |

约束：

- **不要把 HTTP 写进 hooks**：`api.ts` 不依赖 React，便于测试和将来在非组件里复用。
- **组件里不要手写 Query 配置**：`queryKey`、`queryFn`、`invalidateQueries` 放在模块 hooks 里。
- **`index.ts` 不要全量 re-export 内部组件**，避免循环依赖、模糊边界。
- **没有服务端数据的模块**（如当前 `learn-flow`）不要硬建 `api.ts` / `query-keys.ts`。
- 筛选/分页/排序仍由路由 `validateSearch` 写入 URL，不要放进 feature 的 `types` 当「页面状态源」。
- 登出时用 `queryClient.clear()` 清掉当前用户的服务端缓存，避免 auth 依赖各个业务模块的 query-keys。

## React 状态规范：状态就近/下沉

- **默认下沉**：默认将 state 放在真正使用它的最小组件中；仅当多个兄弟/跨层级需要共享、需要单一数据源或受控编排时，才提升到最近公共父级、Context 或 store。
- **仅在必要时提升**：新增 state 前先问：谁读？谁写？父组件是否真的需要？父组件不读不控，就下沉。
- **即使启用 React Compiler 也必须遵守**：自动 memo 不能替代状态下沉的架构收益，不能阻止状态所在组件自身重渲染，也不能替代职责拆分与局部优化。
- **拆分尺度**：下沉优先为了结构清晰、可维护、可测试、缩小重渲染与副作用影响范围；不要为性能过度拆分。

## 提交规范

- **commitlint**：`commitlint.config.mjs` 继承 `@commitlint/config-conventional`，提交信息必须是 `type(scope): subject`（如 `feat: 新增列表页`）。
- **lefthook**：`lefthook.yml` 定义钩子，`prepare` 脚本在安装依赖后执行 `lefthook install`。
  - `pre-commit`：对暂存文件跑 `eslint --fix`（自动回写暂存区）+ `pnpm run typecheck`。
  - `commit-msg`：跑 `commitlint`，不符合规范直接拒绝提交。
- 手动验证钩子：`pnpm exec lefthook run pre-commit`。

## 常用命令

- `pnpm dev`：开发模式启动（electron-vite dev）
- `pnpm build`：类型检查 + 构建
- `pnpm build:win` / `build:mac` / `build:linux`：打包对应平台
- `pnpm lint`：ESLint 检查
- `pnpm format`：Prettier 格式化
