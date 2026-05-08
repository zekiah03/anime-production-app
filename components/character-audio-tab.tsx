'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Music, Pause, Trash2, Play, Sparkles, Loader2, Wand2 } from 'lucide-react'
import type { AudioFile, Character, CharacterKnowledge, Dialogue } from '@/types/db'
import { deleteAudioFile, saveAudioFile, saveDialogue } from '@/lib/db'

interface Props {
  character: Character
  audioFiles: AudioFile[]
  onChange: (next: AudioFile[]) => void
  // 親(キャラ詳細)の dialogues state を更新するコールバック。
  // AI 候補から作った Dialogue を即座にセリフタブに反映するために使う。
  onCreateDialogue?: (d: Dialogue) => void
}

interface Suggestion {
  text: string
  emotion: string
  notes: string
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

export function CharacterAudioTab({ character, audioFiles, onChange, onCreateDialogue }: Props) {
  const [isRecording, setIsRecording] = useState(false)
  const [audioName, setAudioName] = useState('')
  const [playingId, setPlayingId] = useState<string | null>(null)
  // どの音声に対して AI 候補を出してるか
  const [suggestForId, setSuggestForId] = useState<string | null>(null)
  const [scenarioHint, setScenarioHint] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [suggestError, setSuggestError] = useState<string | null>(null)
  const [picking, setPicking] = useState<string | null>(null)

  async function handleSuggest(audio: AudioFile) {
    if (suggestLoading) return
    setSuggestLoading(true)
    setSuggestError(null)
    setSuggestions([])
    try {
      const res = await fetch('/api/generate-dialogue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterName: character.name,
          knowledge: character.knowledge ?? EMPTY_KNOWLEDGE,
          scenario:
            scenarioHint.trim() ||
            `「${audio.name}」というタイトルで録音した音声に当てる短いセリフを提案してください。録音内容に合いそうな自然な発話。`,
          count: 5,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `${res.status}`)
      setSuggestions((data.dialogues ?? []) as Suggestion[])
    } catch (e) {
      setSuggestError((e as Error).message)
    } finally {
      setSuggestLoading(false)
    }
  }

  async function handlePick(audio: AudioFile, sug: Suggestion) {
    setPicking(audio.id + '|' + sug.text)
    try {
      const now = new Date().toISOString()
      const dialogue: Dialogue = {
        id: crypto.randomUUID(),
        text: sug.text,
        character_id: character.id,
        audio_id: audio.id,
        expression_id: null,
        emotion: sug.emotion || null,
        notes: sug.notes || null,
        duration_ms: null,
        created_at: now,
        updated_at: now,
      }
      await saveDialogue(dialogue)
      onCreateDialogue?.(dialogue)
      // 候補を閉じる
      setSuggestForId(null)
      setSuggestions([])
      setScenarioHint('')
    } catch (e) {
      setSuggestError((e as Error).message)
    } finally {
      setPicking(null)
    }
  }
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data)
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (error) {
      console.error('[anime-app] Error starting recording:', error)
      alert('マイクへのアクセスが許可されていません')
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current
    if (!recorder) return

    recorder.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
      const blobUrl = URL.createObjectURL(audioBlob)

      const newAudio: AudioFile = {
        id: crypto.randomUUID(),
        name: audioName || `${character.name}の音声`,
        file_url: blobUrl,
        file_blob: audioBlob,
        duration: audioChunksRef.current.length > 0 ? audioBlob.size / 16000 : 0,
        character_id: character.id,
        created_at: new Date().toISOString(),
      }

      try {
        await saveAudioFile(newAudio)
        onChange([newAudio, ...audioFiles])
      } catch (e) {
        console.error('[anime-app] save audio failed', e)
        alert('音声の保存に失敗しました')
      }
      setAudioName('')
    }

