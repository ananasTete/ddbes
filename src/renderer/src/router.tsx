import { createHashHistory, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { queryClient } from './lib/query-client'
import type { RouterContext } from './lib/router-context'

/**
 * 打包后页面通过 file:// 加载，Browser history 无法刷新/深链；
 * 生产环境改用 hash history，开发环境（http dev server）保持 clean URL。
 */
const isFileProtocol = typeof window !== 'undefined' && window.location.protocol === 'file:'

export const router = createRouter({
  routeTree,
  context: { queryClient } satisfies RouterContext,
  history: isFileProtocol ? createHashHistory() : undefined,
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
  defaultNotFoundComponent: () => (
    <div style={{ padding: 24 }}>
      <h1>404</h1>
      <p>页面不存在</p>
    </div>
  )
})

// 注册路由类型，让 Link / useNavigate / useSearch 等获得完整类型推导
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
