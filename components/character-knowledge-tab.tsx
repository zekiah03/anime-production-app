'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Save, BookOpen } from 'lucide-react'
import type { Character, CharacterKnowledge } from '@/types/db'
import { saveCharacter } from '@/lib/db'

interface Props {
  character: Character
  onChange: (next: Character) => void
}

const EMPTY_KNOWLEDGE: CharacterKnowledge = {
  basic_setting: '',
  personality: '',
  speech_pattern: '',
  backstory: '',
  preferences: '',
  relationships: '',
  sample_dialogues: '',
  notes: '',
}

interface FieldDef {
  key: keyof CharacterKnowledge
  label: string
  placeholder: string
  rows: number
}

const FIELDS: FieldDef[] = [
  {
    key: 'basic_setting',
    label: '基本設定',
    placeholder: '名前 / 年齢 / 性別 / 職業 / 種族 / 身長 など',
    rows: 3,
  },
  {
    key: 'personality',
    label: '性格',
    placeholder: '明るい / 内向的 / 短気 / お人好し など。長所・短所も',
    rows: 3,
  },
  {
    key: 'speech_pattern',
    label: '口調・一人称',
    placeholder: '一人称(俺/僕/私) / 語尾(〜だよ、〜じゃん) / よく使う口癖',
    rows: 3,
  },
  {
    key: 'backstory',
    label: '背景・経歴',
    placeholder: '出身 / 家族構成 / 重要な過去のエピソード / 現在の状況',
    rows: 4,
  },
  {
    key: 'preferences',
    label: '好き嫌い',
    placeholder: '好きな食べ物 / 嫌いなもの / 趣味 / 苦手なシチュエーション',
    rows: 3,
  },
  {
    key: 'relationships',
    label: '関係性',
    placeholder: '他キャラとの関係(友人/恋人/師弟/ライバル など)、立場',
    rows: 3,
  },
  {
    key: 'sample_dialogues',
    label: 'サンプルセリフ',
    placeholder: '実際にこのキャラが言いそうな台詞を5〜10例。AIに口調を覚えさせる時に重要',
    rows: 6,
  },
  {
    key: 'notes',
    label: 'メモ',
    placeholder: '上記に当てはまらない設定、世界観、その他',
    rows: 3,
  },
]

export function CharacterKnowledgeTab({ character, onChange }: Props) {
  const [draft, setDraft] = useState<CharacterKnowledge>(
    character.knowledge ?? EMPTY_KNOWLEDGE,
  )
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  useEffect(() => {
    setDraft(character.knowledge ?? EMPTY_KNOWLEDGE)
    setSavedAt(null)
  }, [character.id])

  const dirty = JSON.stringify(draft) !== JSON.stringify(character.knowledge ?? EMPTY_KNOWLEDGE)

  async function handleSave() {
    setSaving(true)
    try {
      const updated: Character = {
        ...character,
        knowledge: draft,
        updated_at: new Date().toISOString(),
      }
      await saveCharacter(updated)
      onChange(updated)
      setSavedAt(new Date().toLocaleTimeString('ja-JP'))
    } catch (e) {
      console.error('[anime-app] save knowledge failed', e)
      alert('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen size={18} className="text-primary" />
          <p className="text-sm text-muted-foreground">
            このキャラのナレッジベース。将来 AI にセリフを書かせる時の素材になります
          </p>
        </div>
        <div className="flex items-center gap-2">
          {savedAt && !dirty && (
            <span className="text-xs text-muted-foreground">{savedAt} 保存済み</span>
          )}
          <Button size="sm" onClick={handleSave} disabled={!dirty || saving} className="gap-1">
            <Save size={14} />
            {saving ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {FIELDS.map((f) => (
          <div
            key={f.key}
            className={f.key === 'sample_dialogues' || f.key === 'backstory' ? 'md:col-span-2' : ''}
          >
            <label className="block text-sm font-medium text-foreground mb-1">{f.label}</label>
            <textarea
              value={draft[f.key]}
              onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
              placeholder={f.placeholder}
              rows={f.rows}
              className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