    recorder.stop()
    recorder.stream.getTracks().forEach((track) => track.stop())
    setIsRecording(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('この音声を削除しますか？')) return
    await deleteAudioFile(id)
    const target = audioFiles.find((a) => a.id === id)
    if (target?.file_url.startsWith('blob:')) URL.revokeObjectURL(target.file_url)
    onChange(audioFiles.filter((a) => a.id !== id))
  }

  return (
    <div className="space-y-4">
      <div className="border border-border rounded-lg p-4 bg-muted/30">
        <h4 className="font-semibold text-foreground mb-3">新規録音</h4>
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex-1">
            <label className="block text-xs text-muted-foreground mb-1">録音名(任意)</label>
            <Input
              placeholder={`${character.name}のセリフ1`}
              value={audioName}
              onChange={(e) => setAudioName(e.target.value)}
              disabled={isRecording}
            />
          </div>
          <Button
            onClick={isRecording ? stopRecording : startRecording}
            className={isRecording ? 'bg-destructive hover:bg-destructive/90 gap-1' : 'gap-1'}
          >
            {isRecording ? (
              <>
                <Pause size={16} /> 停止
              </>
            ) : (
              <>
                <Music size={16} /> 録音開始
              </>
            )}
          </Button>
        </div>
        {isRecording && <p className="text-xs text-destructive mt-2">録音中...</p>}
      </div>

      <div>
        <h4 className="font-semibold text-foreground mb-2">録音済み音声</h4>
        {audioFiles.length === 0 ? (
          <p className="text-sm text-muted-foreground">まだ音声がありません</p>
        ) : (
          <div className="space-y-2">
            {audioFiles.map((audio) => {
              const isOpen = suggestForId === audio.id
              return (
                <div
                  key={audio.id}
                  className="bg-background rounded border border-border"
                >
                  <div className="flex items-center justify-between gap-2 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{audio.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(audio.created_at).toLocaleDateString('ja-JP')}
                      </p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPlayingId(playingId === audio.id ? null : audio.id)}
                        className="gap-1"
                        title="再生"
                      >
                        {playingId === audio.id ? <Pause size={14} /> : <Play size={14} />}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (isOpen) {
                            setSuggestForId(null)
                            setSuggestions([])
                            setSuggestError(null)
                          } else {
                            setSuggestForId(audio.id)
                            setSuggestions([])
                            setSuggestError(null)
                            setScenarioHint('')
                          }
                        }}
                        className="gap-1"
                        title="この音声に対するセリフ候補を AI で生成"
                      >
                        <Sparkles size={14} className="text-primary" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(audio.id)}
                        className="gap-1 text-destructive hover:bg-destructive/20"
                        title="削除"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="border-t border-border p-3 bg-muted/30 space-y-3">
                      <div className="flex flex-col md:flex-row gap-2">
                        <Input
                          placeholder="シチュエーションのヒント(任意): 例『屋上で愚痴る』"
                          value={scenarioHint}
                          onChange={(e) => setScenarioHint(e.target.value)}
                          disabled={suggestLoading}
                        />
                        <Button
                          size="sm"
                          onClick={() => handleSuggest(audio)}
                          disabled={suggestLoading}
                          className="gap-1 flex-shrink-0"
                        >
                          {suggestLoading ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Wand2 size={14} />
                          )}
                          {suggestLoading ? '生成中...' : 'セリフ候補を生成'}
                        </Button>
                      </div>
                      {suggestError && (
                        <p className="text-xs text-destructive">{suggestError}</p>
                      )}
                      {suggestions.length > 0 && (
                        <ul className="space-y-1">
                          {suggestions.map((s, i) => {
                            const key = audio.id + '|' + s.text
                            const busy = picking === key
                            return (
                              <li
                                key={i}
                                className="flex items-start gap-2 p-2 bg-background border border-border rounded hover:border-primary/40 transition"
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-foreground break-words">{s.text}</p>
                                  <div className="flex flex-wrap gap-1 mt-1 text-[10px]">
                                    {s.emotion && s.emotion !== '通常' && (
                                      <span className="px-1.5 py-0.5 bg-accent/20 text-accent rounded">
                                        {s.emotion}
                                      </span>
                                    )}
                                    {s.notes && (
                                      <span className="px-1.5 py-0.5 bg-muted text-muted-foreground rounded">
                                        {s.notes}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handlePick(audio, s)}
                                  disabled={busy}
                                  className="gap-1 flex-shrink-0"
                                >
                                  {busy ? (
                                    <Loader2 size={12} className="animate-spin" />
                                  ) : (
                                    <Sparkles size={12} />
                                  )}
                                  これにする
                                </Button>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                      <p className="text-[10px] text-muted-foreground">
                        選んだ候補は、このキャラの新しいセリフとしてこの音声に紐付けられます
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
        {playingId && (
          <audio
            key={playingId}
            src={audioFiles.find((a) => a.id === playingId)?.file_url}
            autoPlay
            controls
            onEnded={() => setPlayingId(null)}
            className="w-full mt-3"
          />
        )}
      </div>
    </div>
  )
}
