import { QueryClient } from '@tanstack/react-query'

/**
 * 全局 QueryClient。
 * 重试、错误处理、加载状态都用 TanStack Query 的默认行为，
 * 这里只保留两条适合桌面端的策略。
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 30s 内视为新鲜，避免页面间来回切换时重复请求
      staleTime: 30_000,
      // Electron 窗口频繁切换焦点，关闭自动重取
      refetchOnWindowFocus: false
    }
  }
})
