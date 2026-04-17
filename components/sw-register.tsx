'use client'

// Service Worker を登録するだけの極小コンポーネント。
// - production でのみ登録(dev では HMR と競合しうるのでスキップ)
// - 1 回成功すれば再訪時はブラウザがキャッシュ起動するのでオフライン動作する
// - 更新があれば SKIP_WAITING で即時置換(ユーザーに再読み込みを求めない)

import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
        // 更新検知: 新しい SW が waiting になったらそのまま activate させる
        reg.addEventListener('updatefound', () => {
          const newSw = reg.installing
          if (!newSw) return
          newSw.addEventListener('statechange', () => {
            if (newSw.state === 'installed' && navigator.serviceWorker.controller) {
              // 次回リロードで使われる。押し込み更新はしない(UX を優先)
              console.log('[sw] update available; will apply on next reload')
            }
          })
        })
      } catch (e) {
        console.warn('[sw] register failed', e)
      }
    }

    register()
  }, [])
  return null
}
