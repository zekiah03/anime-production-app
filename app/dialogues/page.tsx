'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Music, Users, MessageSquare, Film, Plus, Trash2, Edit2, Play, Layers } from 'lucide-react'
import type { Dialogue, Character, AudioFile } from '@/types/db'
import {
  deleteDialogue,
  getAllAudioFiles,
  getAllCharacters,
  getAllDialogues,
  saveDialogue,
} from '@/lib/db'

export default function DialoguesPage() {
  const [dialogues, setDialogues] = useState<Dialogue[]>([])
  const [characters, setCharacters] = useState<Character[]>([])
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    text: '',
    character_id: '',
    audio_id: '',
    emotion: '',
    notes: '',
  })

  useEffect(() => {
    Promise.all([getAllDialogues(), getAllCharacters(), getAllAudioFiles()])
      .then(([d, c, a]) => {
        setDialogues(d)
        setCharacters(c)
        setAudioFiles(a)
      })
      .catch((e) => console.error('[anime-app] load dialogues page failed', e))
      .finally(() => setLoading(false))
  }, [])

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
        character_id: formData.character_id || null,
        audio_id: formData.audio_id || null,
        emotion: formData.emotion || null,
        notes: formData.notes || null,
        updated_at: now,
      }
      await saveDialogue(updated)
      setDialogues((prev) => prev.map((d) => (d.id === editingId ? updated : d)))
      setEditingId(null)
    } else {
      const newDialogue: Dialogue = {
        id: crypto.randomUUID(),
        text: formData.text,
        character_id: formData.character_id || null,
        audio_id: formData.audio_id || null,
        emotion: formData.emotion || null,
        notes: formData.notes || null,
        created_at: now,
        updated_at: now,
      }
      await saveDialogue(newDialogue)
      setDialogues((prev) => [newDialogue, ...prev])
    }

    resetForm()
  }

  async function handleDelete(id: string) {
    if (!confirm('削除してよろしいですか？')) return
    await deleteDialogue(id)
    setDialogues((prev) => prev.filter((d) => d.id !== id))
  }

  function handleEdit(dialogue: Dialogue) {
    setFormData({
      text: dialogue.text,
      character_id: dialogue.character_id || '',
      audio_id: dialogue.audio_id || '',
      emotion: dialogue.emotion || '',
      notes: dialogue.notes || '',
    })
    setEditingId(dialogue.id)
    setShowForm(true)
  }

  function resetForm() {
    setFormData({
      text: '',
      character_id: '',
      audio_id: '',
      emotion: '',
      notes: '',
    })
    setShowForm(false)
  }

  const emotions = ['通常', '怒り', '悲しみ', '喜び', '驚き', '恐怖']

  return (
    <div className="flex h-screen bg-background">
      {/* サイドバー */}
      <aside className="w-64 bg-sidebar border-r border-sidebar-border p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-sidebar-primary">アニメ制作</h1>
          <p className="text-sm text-muted-foreground mt-1">制作支援ツール</p>
        </div>

        <nav className="space-y-2">
          <Link href="/" className="flex items-center gap-3 px-4 py-3 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent/20 transition">
            <Film size={20} />
            ダッシュボード
          </Link>
          <Link href="/characters" className="flex items-center gap-3 px-4 py-3 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent/20 transition">
            <Users size={20} />
            キャラクター
          </Link>
          <Link href="/illustrations" className="flex items-center gap-3 px-4 py-3 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent/20 transition">
            <Layers size={20} />
            イラスト
          </Link>
          <Link href="/audio" className="flex items-center gap-3 px-4 py-3 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent/20 transition">
            <Music size={20} />
            音声
          </Link>
          <Link href="/dialogues" className="flex items-center gap-3 px-4 py-3 rounded-lg bg-sidebar-primary/20 text-sidebar-primary font-medium">
            <MessageSquare size={20} />
            セリフ
          </Link>
          <Link href="/storyboard" className="flex items-center gap-3 px-4 py-3 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent/20 transition">
            <Film size={20} />
            ストーリーボード
          </Link>
        </nav>
      </aside>

      {/* メインコンテンツ */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-foreground">セリフエディター</h2>
              <p className="text-muted-foreground mt-1">セリフを作成・管理します</p>
            </div>
            <Button
              onClick={() => {
                setEditingId(null)
                resetForm()
                setShowForm(!showForm)
              }}
              className="gap-2"
            >
              <Plus size={18} />
              新規作成
            </Button>
          </div>

          {showForm && (
            <Card className="bg-card border-border p-6 mb-8">
              <h3 className="text-xl font-semibold text-foreground mb-4">
                {editingId ? 'セリフを編集' : '新規セリフを作成'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">セリフ</label>
                  <textarea
                    placeholder="セリフを入力..."
                    value={formData.text}
                    onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">キャラクター</label>
                    <select
                      value={formData.character_id}
                      onChange={(e) => setFormData({ ...formData, character_id: e.target.value })}
                      className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">未選択</option>
                      {characters.map((char) => (
                        <option key={char.id} value={char.id}>
                          {char.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">音声</label>
                    <select
                      value={formData.audio_id}
                      onChange={(e) => setFormData({ ...formData, audio_id: e.target.value })}
                      className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">未選択</option>
                      {audioFiles.map((audio) => (
                        <option key={audio.id} value={audio.id}>
                          {audio.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">感情</label>
                    <select
                      value={formData.emotion}
                      onChange={(e) => setFormData({ ...formData, emotion: e.target.value })}
                      className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">未選択</option>
                      {emotions.map((emotion) => (
                        <option key={emotion} value={emotion}>
                          {emotion}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">メモ</label>
                    <Input
                      type="text"
                      placeholder="メモを入力..."
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="bg-background border-input"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="submit">
                    {editingId ? '更新' : '作成'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetForm}
                  >
                    キャンセル
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {loading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">読み込み中...</p>
            </div>
          ) : dialogues.length === 0 ? (
            <Card className="bg-card border-border p-12 text-center">
              <MessageSquare size={48} className="mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">セリフがありません</h3>
              <p className="text-muted-foreground">「新規作成」ボタンで最初のセリフを作成してください</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {dialogues.map((dialogue) => (
                <Card key={dialogue.id} className="bg-card border-border p-4 hover:border-primary/50 transition">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="font-medium text-foreground break-words">{dialogue.text}</p>
                        {dialogue.audio_id && (
                          <button className="flex-shrink-0 p-1 hover:bg-primary/20 rounded transition">
                            <Play size={16} className="text-primary" />
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 text-sm">
                        {dialogue.character_id && (
                          <span className="px-2 py-1 bg-primary/20 text-primary rounded">
                            {characters.find((c) => c.id === dialogue.character_id)?.name}
                          </span>
                        )}
                        {dialogue.emotion && (
                          <span className="px-2 py-1 bg-accent/20 text-accent rounded">
                            {dialogue.emotion}
                          </span>
                        )}
                      </div>
                      {dialogue.notes && (
                        <p className="text-sm text-muted-foreground mt-2">メモ: {dialogue.notes}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(dialogue.created_at).toLocaleDateString('ja-JP')}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleEdit(dialogue)}
                        className="p-2 hover:bg-primary/20 rounded-lg transition"
                      >
                        <Edit2 size={16} className="text-primary" />
                      </button>
                      <button
                        onClick={() => handleDelete(dialogue.id)}
                        className="p-2 hover:bg-destructive/20 rounded-lg transition"
                      >
                        <Trash2 size={16} className="text-destructive" />
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
