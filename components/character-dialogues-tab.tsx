'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Play, Plus, Square, Trash2, Edit2, Music, Sparkles } from 'lucide-react'
import type { AudioFile, Character, CharacterExpression, Dialogue } from '@/types/db'
import { deleteDialogue, saveDialogue } from '@/lib/db'
import { LipSyncStage } from '@/components/lip-sync-stage'

const EMOTIONS = ['通常', '怒り', '悲しみ', '喜び', '驚き', '恐怖']

interface Props {
  character: Character
  dialogues: Dialogue[]
  audioFiles: AudioFile[]
  expressions: CharacterExpression[]
  onChange: (next: Dialogue[]) => void
}

export function CharacterDialoguesTab({
  character,
  dialogues,
  audioFiles,
  expressions,
  onChange,
}: Props) {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    text: '',
    audio_id: '',
    expression_id: '',
    emotion: '',
    notes: '',
  })

  const expressionOptions = expressions.filter((e) => e.kind === 'expression')

  function resetForm() {
    setFormData({ text: '', audio_id: '', expression_id: '', emotion: '', notes: '' })
    setEditingId(null)
    setShowForm(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.text.trim()) return
    const now = new Date().toISOString()

    if (editingId) {
      const existing = dialogues.find((d) => d.id === editingId)
      if (!existing) return
      const updated: Dialogue = {
        ...existing,
        text: formData.text,
        character_id: character.id,
        audio_id: formData.audio_id || null,
        expression_id: formData.expression_id || null,
        emotion: formData.emotion || null,
        notes: formData.notes || null,
        updated_at: now,
      }
      await saveDialogue(updated)
      onChange(dialogues.map((d) => (d.id === editingId ? updated : d)))
    } else {
      const newDialogue: Dialogue = {
        id: crypto.randomUUID(),
        text: formData.text,
        character_id: character.id,
        audio_id: formData.audio_id || null,
        expression_id: formData.expression_id || null,
        emotion: formData.emotion || null,
        notes: formData.notes || null,
        created_at: now,
        updated_at: now,
      }
      await saveDialogue(newDialogue)
      onChange([newDialogue, ...dialogues])
    }
    resetForm()
  }

  async function handleDelete(id: string) {
    if (!confirm('このセリフを削除しますか？')) return
    await deleteDialogue(id)
    onChange(dialogues.filter((d) => d.id !== id))
  }

  function handleEdit(d: Dialogue) {
    setFormData({
      text: d.text,
      audio_id: d.audio_id || '',
      expression_id: d.expression_id || '',
      emotion: d.emotion || '',
      notes: d.notes || '',
    })
    setEditingId(d.id)
    setShowForm(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="font-semibold text-foreground">{character.name} のセリフ</h4>
        <Button
          size="sm"
          onClick={() => {
            if (showForm) resetForm()
            else setShowForm(true)
          }}
          className="gap-1"
        >
          <Plus size={14} />
          {showForm ? 'キャンセル' : '新規作成'}
        </Button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="border border-border rounded-lg p-4 bg-muted/30 space-y-3"
        >
          <div>
            <label className="block text-xs text-muted-foreground mb-1">セリフ</label>
            <textarea
              placeholder="セリフを入力..."
              value={formData.text}
              onChange={(e) => setFormData({ ...formData, text: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">音声</label>
              <select
                value={formData.audio_id}
                onChange={(e) => setFormData({ ...formData, audio_id: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm"
              >
                <option value="">未選択</option>
                {audioFiles.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">表情</label>
              <select
                value={formData.expression_id}
                onChange={(e) => setFormData({ ...formData, expression_id: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm"
              >
                <option value="">自動(口パク優先)</option>
                {expressionOptions.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">感情</label>
              <select
                value={formData.emotion}
                onChange={(e) => setFormData({ ...formData, emotion: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm"
              >
                <option value="">未選択</option>
                {EMOTIONS.map((em) => (
                  <option key={em} value={em}>
                    {em}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">メモ</label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="任意"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm">
              {editingId ? '更新' : '作成'}
            </Button>
          </div>
        </form>
      )}

      {dialogues.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          セリフがまだありません
        </p>
      ) : (
        <div className="space-y-2">
          {dialogues.map((d) => {
            const audio = audioFiles.find((a) => a.id === d.audio_id) ?? null
            const exprName = d.expression_id
              ? expressions.find((x) => x.id === d.expression_id)?.name
              : null
            const isPlaying = playingId === d.id
            const canPreview = !!audio
            return (
              <div key={d.id} className="bg-background border border-border rounded p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground break-words">{d.text}</p>
                    <div className="flex flex-wrap gap-1 mt-2 text-xs">
                      {d.emotion && (
                        <span className="px-2 py-0.5 bg-accent/20 text-accent rounded">
                          {d.emotion}
                        </span>
                      )}
                      {exprName && (
                        <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded inline-flex items-center gap-1">
                          <Sparkles size={10} /> {exprName}
                        </span>
                      )}
                      {audio && (
                        <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded inline-flex items-center gap-1">
                          <Music size={10} /> {audio.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => {
                        if (!canPreview) return
                        setPlayingId(isPlaying ? null : d.id)
                      }}
                      disabled={!canPreview}
                      className="p-1.5 hover:bg-primary/20 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                      title={canPreview ? 'プレビュー' : '音声が必要です'}
                    >
                      {isPlaying ? (
                        <Square size={14} className="text-primary" />
                      ) : (
                        <Play size={14} className="text-primary" />
                      )}
                    </button>
                    <button
                      onClick={() => handleEdit(d)}
                      className="p-1.5 hover:bg-primary/20 rounded"
                    >
                      <Edit2 size={14} className="text-primary" />
                    </button>
                    <button
                      onClick={() => handleDelete(d.id)}
                      className="p-1.5 hover:bg-destructive/20 rounded"
                    >
                      <Trash2 size={14} className="text-destructive" />
                    </button>
                  </div>
                </div>
                {isPlaying && (
                  <div className="mt-3 max-w-[180px]">
                    <LipSyncStage
                      character={character}
                      expressions={expressions}
                      audioUrl={audio?.file_url ?? null}
                      overrideExpressionId={d.expression_id}
                      playing={isPlaying}
                      onEnded={() => setPlayingId(null)}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
