'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Music, Pause, Trash2, Play, Loader2, FileText, Plus } from 'lucide-react'
import type { AudioFile, Character, Dialogue } from '@/types/db'
import { deleteAudioFile, saveAudioFile, saveDialogue } from '@/lib/db'

interface Props {
  character: Character
  audioFiles: AudioFile[]
  onChange: (next: AudioFile[]) => void
  // 親(キャラ詳細)の dialogues state を更新するコールバック。
  // 文字起こしから作った Dialogue を即座にセリフタブに反映するために使う。
  onCreateDialogue?: (d: Dialogue) => void
}

export function CharacterAudioTab({ character, audioFiles, onChange, onCreateDialogue }: Props) {
  const [isRecording, setIsRecording] = useState(false)
  const [audioName, setAudioName] = useState('')
  const [playingId, setPlayingId] = useState<string | null>(null)
  // どの音声に対して文字起こしパネルを開いているか。
  const [transcribeForId, setTranscribeForId] = useState<string | null>(null)
  // 文字起こし API 呼出中の audio.id。
  const [transcribingId, setTranscribingId] = useState<string | null>(null)
  // audio.id → 文字起こし結果(編集可能)。
  const [transcripts, setTranscripts] = useState<Record<string, string>>({})
  const [transcribeError, setTranscribeError] = useState<string | null>(null)
  // セリフ追加中の audio.id。
  const [addingId, setAddingId] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  async function handleTranscribe(audio: AudioFile) {
    if (transcribingId) return
    if (!audio.file_blob) {
      setTranscribeError(
        'この音声のデータが端末に残っていないため文字起こしできません(別端末で録音されたもの等)',
      )
      return
    }
    setTranscribingId(audio.id)
    setTranscribeError(null)
    try {
      const fd = new FormData()
      fd.append('file', audio.file_blob, (audio.name || 'audio') + '.webm')
      fd.append('language', 'ja')
      const res = await fetch('/api/transcribe-audio', {
        method: 'POST',
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `${res.status}`)
      const text = (data.text as string | undefined) ?? ''
      setTranscripts((prev) => ({ ...prev, [audio.id]: text }))
    } catch (e) {
      setTranscribeError((e as Error).message)
    } finally {
      setTranscribingId(null)
    }
  }

  async function handleAddAsDialogue(audio: AudioFile) {
    const text = (transcripts[audio.id] ?? '').trim()
    if (!text) return
    setAddingId(audio.id)
    try {
      const now = new Date().toISOString()
      const dialogue: Dialogue = {
        id: crypto.randomUUID(),
        text,
        character_id: character.id,
        audio_id: audio.id,
        expression_id: null,
        emotion: null,
        notes: null,
        duration_ms: null,
        created_at: now,
        updated_at: now,
      }
      await saveDialogue(dialogue)
      onCreateDialogue?.(dialogue)
      // パネルを閉じてリセット。
      setTranscribeForId(null)
      setTranscripts((prev) => {
        const { [audio.id]: _drop, ...rest } = prev
        return rest
      })
    } catch (e) {
      setTranscribeError((e as Error).message)
    } finally {
      setAddingId(null)
    }
  }

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
              const isOpen = transcribeForId === audio.id
              const transcript = transcripts[audio.id] ?? ''
              const busyTranscribe = transcribingId === audio.id
              const busyAdd = addingId === audio.id
              return (
                <div key={audio.id} className="bg-background rounded border border-border">
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
                            setTranscribeForId(null)
                            setTranscribeError(null)
                          } else {
                            setTranscribeForId(audio.id)
                            setTranscribeError(null)
                          }
                        }}
                        className="gap-1"
                        title="この音声を文字起こししてセリフに追加"
                      >
                        <FileText size={14} className="text-primary" />
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
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleTranscribe(audio)}
                          disabled={busyTranscribe}
                          className="gap-1 flex-shrink-0"
                        >
                          {busyTranscribe ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <FileText size={14} />
                          )}
                          {busyTranscribe ? '文字起こし中...' : '文字起こし(Whisper)'}
                        </Button>
                        <p className="text-[11px] text-muted-foreground">
                          OpenAI Whisper でこの録音を日本語に書き起こします
                        </p>
                      </div>
                      {transcribeError && (
                        <p className="text-xs text-destructive">{transcribeError}</p>
                      )}
                      {(transcript || busyTranscribe) && (
                        <div className="space-y-2">
                          <Textarea
                            value={transcript}
                            onChange={(e) =>
                              setTranscripts((prev) => ({ ...prev, [audio.id]: e.target.value }))
                            }
                            placeholder={busyTranscribe ? '文字起こし中...' : '(まだ結果なし)'}
                            disabled={busyTranscribe}
                            rows={3}
                            className="text-sm"
                          />
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAddAsDialogue(audio)}
                              disabled={busyAdd || !transcript.trim()}
                              className="gap-1"
                            >
                              {busyAdd ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Plus size={12} />
                              )}
                              セリフに追加
                            </Button>
                            <p className="text-[10px] text-muted-foreground">
                              テキストは追加前に編集できます
                            </p>
                          </div>
                        </div>
                      )}
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
