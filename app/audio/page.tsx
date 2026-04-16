'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Music, Users, MessageSquare, Film, Trash2, Play, Pause, Download, Layers } from 'lucide-react'
import type { AudioFile, Character } from '@/types/db'
import {
  deleteAudioFile,
  getAllAudioFiles,
  getAllCharacters,
  saveAudioFile,
} from '@/lib/db'

export default function AudioPage() {
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([])
  const [characters, setCharacters] = useState<Character[]>([])
  const [loading, setLoading] = useState(true)
  const [isRecording, setIsRecording] = useState(false)
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>('')
  const [audioName, setAudioName] = useState('')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const [playingId, setPlayingId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    Promise.all([getAllAudioFiles(), getAllCharacters()])
      .then(([audio, chars]) => {
        setAudioFiles(audio)
        setCharacters(chars)
      })
      .catch((e) => console.error('[anime-app] load audio page failed', e))
      .finally(() => setLoading(false))
  }, [])

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
    if (!mediaRecorderRef.current) return

    mediaRecorderRef.current.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
      const blobUrl = URL.createObjectURL(audioBlob)

      const newAudio: AudioFile = {
        id: crypto.randomUUID(),
        name: audioName || 'No name',
        file_url: blobUrl,
        file_blob: audioBlob,
        duration: audioChunksRef.current.length > 0 ? audioBlob.size / 16000 : 0,
        character_id: selectedCharacterId || null,
        created_at: new Date().toISOString(),
      }

      try {
        await saveAudioFile(newAudio)
        setAudioFiles((prev) => [newAudio, ...prev])
      } catch (e) {
        console.error('[anime-app] save audio failed', e)
        alert('音声の保存に失敗しました')
      }
      setAudioName('')
      setSelectedCharacterId('')
    }

    mediaRecorderRef.current.stop()
    mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop())
    setIsRecording(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('削除してよろしいですか？')) return
    await deleteAudioFile(id)
    setAudioFiles((prev) => {
      const target = prev.find((a) => a.id === id)
      if (target?.file_url.startsWith('blob:')) URL.revokeObjectURL(target.file_url)
      return prev.filter((a) => a.id !== id)
    })
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
          <Link href="/characters" className="flex items-center gap-3 px-4 py-3 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent/20 transition">
            <Users size={20} />
            キャラクター
          </Link>
          <Link href="/illustrations" className="flex items-center gap-3 px-4 py-3 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent/20 transition">
            <Layers size={20} />
            イラスト
          </Link>
          <Link href="/audio" className="flex items-center gap-3 px-4 py-3 rounded-lg bg-sidebar-primary/20 text-sidebar-primary font-medium">
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
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-foreground">音声管理</h2>
            <p className="text-muted-foreground mt-1">音声を録音・管理します</p>
          </div>

          {/* 録音セクション */}
          <Card className="bg-card border-border p-6 mb-8">
            <h3 className="text-xl font-semibold text-foreground mb-4">新規録音</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">録音名</label>
                  <input
                    type="text"
                    placeholder="例：主人公のセリフ1"
                    value={audioName}
                    onChange={(e) => setAudioName(e.target.value)}
                    disabled={isRecording}
                    className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">キャラクター</label>
                  <select
                    value={selectedCharacterId}
                    onChange={(e) => setSelectedCharacterId(e.target.value)}
                    disabled={isRecording}
                    className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  >
                    <option value="">未選択</option>
                    {characters.map((char) => (
                      <option key={char.id} value={char.id}>
                        {char.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={isRecording ? 'bg-destructive hover:bg-destructive/90' : ''}
                >
                  {isRecording ? (
                    <>
                      <Pause size={18} />
                      停止
                    </>
                  ) : (
                    <>
                      <Music size={18} />
                      録音開始
                    </>
                  )}
                </Button>
                {isRecording && <span className="text-sm text-destructive flex items-center">録音中...</span>}
              </div>
            </div>
          </Card>

          {/* 音声ファイル一覧 */}
          <div>
            <h3 className="text-xl font-semibold text-foreground mb-4">録音済みファイル</h3>
            {loading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">読み込み中...</p>
              </div>
            ) : audioFiles.length === 0 ? (
              <Card className="bg-card border-border p-12 text-center">
                <Music size={48} className="mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-2">音声ファイルがありません</h3>
                <p className="text-muted-foreground">上記の「録音開始」ボタンで新しい音声を録音してください</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {audioFiles.map((audio) => (
                  <Card key={audio.id} className="bg-card border-border p-4 hover:border-primary/50 transition">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-foreground">{audio.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {characters.find((c) => c.id === audio.character_id)?.name || '未割り当て'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(audio.created_at).toLocaleDateString('ja-JP')}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPlayingId(playingId === audio.id ? null : audio.id)}
                          className="gap-1"
                        >
                          {playingId === audio.id ? <Pause size={16} /> : <Play size={16} />}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(audio.file_url, '_blank')}
                          className="gap-1"
                        >
                          <Download size={16} />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(audio.id)}
                          className="gap-1 text-destructive hover:bg-destructive/20"
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </div>
                    {playingId === audio.id && (
                      <audio
                        ref={audioRef}
                        src={audio.file_url}
                        autoPlay
                        onEnded={() => setPlayingId(null)}
                        className="mt-3 w-full"
                        controls
                      />
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
