'use client'

// アプリ全体で使う簡易トースト通知システム。
// useToast() の push() で成功・エラー・情報メッセージを統一的に出せる。
// 4 秒で自動消去、複数スタック可、最大 5 件まで表示(溢れた分は即破棄)。
// ブラウザ標準の alert() を置き換えるための軽量実装で、外部依存なし。

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react'

export type ToastKind = 'success' | 'error' | 'info' | 'warning'

export interface ToastMessage {
  id: string
  kind: ToastKind
  text: string
  // アクションボタン(例: 「元に戻す」)を付けたいときに使う
  action?: {
    label: string
    onClick: () => void
  }
  // ms 単位の表示時間。省略時は kind に応じて自動
  durationMs?: number
}

interface ToastContextValue {
  push: (msg: Omit<ToastMessage, 'id'>) => string
  dismiss: (id: string) => void
  // 便利メソッド(どれも push の薄いラッパ)
  success: (text: string) => string
  error: (text: string) => string
  info: (text: string) => string
  warning: (text: string) => string
}

const ToastContext = createContext<ToastContextValue | null>(null)

function defaultDuration(kind: ToastKind): number {
  if (kind === 'error' || kind === 'warning') return 6000
  return 3500
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const timersRef = useRef<Map<string, number>>(new Map())

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const t = timersRef.current.get(id)
    if (t !== undefined) {
      window.clearTimeout(t)
      timersRef.current.delete(id)
    }
  }, [])

  const push = useCallback(
    (msg: Omit<ToastMessage, 'id'>): string => {
      const id = crypto.randomUUID()
      const full: ToastMessage = { id, ...msg }
      setToasts((prev) => {
        // 最大 5 件で古いものから破棄
        const next = [...prev, full]
        if (next.length > 5) {
          const dropped = next.shift()
          if (dropped) {
            const t = timersRef.current.get(dropped.id)
            if (t !== undefined) {
              window.clearTimeout(t)
              timersRef.current.delete(dropped.id)
            }
          }
        }
        return next
      })
      const d = msg.durationMs ?? defaultDuration(msg.kind)
      if (d > 0) {
        const tid = window.setTimeout(() => dismiss(id), d)
        timersRef.current.set(id, tid)
      }
      return id
    },
    [dismiss],
  )

  // アンマウント時に全タイマーを掃除
  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach((t) => window.clearTimeout(t))
      timers.clear()
    }
  }, [])

  const value = useMemo<ToastContextValue>(
    () => ({
      push,
      dismiss,
      success: (text) => push({ kind: 'success', text }),
      error: (text) => push({ kind: 'error', text }),
      info: (text) => push({ kind: 'info', text }),
      warning: (text) => push({ kind: 'warning', text }),
    }),
    [push, dismiss],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    // Provider が無くても落ちないよう console.warn にとどめる
    return {
      push: () => '',
      dismiss: () => {},
      success: (t) => {
        console.log('[toast.success]', t)
        return ''
      },
      error: (t) => {
        console.error('[toast.error]', t)
        return ''
      },
      info: (t) => {
        console.log('[toast.info]', t)
        return ''
      },
      warning: (t) => {
        console.warn('[toast.warning]', t)
        return ''
      },
    }
  }
  return ctx
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[]
  onDismiss: (id: string) => void
}) {
  if (toasts.length === 0) return null
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none max-w-sm">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastMessage
  onDismiss: (id: string) => void
}) {
  const palette = (() => {
    switch (toast.kind) {
      case 'success':
        return {
          bg: 'bg-green-600 text-white',
          Icon: CheckCircle2,
        }
      case 'error':
        return {
          bg: 'bg-destructive text-destructive-foreground',
          Icon: XCircle,
        }
      case 'warning':
        return {
          bg: 'bg-amber-500 text-white',
          Icon: AlertTriangle,
        }
      case 'info':
      default:
        return {
          bg: 'bg-foreground text-background',
          Icon: Info,
        }
    }
  })()
  const { Icon, bg } = palette
  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-start gap-2 px-3 py-2.5 rounded-lg shadow-lg border border-black/10 ${bg} animate-in slide-in-from-right-4 fade-in-0 duration-200`}
    >
      <Icon size={16} className="flex-shrink-0 mt-0.5" />
      <span className="text-sm leading-snug flex-1 whitespace-pre-wrap break-words">
        {toast.text}
      </span>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action?.onClick()
            onDismiss(toast.id)
          }}
          className="text-sm font-semibold underline hover:opacity-80 flex-shrink-0 ml-1"
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 p-0.5 rounded hover:bg-black/20 transition"
        title="閉じる"
      >
        <X size={14} />
      </button>
    </div>
  )
}
