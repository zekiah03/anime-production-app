'use client'

// 初回利用者向けのセットアップ案内カード。シーン 0 / キャラ 0 のときに大きく表示する。
// 現状の進捗に応じてチェックマーク表示。リンクで各タブへ誘導。

import Link from 'next/link'
import { Users, Image as ImageIcon, Film, CheckCircle2, Circle } from 'lucide-react'

interface StepProgress {
  hasCharacters: boolean
  hasAssets: boolean
  hasScenes: boolean
}

export function StoryboardEmptyState({ progress }: { progress: StepProgress }) {
  const steps: {
    done: boolean
    title: string
    desc: string
    href: string
    Icon: typeof Users
    cta: string
  }[] = [
    {
      done: progress.hasCharacters,
      title: '1. キャラクターを登録',
      desc: 'キャラクターの立ち絵・表情(口開/口閉)・音声をアップロード。リップシンクに使われます。',
      href: '/characters',
      Icon: Users,
      cta: 'キャラクター画面へ',
    },
    {
      done: progress.hasAssets,
      title: '2. 背景・BGM・効果音を用意',
      desc: '「環境素材」タブで画像(背景)・BGM・SE を追加。サンプルをワンクリックで生成も可。',
      href: '/environment',
      Icon: ImageIcon,
      cta: '環境素材画面へ',
    },
    {
      done: progress.hasScenes,
      title: '3. シーンを作る',
      desc: 'このストーリーボード画面で「新規シーン」を押し、セリフ・キャスト・BGM を組み合わせます。',
      href: '#',
      Icon: Film,
      cta: '下のボタンから開始',
    },
  ]

  return (
    <div className="bg-card border border-border rounded-lg p-8 space-y-6">
      <div>
        <h3 className="text-xl font-bold text-foreground mb-1">
          はじめての方へ: 3 ステップのセットアップ
        </h3>
        <p className="text-sm text-muted-foreground">
          下の順番で進めるとスムーズにアニメ制作を始められます。
        </p>
      </div>
      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li
            key={i}
            className={`flex items-start gap-3 p-4 rounded-lg border transition ${
              s.done
                ? 'bg-primary/5 border-primary/30'
                : 'bg-background border-border'
            }`}
          >
            {s.done ? (
              <CheckCircle2 className="text-green-600 flex-shrink-0 mt-0.5" size={22} />
            ) : (
              <Circle className="text-muted-foreground flex-shrink-0 mt-0.5" size={22} />
            )}
            <s.Icon className="text-primary flex-shrink-0 mt-0.5" size={18} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground">{s.title}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{s.desc}</p>
            </div>
            {!s.done && s.href !== '#' && (
              <Link
                href={s.href}
                className="flex-shrink-0 text-xs px-3 py-1.5 rounded border border-input text-foreground hover:bg-primary/10 transition"
              >
                {s.cta}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
