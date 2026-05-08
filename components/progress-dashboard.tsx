'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { CheckCircle2, AlertTriangle, ListChecks } from 'lucide-react'
import type { Character, Dialogue, Scene, SceneDialogue } from '@/types/db'
import {
  getAllCharacters,
  getAllDialogues,
  getAllSceneDialogues,
  getAllScenes,
} from '@/lib/db'

interface CheckItem {
  label: string
  count: number
  hint?: string
  href?: string
}

// プロジェクトの「未完成箇所」を一目で見るウィジェット。
// ダッシュボードで使う想定。
export function ProgressDashboard() {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<CheckItem[]>([])
  const [totals, setTotals] = useState({
    characters: 0,
    scenes: 0,
    dialogues: 0,
  })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [chars, scenes, sds, dials] = await Promise.all([
          getAllCharacters(),
          getAllScenes(),
          getAllSceneDialogues(),
          getAllDialogues(),
        ])
        if (cancelled) return

        const checks: CheckItem[] = []

        // ナレッジが空 or 浅いキャラ
        const charsWithoutKnowledge = chars.filter((c) => {
          const k = c.knowledge
          if (!k) return true
          return (
            k.speech_pattern.trim().length === 0 &&
            k.sample_dialogues.trim().length === 0
          )
        })
        if (charsWithoutKnowledge.length > 0) {
          checks.push({
            label: 'ナレッジ未入力のキャラ',
            count: charsWithoutKnowledge.length,
            hint: '口調 or サンプルセリフが空。AI 生成の精度に影響',
            href: '/characters',
          })
        }

        // 画像なしキャラ
        const charsWithoutImage = chars.filter((c) => !c.image_url)
        if (charsWithoutImage.length > 0) {
          checks.push({
            label: '画像未登録のキャラ',
            count: charsWithoutImage.length,
            hint: 'メイン画像 or 表情画像なし',
            href: '/characters',
          })
        }

        // キャラ付きセリフだけど audio なし
        const dialoguesNeedingAudio = dials.filter(
          (d: Dialogue) => d.character_id && !d.audio_id,
        )
        if (dialoguesNeedingAudio.length > 0) {
          checks.push({
            label: '音声未割当のセリフ',
            count: dialoguesNeedingAudio.length,
            hint: 'キャラに紐付いてるが audio_id がない',
          })
        }

        // 中身が空のシーン(セリフ 0)
        const scenesWithoutDialogues = scenes.filter(
          (s: Scene) => !sds.some((sd: SceneDialogue) => sd.scene_id === s.id),
        )
        if (scenesWithoutDialogues.length > 0) {
          checks.push({
            label: '空のシーン',
            count: scenesWithoutDialogues.length,
            hint: 'セリフが 1 つも追加されていない',
            href: '/storyboard',
          })
        }

        // 背景未設定のシーン
        const scenesWithoutBg = scenes.filter(
          (s) => !s.background_illustration_id,
        )
        if (scenesWithoutBg.length > 0) {
          checks.push({
            label: '背景未設定のシーン',
            count: scenesWithoutBg.length,
            hint: '黒背景のまま書き出される',
            href: '/storyboard',
          })
        }

        setItems(checks)
        setTotals({
          characters: chars.length,
          scenes: scenes.length,
          dialogues: dials.length,
        })
      } catch (e) {
        console.error('[anime-app] progress dashboard load failed', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Card className="bg-card border-border p-6">
      <h3 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
        <ListChecks size={20} /> 制作チェック
      </h3>

      {loading ? (
        <p className="text-sm text-muted-foreground">読み込み中...</p>
      ) : items.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-primary">
          <CheckCircle2 size={18} />
          <p>チェック OK。未完成箇所は見つかりませんでした</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item, i) => {
            const content = (
              <div className="flex items-start gap-2 p-3 bg-background rounded border border-border hover:border-primary/40 transition">
                <AlertTriangle
                  size={16}
                  className="text-amber-500 flex-shrink-0 mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {item.label}
                    </p>
                    <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-500 rounded font-medium tabular-nums flex-shrink-0">
                      {item.count}
                    </span>
                  </div>
                  {item.hint && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.hint}
                    </p>
                  )}
                </div>
              </div>
            )
            return (
              <li key={i}>
                {item.href ? <Link href={item.href}>{content}</Link> : content}
              </li>
            )
          })}
        </ul>
      )}

      <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
        <span>合計</span>
        <span className="tabular-nums">
          キャラ {totals.characters} / シーン {totals.scenes} / セリフ{' '}
          {totals.dialogues}
        </span>
      </div>
    </Card>
  )
}
