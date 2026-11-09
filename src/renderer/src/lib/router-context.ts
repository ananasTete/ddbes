import type { QueryClient } from '@tanstack/react-query'

/** 全局路由上下文：通过 router context 注入，可被 loader / beforeLoad 使用 */
export interface RouterContext {
  queryClient: QueryClient
}
