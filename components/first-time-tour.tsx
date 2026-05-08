'use client'

// 初回起動時に一度だけ表示する簡単なツアーダイアログ。
// - localStorage の 'anime-app-tour-done' フラグで管理。完了させれば二度と出ない。
// - 「スキップ」「後で見る」でも出なくなる(同じフラグ)。明示的に「再表示」したい場合は storyboard 画面のヘッダから呼べる。

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Users, Image as ImageIcon, Film, Keyboard, Save } from 'lucide-react'

const TOUR_KEY = 'anime-app-tour-done'

const STEPS = [
  {
    Icon: Users,
    title: 'ようこそ、アニメ制作支援ツールへ',
    body: 'キャラクター・音声・シーン・BGM・SE を統合管理し、ブラウザだけでアニメを作れます。データはこの PC の IndexedDB に保存され、外部には送信されません。',
  },
  {
    Icon: Users,
    title: 'Step 1: キャラクターを登録',
    body: '「キャラクター」タブで立ち絵と表情(口開/口閉)、音声ファイルを登録。音声と口パクが自動で連動します。',
  },
  {
    Icon: ImageIcon,
    title: 'Step 2: 環境素材をそろえる',
    body: '「環境素材」タブで背景画像・BGM・効果音を追加。Web Audio のサンプルをワンクリック生成もできます。',
  },
  {
    Icon: Film,
    title: 'Step 3: ストーリーボードでシーンを組む',
    body: 'シーンにキャストを選び、セリフを並べ、BGM と背景を設定。タイムラインで順番を調整、通し再生・動画書き出しも可能です。',
  },
  {
    Icon: Keyboard,
    title: '便利なショートカット',
    body: '/ で検索、? でショートカット一覧、Ctrl+D で複製、Alt+1〜9 で動画切替、Esc で展開を閉じる。覚えると一気に速くなります。',
  },
  {
    Icon: Save,
    title: 'バックアップを忘れずに',
    body: 'ホーム画面から zip エクスポートでプロジェクト一式を書き出せます。OneDrive 等で別端末に運ぶ運用もできます。',
  },
]

export function FirstTimeTour() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const done = localStorage.getItem(TOUR_KEY)
    if (!done) {
      // 起動直後の慌ただしさを避け、1 秒遅延で表示
      const t = window.setTimeout(() => setOpen(true), 1200)
      return () => window.clearTimeout(t)
    }
  }, [])

  function finish() {
    try {
      localStorage.setItem(TOUR_KEY, '1')
    } catch {}
    setOpen(false)
    setStep(0)
  }

  const current = STEPS[step]
  const Icon = current.Icon
  const isLast = step === STEPS.length - 1

  return (
    <Dialog open={open} onOpenChange={(o) => !o && finish()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon size={18} className="text-primary" />
            {current.title}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed whitespace-pre-wrap">
            {current.body}
          </DialogDescription>
        </DialogHeader>
        {/* 進捗ドット */}
        <div className="flex items-center justify-center gap-1.5 py-2">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? 'bg-primary w-6' : 'bg-muted-foreground/30 w-1.5'
              }`}
            />
          ))}
        </div>
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={finish}
            className="text-muted-foreground"
          >
            スキップ
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="gap-1"
            >
              <ChevronLeft size={14} />
              戻る
            </Button>
            {isLast ? (
              <Button size="sm" onClick={finish}>
                はじめる
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => setStep((s) => s + 1)}
                className="gap-1"
              >
                次へ
                <ChevronRight size={14} />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// 「もう一度ツアーを見る」をプログラムから発火したい時用の小ヘルパー
export function resetFirstTimeTour() {
  try {
    localStorage.removeItem(TOUR_KEY)
  } catch {}
}
