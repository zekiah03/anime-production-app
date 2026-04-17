'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Music, Pause, Trash2, Play } from 'lucide-react'
import type { AudioFile, Character } from '@/types/db'
import { deleteAudioFile, saveAudioFile } from '@/lib/db'

interface Props {
  character: Character
  audioFiles: AudioFile[]
  onChange: (next: AudioFile[]) => void
}

export function CharacterAudioTab({ character, audioFiles, onChange }: Props) {
  const [isRecording, setIsRecording] = useState(false)
  const [audioName, setAudioName] = useState('')
  const [playingId, setPlayingId] = useState<string | null>(null)
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
            {audioFiles.map((audio) => (
              <div
                key={audio.id}
                className="flex items-center justify-between gap-2 p-3 bg-background rounded border border-border"
              >
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
                  >
                    {playingId === audio.id ? <Pause size={14} /> : <Play size={14} />}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(audio.id)}
                    className="gap-1 text-destructive hover:bg-destructive/20"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
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
