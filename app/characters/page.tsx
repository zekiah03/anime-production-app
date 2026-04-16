'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Music, Users, MessageSquare, Film, Plus, Trash2, Edit2 } from 'lucide-react'
import type { Character } from '@/types/db'

export default function CharactersPage() {
  // TODO: DBを組んだらここをfetch等に差し替える
  const [characters, setCharacters] = useState<Character[]>([])
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ name: '', description: '' })
  const [editingId, setEditingId] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.name.trim()) return

    const now = new Date().toISOString()

    if (editingId) {
      setCharacters((prev) =>
        prev.map((c) =>
          c.id === editingId
            ? { ...c, name: formData.name, description: formData.description || null, updated_at: now }
            : c,
        ),
      )
      setEditingId(null)
    } else {
      const newChar: Character = {
        id: crypto.randomUUID(),
        name: formData.name,
        description: formData.description || null,
        image_url: null,
        created_at: now,
        updated_at: now,
      }
      setCharacters((prev) => [newChar, ...prev])
    }
    setFormData({ name: '', description: '' })
    setShowForm(false)
  }

  function handleDelete(id: string) {
    if (!confirm('削除してよろしいですか？')) return
    setCharacters((prev) => prev.filter((c) => c.id !== id))
  }

  function handleEdit(character: Character) {
    setFormData({ name: character.name, description: character.description || '' })
    setEditingId(character.id)
    setShowForm(true)
  }

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
          <Link href="/characters" className="flex items-center gap-3 px-4 py-3 rounded-lg bg-sidebar-primary/20 text-sidebar-primary font-medium">
            <Users size={20} />
            キャラクター
          </Link>
          <Link href="/audio" className="flex items-center gap-3 px-4 py-3 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent/20 transition">
            <Music size={20} />
            音声
          </Link>
          <Link href="/dialogues" className="flex items-center gap-3 px-4 py-3 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent/20 transition">
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
              <h2 className="text-3xl font-bold text-foreground">キャラクター管理</h2>
              <p className="text-muted-foreground mt-1">キャラクターの作成と管理</p>
            </div>
            <Button
              onClick={() => {
                setEditingId(null)
                setFormData({ name: '', description: '' })
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
                {editingId ? 'キャラクターを編集' : '新規キャラクターを作成'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">キャラクター名</label>
                  <Input
                    type="text"
                    placeholder="例：太郎"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="bg-background border-input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">説明</label>
                  <textarea
                    placeholder="キャラクターの説明を入力..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    rows={3}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit">
                    {editingId ? '更新' : '作成'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowForm(false)
                      setEditingId(null)
                      setFormData({ name: '', description: '' })
                    }}
                  >
                    キャンセル
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {characters.length === 0 ? (
            <Card className="bg-card border-border p-12 text-center">
              <Users size={48} className="mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">キャラクターがありません</h3>
              <p className="text-muted-foreground">「新規作成」ボタンで最初のキャラクターを作成してください</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {characters.map((character) => (
                <Card key={character.id} className="bg-card border-border p-6 hover:border-primary/50 transition">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg font-semibold text-foreground">{character.name}</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(character)}
                        className="p-2 hover:bg-primary/20 rounded-lg transition"
                      >
                        <Edit2 size={16} className="text-primary" />
                      </button>
                      <button
                        onClick={() => handleDelete(character.id)}
                        className="p-2 hover:bg-destructive/20 rounded-lg transition"
                      >
                        <Trash2 size={16} className="text-destructive" />
                      </button>
                    </div>
                  </div>
                  {character.description && (
                    <p className="text-sm text-muted-foreground">{character.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-4">
                    作成日: {new Date(character.created_at).toLocaleDateString('ja-JP')}
                  </p>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
