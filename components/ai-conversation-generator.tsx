'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, Sparkles, Wand2 } from 'lucide-react'
import type { Character, CharacterKnowledge, CharacterMotion, ScreenEffect } from '@/types/db'

const EMPTY_KNOWLEDGE: CharacterKnowledge = {
  basic_setting: '',
  personality: '',
  motivation: '',
  speech_pattern: '',
  backstory: '',
  preferences: '',
  relationships: '',
  sample_dialogues: '',
  notes: '',
}

export interface GeneratedConversationLine {
  character_id: string
  text: string
  emotion: string
  motion: CharacterMotion
  effect: ScreenEffect
  notes: string
}

interface Props {
  characters: Character[]
  open: boolean
  onClose: () => void
  onAccept: (lines: GeneratedConversationLine[]) => void
}

export function AIConversationGenerator({ characters, open, onClose, onAccept }: Props) {
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [scenario, setScenario] = useState('')
  const [count, setCount] = useState(6)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<GeneratedConversationLine[]>([])
  const [accepted, setAccepted] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (!open) {
      setError(null)
      setResult([])
      setAccepted(new Set())
    }
  }, [open])

  function togglePick(id: string) {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleGenerate() {
    if (picked.size < 2) {
      setError('少なくとも 2 人選んでください')
      return
    }
    if (scenario.trim().length === 0) {
      setError('シナリオを入力してください')
      return
    }
    setError(null)
    setLoading(true)
    setResult([])
    try {
      const payload = {
        characters: characters
          .filter((c) => picked.has(c.id))
          .map((c) => ({
            id: c.id,
            name: c.name,
            knowledge: c.knowledge ?? EMPTY_KNOWLEDGE,
          })),
        scenario: scenario.trim(),
        count,
      }
      const res = await fetch('/api/generate-conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `${res.status}`)
      const lines: GeneratedConversationLine[] = data.lines ?? []
      setResult(lines)
      setAccepted(new Set(lines.map((_, i) => i)))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  function toggleAccept(i: number) {
    setAccepted((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  function handleAccept() {
    const selected = result.filter((_, i) => accepted.has(i))
    if (selected.length === 0) return
    onAccept(selected)
    onClose()
  }

  const charById = new Map(characters.map((c) => [c.id, c]))

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles size={18} className="text-primary" /> AI で掛け合いを生成
          </DialogTitle>
          <DialogDescription>
            複数キャラを選び、シナリオを書くと Claude Opus 4.7 がそれぞれの行動原理・口調を尊重した
            会話を一括生成します
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">登場キャラ ({picked.size} 人選択中)</p>
            {characters.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                先にキャラクターを2人以上作成してください
              </p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {characters.map((c) => {
                  const on = picked.has(c.id)
                  const hasKnowledge =
                    !!c.knowledge?.speech_pattern || !!c.knowledge?.sample_dialogues
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => togglePick(c.id)}
                      className={`flex items-center gap-2 p-2 rounded border text-left transition ${
                        on
                          ? 'border-primary/60 bg-primary/10'
                          : 'border-border bg-background hover:border-primary/30'
                      }`}
                    >
                      {c.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.image_url}
                          alt={c.name}
                          className="w-8 h-8 rounded object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded bg-muted flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        {!hasKnowledge && (
                          <p className="text-[10px] text-muted-foreground">
                            ナレッジ未入力
                          </p>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">シナリオ</label>
            <textarea
              placeholder="例: 学校の屋上で放課後、進路について話す。Aは行きたい大学があるが、Bは反対している。"
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">
                生成行数 ({count})
              </label>
              <input
                type="range"
                min={2}
                max={20}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
            <Button
              onClick={handleGenerate}
              disabled={loading || picked.size < 2 || scenario.trim().length === 0}
              className="gap-2"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
              {loading ? '生成中...' : '生成'}
            </Button>
          </div>

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {result.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  生成結果 ({accepted.size}/{result.length} 採用)
                </p>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAccepted(new Set(result.map((_, i) => i)))}
                  >
                    全選択
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setAccepted(new Set())}>
                    全解除
                  </Button>
                </div>
              </div>

              <ol className="space-y-2">
                {result.map((line, i) => {
                  const c = charById.get(line.character_id)
                  const on = accepted.has(i)
                  return (
                    <li
                      key={i}
                      className={`p-3 rounded border cursor-pointer transition ${
                        on
                          ? 'border-primary/60 bg-primary/10'
                          : 'border-border bg-background hover:border-primary/30'
                      }`}
                      onClick={() => toggleAccept(i)}
                    >
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggleAccept(i)}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1 accent-primary flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {c?.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={c.image_url}
                                alt={c.name}
                                className="w-6 h-6 rounded object-cover"
                              />
                            ) : (
                              <div className="w-6 h-6 rounded bg-muted" />
                            )}
                            <span className="text-xs font-medium">{c?.name ?? '?'}</span>
                          </div>
                          <p className="text-sm break-words">{line.text}</p>
                          <div className="flex flex-wrap gap-1 mt-1 text-[10px]">
                            {line.emotion && line.emotion !== '通常' && (
                              <span className="px-1.5 py-0.5 bg-accent/20 text-accent rounded">
                                {line.emotion}
                              </span>
                            )}
                            {line.motion !== 'none' && (
                              <span className="px-1.5 py-0.5 bg-muted text-muted-foreground rounded">
                                ▶ {line.motion}
                              </span>
                            )}
                            {line.effect !== 'none' && (
                              <span className="px-1.5 py-0.5 bg-muted text-muted-foreground rounded">
                                ✨ {line.effect}
                              </span>
                            )}
                            {line.notes && (
                              <span className="px-1.5 py-0.5 bg-muted text-muted-foreground rounded">
                                {line.notes}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ol>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={onClose}>
                  キャンセル
                </Button>
                <Button
                  onClick={handleAccept}
                  disabled={accepted.size === 0}
                  className="gap-1"
                >
                  <Sparkles size={14} />
                  採用 {accepted.size} 行をシーンに追加
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
