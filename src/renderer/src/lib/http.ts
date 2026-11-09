import axios from 'axios'

/**
 * 只做最基础的实例配置：
 * - baseURL 来自 VITE_API_BASE_URL
 * - 请求带默认超时
 * 失败重试、错误提示、加载状态等交给 TanStack Query 处理。
 */
export const httpClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '',
  timeout: 15_000
})

let tokenGetter: (() => string | null | undefined) | undefined

/** 设置 token 获取函数，请求时自动带上 Authorization 头 */
export function setAuthTokenGetter(getter?: () => string | null | undefined): void {
  tokenGetter = getter
}

httpClient.interceptors.request.use((config) => {
  const token = tokenGetter?.()
  if (token && !config.headers.has('Authorization')) {
    config.headers.set('Authorization', `Bearer ${token}`)
  }
  return config
})

export default httpClient
