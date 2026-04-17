'use client'

// ブラウザのローカルストレージ(主に IndexedDB + blob)の使用量を小さく表示する。
// navigator.storage.estimate() が存在しない環境(古い Safari 等)では何も表示しない。
// 30 秒おきに更新。ヘッダ右端等に置く想定。

import { useEffect, useState } from 'react'
import { HardDrive } from 'lucide-react'

interface StorageInfo {
  usage: number
  quota: number
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)}KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)}MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)}GB`
}

export function StorageBadge({ className }: { className?: string }) {
  const [info, setInfo] = useState<StorageInfo | null>(null)
  const [supported, setSupported] = useState(true)

  useEffect(() => {
    let cancelled = false
    let timer: number | null = null

    const tick = async () => {
      if (
        typeof navigator === 'undefined' ||
        !navigator.storage ||
        typeof navigator.storage.estimate !== 'function'
      ) {
        setSupported(false)
        return
      }
      try {
        const est = await navigator.storage.estimate()
        if (cancelled) return
        if (typeof est.usage === 'number' && typeof est.quota === 'number') {
          setInfo({ usage: est.usage, quota: est.quota })
        }
      } catch (e) {
        console.warn('[anime-app] storage estimate failed', e)
      }
    }

    tick()
    timer = window.setInterval(tick, 30000) as unknown as number
    return () => {
      cancelled = true
      if (timer !== null) window.clearInterval(timer)
    }
  }, [])

  if (!supported || !info) return null

  const pct = info.quota > 0 ? (info.usage / info.quota) * 100 : 0
  const warn = pct > 80
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs ${warn ? 'text-amber-500' : 'text-muted-foreground'} ${className ?? ''}`}
      title={`IndexedDB + Blob 使用量: ${formatBytes(info.usage)} / ${formatBytes(info.quota)}(${pct.toFixed(1)}%)`}
    >
      <HardDrive size={12} />
      {formatBytes(info.usage)}
    </span>
  )
}
