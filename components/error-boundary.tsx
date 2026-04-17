'use client'

// アプリ全体を包む React Error Boundary。
// 配下のツリーで例外が出たら、画面を真っ白にする代わりに回復 UI を出す。
// 「再読み込み」で即復帰、「全データをリセット」で IndexedDB を初期化してから再読み込み。
// クラスコンポーネントでしか componentDidCatch が書けないので、意図的に class を使っている。

import React from 'react'
import { AlertTriangle, RefreshCcw, Trash2 } from 'lucide-react'

interface State {
  error: Error | null
}

export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // console に詳細を出しておく(開発時のデバッグ + ユーザーがコピーしてくれると助かる)
    console.error('[anime-app] unhandled error', error, info.componentStack)
  }

  handleReload = () => {
    window.location.reload()
  }

  handleResetAll = async () => {
    if (
      !window.confirm(
        'IndexedDB を完全に初期化して再読み込みします。すべてのデータが失われます。本当によろしいですか?',
      )
    )
      return
    try {
      // idb 経由ではなく indexedDB から直接 anime_app_db を消す(破損時でも動くように)
      await new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase('anime_app_db')
        req.onsuccess = () => resolve()
        req.onerror = () => resolve()
        req.onblocked = () => resolve()
      })
    } catch (e) {
      console.error('[anime-app] reset failed', e)
    }
    window.location.reload()
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-xl w-full bg-card border border-destructive/40 rounded-lg p-6 space-y-4 shadow-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-destructive flex-shrink-0 mt-0.5" size={24} />
            <div>
              <h1 className="text-xl font-bold text-foreground">
                予期しないエラーが発生しました
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                画面の再読み込みで解消する可能性があります。それでも直らない場合は
                「全データをリセット」を試してください。
              </p>
            </div>
          </div>

          <div className="bg-background border border-border rounded p-3 text-xs font-mono text-muted-foreground overflow-auto max-h-40 whitespace-pre-wrap break-words">
            {error.name}: {error.message}
            {error.stack ? '\n\n' + error.stack.split('\n').slice(0, 8).join('\n') : ''}
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition"
            >
              <RefreshCcw size={16} />
              再読み込み
            </button>
            <button
              type="button"
              onClick={() => {
                const text = `${error.name}: ${error.message}\n\n${error.stack ?? ''}`
                navigator.clipboard?.writeText(text).catch(() => {})
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-input text-foreground hover:bg-primary/10 transition"
            >
              エラーをコピー
            </button>
            <button
              type="button"
              onClick={this.handleResetAll}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10 transition ml-auto"
            >
              <Trash2 size={16} />
              全データをリセット
            </button>
          </div>
        </div>
      </div>
    )
  }
}
