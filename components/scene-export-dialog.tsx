'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Download, Square, Video } from 'lucide-react'
import type {
  AudioFile,
  Character,
  CharacterExpression,
  SceneWithDialogues,
} from '@/types/db'

interface ResolvedDialogue {
  text: string
  character: Character
  audio: AudioFile
  mouthOpen: CharacterExpression | null
  mouthClosed: CharacterExpression | null
  blink: CharacterExpression | null
  override: CharacterExpression | null
}

// 書き出し解像度は縦型ショート動画を意識した 9:16。将来 UI で切替可能にしてもよい。
const WIDTH = 720
const HEIGHT = 1280
const LIPSYNC_THRESHOLD = 40
const TICK_MS = 100

type Status = 'idle' | 'preparing' | 'recording' | 'complete' | 'error'

export function SceneExportDialog({
  scene,
  characters,
  audioFiles,
  expressions,
  open,
  onClose,
}: {
  scene: SceneWithDialogues | null
  characters: Character[]
  audioFiles: AudioFile[]
  expressions: CharacterExpression[]
  open: boolean
  onClose: () => void
}) {
  const [status, setStatus] = useState<Status>('idle')
  const [progressIndex, setProgressIndex] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const cancelledRef = useRef(false)

  const queue: ResolvedDialogue[] = scene
    ? scene.dialogues
        .map((sd) => {
          const d = sd.dialogue
          if (!d) return null
          const character = characters.find((c) => c.id === d.character_id) ?? null
          const audio = audioFiles.find((a) => a.id === d.audio_id) ?? null
          if (!character || !audio) return null
          const charExpressions = expressions.filter((x) => x.character_id === character.id)
          return {
            text: d.text,
            character,
            audio,
            mouthOpen: charExpressions.find((x) => x.kind === 'mouth_open') ?? null,
            mouthClosed: charExpressions.find((x) => x.kind === 'mouth_closed') ?? null,
            blink: charExpressions.find((x) => x.kind === 'blink') ?? null,
            override: d.expression_id
              ? charExpressions.find((x) => x.id === d.expression_id) ?? null
              : null,
          } as ResolvedDialogue
        })
        .filter((x): x is ResolvedDialogue => x !== null)
    : []

  // ダイアログを閉じたとき/シーンが変わったときにリセット
  useEffect(() => {
    if (!open) {
      setStatus('idle')
      setProgressIndex(0)
      setErrorMessage(null)
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      cancelledRef.current = false
    }
  }, [open, scene?.id])

  function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error(`画像の読み込みに失敗: ${url}`))
      img.src = url
    })
  }

  function drawFrame(
    ctx: CanvasRenderingContext2D,
    current: ResolvedDialogue,
    cache: Map<string, HTMLImageElement>,
    mouthOpen: boolean,
    blinking: boolean,
  ) {
    ctx.fillStyle = '#111111'
    ctx.fillRect(0, 0, WIDTH, HEIGHT)

    let imgUrl: string | null = null
    // 瞬き中はすべてに優先して差し替え(パッと閉じてパッと開く)
    if (blinking && current.blink) {
      imgUrl = current.blink.image_url
    } else if (current.override) {
      imgUrl = current.override.image_url
    } else if (current.mouthOpen && current.mouthClosed) {
      imgUrl = (mouthOpen ? current.mouthOpen : current.mouthClosed).image_url
    } else if (current.character.image_url) {
      imgUrl = current.character.image_url
    }

    if (imgUrl) {
      const img = cache.get(imgUrl)
      if (img) {
        const scale = Math.min(WIDTH / img.width, HEIGHT / img.height)
        const w = img.width * scale
        const h = img.height * scale
        const x = (WIDTH - w) / 2
        const y = (HEIGHT - h) / 2
        ctx.drawImage(img, x, y, w, h)
      }
    }

    if (current.text) {
      const fontSize = 44
      ctx.font = `bold ${fontSize}px "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'

      const maxBandWidth = WIDTH - 80
      const metrics = ctx.measureText(current.text)
      const padX = 28
      const padY = 18
      const bandWidth = Math.min(maxBandWidth, metrics.width + padX * 2)
      const bandHeight = fontSize + padY * 2
      const bandX = (WIDTH - bandWidth) / 2
      const bandY = HEIGHT - bandHeight - 60

      ctx.fillStyle = 'rgba(0, 0, 0, 0.72)'
      ctx.beginPath()
      ctx.roundRect(bandX, bandY, bandWidth, bandHeight, 14)
      ctx.fill()

      const textY = bandY + bandHeight - padY
      ctx.lineWidth = 6
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)'
      ctx.strokeText(current.text, WIDTH / 2, textY)
      ctx.fillStyle = '#ffffff'
      ctx.fillText(current.text, WIDTH / 2, textY)
    }
  }

  async function startExport() {
    if (!canvasRef.current || queue.length === 0) return
    cancelledRef.current = false
    setStatus('preparing')
    setProgressIndex(0)
    setErrorMessage(null)
    setBlobUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })

    const canvas = canvasRef.current
    canvas.width = WIDTH
    canvas.height = HEIGHT
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      setErrorMessage('canvas 2d context が取得できません')
      setStatus('error')
      return
    }

    // 画像を全部先読みしておく(書き出し中にloadが挟まると音ズレの原因)
    const imageCache = new Map<string, HTMLImageElement>()
    const urls = new Set<string>()
    queue.forEach((q) => {
      if (q.character.image_url) urls.add(q.character.image_url)
      if (q.mouthOpen) urls.add(q.mouthOpen.image_url)
      if (q.mouthClosed) urls.add(q.mouthClosed.image_url)
      if (q.blink) urls.add(q.blink.image_url)
      if (q.override) urls.add(q.override.image_url)
    })

    let audioCtx: AudioContext | null = null
    let recorder: MediaRecorder | null = null

    try {
      await Promise.all(
        Array.from(urls).map(async (url) => {
          imageCache.set(url, await loadImage(url))
        }),
      )

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      audioCtx = new AudioCtx()
      if (audioCtx.state === 'suspended') await audioCtx.resume()

      const destination = audioCtx.createMediaStreamDestination()
      const videoStream = canvas.captureStream(30)
      const combinedStream = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...destination.stream.getAudioTracks(),
      ])

      const mimeType =
        [
          'video/webm;codecs=vp9,opus',
          'video/webm;codecs=vp8,opus',
          'video/webm',
        ].find((t) => MediaRecorder.isTypeSupported(t)) ?? ''

      recorder = new MediaRecorder(
        combinedStream,
        mimeType ? { mimeType } : undefined,
      )
      const chunks: Blob[] = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }
      const recordingDone = new Promise<void>((resolve) => {
        if (!recorder) {
          resolve()
          return
        }
        recorder.onstop = () => resolve()
      })

      recorder.start(100)
      setStatus('recording')

      for (let i = 0; i < queue.length; i++) {
        if (cancelledRef.current) break
        setProgressIndex(i)
        const current = queue[i]

        const audioEl = new Audio()
        audioEl.src = current.audio.file_url
        audioEl.preload = 'auto'

        await new Promise<void>((resolve, reject) => {
          const onReady = () => resolve()
          const onErr = () => reject(new Error('音声の読み込みに失敗'))
          audioEl.addEventListener('canplaythrough', onReady, { once: true })
          audioEl.addEventListener('error', onErr, { once: true })
          audioEl.load()
        })

        const source = audioCtx.createMediaElementSource(audioEl)
        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 512
        source.connect(analyser)
        analyser.connect(destination)
        analyser.connect(audioCtx.destination) // プレビュー用スピーカー出力

        const freq = new Uint8Array(analyser.frequencyBinCount)
        let mouthOpen = false
        let lastTick = performance.now()
        let raf: number | null = null

        // 瞬きタイマー: 3〜5秒間隔で 80ms だけパッと閉じる
        let blinking = false
        let blinkEndAt = 0
        let nextBlinkAt = performance.now() + 3000 + Math.random() * 2000

        await new Promise<void>((resolve, reject) => {
          audioEl.addEventListener('ended', () => resolve(), { once: true })
          audioEl.addEventListener('error', () => reject(new Error('再生エラー')), {
            once: true,
          })
          audioEl.play().catch(reject)

          const tick = (now: number) => {
            if (cancelledRef.current) {
              resolve()
              return
            }
            if (now - lastTick >= TICK_MS) {
              analyser.getByteFrequencyData(freq)
              let sum = 0
              for (let k = 0; k < freq.length; k++) sum += freq[k]
              mouthOpen = sum / freq.length > LIPSYNC_THRESHOLD
              lastTick = now
            }
            // 瞬き状態の更新
            if (blinking && now >= blinkEndAt) {
              blinking = false
              nextBlinkAt = now + 3000 + Math.random() * 2000
            } else if (!blinking && now >= nextBlinkAt) {
              blinking = true
              blinkEndAt = now + 80
            }
            drawFrame(ctx, current, imageCache, mouthOpen, blinking)
            raf = requestAnimationFrame(tick)
          }
          raf = requestAnimationFrame(tick)
        })

        if (raf !== null) cancelAnimationFrame(raf)
        try {
          source.disconnect()
          analyser.disconnect()
        } catch (e) {
          console.warn('[anime-app] disconnect warn', e)
        }
        audioEl.src = ''
      }

      recorder.stop()
      await recordingDone

      if (cancelledRef.current) {
        setStatus('idle')
        return
      }

      const blob = new Blob(chunks, { type: mimeType || 'video/webm' })
      setBlobUrl(URL.createObjectURL(blob))
      setStatus('complete')
    } catch (e) {
      console.error('[anime-app] export failed', e)
      setErrorMessage((e as Error).message)
      setStatus('error')
      try {
        recorder?.state !== 'inactive' && recorder?.stop()
      } catch {}
    } finally {
      try {
        await audioCtx?.close()
      } catch {}
    }
  }

  function cancel() {
    cancelledRef.current = true
  }

  function downloadVideo() {
    if (!blobUrl) return
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = `${scene?.title ?? 'scene'}.webm`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const skipped = scene ? scene.dialogues.length - queue.length : 0

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{scene?.title ?? 'シーン'} を動画として書き出し</DialogTitle>
          <DialogDescription>
            キャラと音声が設定されたセリフを順番に繋いで WebM 動画を生成します(
            {queue.length} / {scene?.dialogues.length ?? 0} 件対象
            {skipped > 0 ? `、${skipped} 件はスキップ` : ''})
          </DialogDescription>
        </DialogHeader>

        {queue.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            書き出しできるセリフがありません。キャラクターと音声を紐付けたセリフを追加してください
          </p>
        ) : (
          <div className="space-y-4">
            <canvas
              ref={canvasRef}
              className="mx-auto border border-border rounded bg-black"
              style={{ width: 240, aspectRatio: '9 / 16' }}
            />

            {status === 'idle' && (
              <Button onClick={startExport} className="gap-2 w-full">
                <Video size={18} /> 書き出し開始
              </Button>
            )}

            {(status === 'preparing' || status === 'recording') && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground text-center">
                  {status === 'preparing'
                    ? '画像読み込み中...'
                    : `録画中 ${progressIndex + 1} / ${queue.length}`}
                </p>
                <Button variant="outline" onClick={cancel} className="gap-2 w-full">
                  <Square size={16} /> 中止
                </Button>
              </div>
            )}

            {status === 'complete' && blobUrl && (
              <div className="space-y-3">
                <video src={blobUrl} controls className="w-full rounded" />
                <Button onClick={downloadVideo} className="gap-2 w-full">
                  <Download size={16} /> ダウンロード (.webm)
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  mp4 にしたい場合は VLC や Handbrake などで変換してください
                </p>
              </div>
            )}

            {status === 'error' && (
              <div className="space-y-2">
                <p className="text-sm text-destructive">エラー: {errorMessage}</p>
                <Button variant="outline" onClick={() => setStatus('idle')}>
                  再試行
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
