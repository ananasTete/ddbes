import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [
      // 必须放在 react 插件之前：根据 src/renderer/src/routes 生成路由树
      tanstackRouter({
        target: 'react',
        routesDirectory: './src/routes',
        generatedRouteTree: './src/routeTree.gen.ts',
        quoteStyle: 'single',
        semicolons: false,
        autoCodeSplitting: true
      }),
      tailwindcss(),
      react(),
      // React Compiler：编译期自动插入 memo，禁止手写 useMemo/useCallback
      babel({
        presets: [reactCompilerPreset()]
      })
    ]
  }
})
