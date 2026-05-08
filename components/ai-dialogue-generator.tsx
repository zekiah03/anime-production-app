'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Sparkles, Loader2, Wand2 } from 'lucide-react'
import type { Character, CharacterKnowledge } from '@/types/db'

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

export interface GeneratedDialogue {
  text: string
  emotion: string
  notes: string
}

interface Props {
  character: Character
  open: boolean
  onClose: () => void
  onAccept: (selected: GeneratedDialogue[]) => void
}

export function AIDialogueGenerator({ character, open, onClose, onAccept }: Props) {
  const [scenario, setScenario] = useState('')
  const [count, setCount] = useState(3)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generated, setGenerated] = useState<GeneratedDialogue[]>([])
  const [picked, setPicked] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (!open) {
      setError(null)
      setGenerated([])
      setPicked(new Set())
    }
  }, [open])

  const knowledge = character.knowledge ?? EMPTY_KNOWLEDGE
  const hasMinimalKnowledge =
    knowledge.speech_pattern.trim().length > 0 || knowledge.sample_dialogues.trim().length > 0

  async function handleGenerate() {
    setError(null)
    setLoading(true)
    setGenerated([])
    setPicked(new Set())
    try {
      const res = await fetch('/api/generate-dialogue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterName: character.name,
          knowledge,
          scenario: scenario.trim(),
          count,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error ?? `${res.status}`)
      }
      const list: GeneratedDialogue[] = data.dialogues ?? []
      setGenerated(list)
      // 初期は全選択
      setPicked(new Set(list.map((_, i) => i)))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  function togglePick(i: number) {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  function handleAccept() {
    const selected = generated.filter((_, i) => picked.has(i))
    if (selected.length === 0) return
    onAccept(selected)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[min(92vw,900px)] max-h-[92vh] overflow-auto sm:rounded-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles size={18} className="text-primary" /> AIでセリフ生成
          </DialogTitle>
          <DialogDescription>
            {character.name} のナレッジを Claude Opus 4.7 に渡して、シーンに合うセリフを生成します
          </DialogDescription>
        </DialogHeader>

        {!hasMinimalKnowledge && (
          <div className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
            ナレッジタブの<strong>「口調・一人称」</strong>か<strong>「サンプルセリフ」</strong>が
            空のままだと、口調がブレやすいです。先に少し書いておくと精度が上がります。
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">シナリオ</label>
            <textarea
              placeholder="例: 学校の屋上で空を見ながら独り言。最近の悩みについて愚痴っぽくぼやく感じ"
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-foreground mb-1">
                生成するセリフ数 ({count})
              </label>
              <input
                type="range"
                min={1}
                max={10}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
            <Button
              onClick={handleGenerate}
              disabled={loading || scenario.trim().length === 0}
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

          {generated.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  生成結果 ({picked.size}/{generated.length} 選択中)
                </p>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPicked(new Set(generated.map((_, i) => i)))}
                  >
                    全選択
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setPicked(new Set())}>
                    全解除
                  </Button>
                </div>
              </div>

              <ul className="space-y-2">
                {generated.map((g, i) => (
                  <li
                    key={i}
                    className={`p-3 rounded border cursor-pointer transition ${
                      picked.has(i)
                        ? 'border-primary/60 bg-primary/10'
                        : 'border-border bg-background hover:border-primary/30'
                    }`}
                    onClick={() => togglePick(i)}
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={picked.has(i)}
                        onChange={() => togglePick(i)}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1 accent-primary"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">{g.text}</p>
                        <div className="flex flex-wrap gap-1 mt-1 text-xs">
                          {g.emotion && (
                            <span className="px-2 py-0.5 bg-accent/20 text-accent rounded">
                              {g.emotion}
                            </span>
                          )}
                          {g.notes && (
                            <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded">
                              {g.notes}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={onClose}>
                  キャンセル
                </Button>
                <Button onClick={handleAccept} disabled={picked.size === 0} className="gap-1">
                  <Sparkles size={14} />
                  選択した {picked.size} 件をセリフに追加
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
