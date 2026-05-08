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
  motivation: '',
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
    placeholder:
      '名前 / 年齢 / 性別 / 職業 / 種族 / 身長 / 容姿の特徴 / 所属 など、「箱書き」レベルの事実情報',
    rows: 3,
  },
  {
    key: 'personality',
    label: '性格',
    placeholder:
      `表面的な印象と内面のギャップを書くと精度が上がる。
例:
- 表は天真爛漫で誰とでも仲良くなるが、本当はかなり繊細で気を使い疲れる
- プライドが高く負けを認められない / 仲間思いだが素直になれず憎まれ口
- 長所: 集中力 / 短所: 視野が狭くなる`,
    rows: 5,
  },
  {
    key: 'motivation',
    label: '行動原理',
    placeholder:
      `このキャラを動かす「根本動機・恐れ・欲求」。なぜそう振る舞うのかの理由。
例:
- 子供のころ無視されてきた反動で、誰かに必要とされたい欲求が強い
- 妹を病気で失った経験があり、目の前で誰かが傷つくのが耐えられない
- 自分が弱いと知っているから、強く見せて隙を見せないようにしている
- 自由でいたい / 何かを守りたい / 認められたい / 裏切られたくない etc.`,
    rows: 5,
  },
  {
    key: 'speech_pattern',
    label: '口調・一人称',
    placeholder:
      '一人称(俺/僕/私/うち) / 二人称(お前/君) / 語尾(〜だよ、〜じゃん、〜だぜ) / よく使う口癖・決め台詞',
    rows: 3,
  },
  {
    key: 'backstory',
    label: '背景・経歴',
    placeholder:
      `形成期の重要な経験を時系列で書くと AI が一貫性を保ちやすい。
- 出身・家族構成
- 形成期の決定的な出来事(成功体験 / トラウマ / 喪失)
- 現在の立場・置かれている状況
- 今、何に向き合っているか`,
    rows: 5,
  },
  {
    key: 'preferences',
    label: '好き嫌い',
    placeholder:
      '好きな食べ物 / 嫌いなもの / 趣味・特技 / 苦手なシチュエーション / 譲れないこだわり',
    rows: 3,
  },
  {
    key: 'relationships',
    label: '関係性',
    placeholder:
      '他キャラとの関係(友人/恋人/師弟/ライバル/家族)、それぞれへの感情・距離感、社会的な立場',
    rows: 3,
  },
  {
    key: 'sample_dialogues',
    label: 'サンプルセリフ',
    placeholder:
      'このキャラが言いそうな台詞を5〜10例。状況・感情ごとに振れ幅を入れると AI が口調を学習しやすい',
    rows: 6,
  },
  {
    key: 'notes',
    label: 'メモ',
    placeholder: '上記に当てはまらない設定、世界観、伏線、その他',
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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {FIELDS.map((f) => (
          <div
            key={f.key}
            className={
              f.key === 'sample_dialogues' || f.key === 'backstory'
                ? 'md:col-span-2 xl:col-span-3'
                : f.key === 'personality' || f.key === 'motivation'
                  ? 'md:col-span-2 xl:col-span-2'
                  : ''
            }
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
