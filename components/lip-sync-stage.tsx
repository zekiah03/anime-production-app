'use client'

import { useEffect, useRef, useState } from 'react'
import { Users } from 'lucide-react'
import type { Character, CharacterExpression } from '@/types/db'

interface LipSyncStageProps {
  character: Character | null
  expressions: CharacterExpression[] // このキャラに紐づく表情のみ
  audioUrl?: string | null
  overrideExpressionId?: string | null
  threshold?: number
  playing: boolean
  onEnded?: () => void
  className?: string
}

// 音声に合わせて「口開け/口閉じ」画像をパッと切り替えるコンポーネント。
// AudioContext は初回 play で遅延生成し、以降は使い回す(MediaElementSource は要素ごとに1回のみ作成可)。
export function LipSyncStage({
  character,
  expressions,
  audioUrl,
  overrideExpressionId,
  threshold = 40,
  playing,
  onEnded,
  className,
}: LipSyncStageProps) {
  const [mouthOpen, setMouthOpen] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastTickRef = useRef<number>(0)
  const thresholdRef = useRef<number>(threshold)

  thresholdRef.current = threshold

  const mouthClosed = expressions.find((e) => e.kind === 'mouth_closed')
  const mouthOpenExpr = expressions.find((e) => e.kind === 'mouth_open')
  const override = overrideExpressionId
    ? expressions.find((e) => e.id === overrideExpressionId) ?? null
    : null

  function displayImage(): string | null {
    if (!character) return null
    if (playing && mouthOpenExpr && mouthClosed) {
      return mouthOpen ? mouthOpenExpr.image_url : mouthClosed.image_url
    }
    if (override) return override.image_url
    if (mouthClosed) return mouthClosed.image_url
    return character.image_url
  }

  function stopTick() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    setMouthOpen(false)
  }

  async function ensureGraph() {
    if (!audioRef.current) return
    if (!ctxRef.current) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      ctxRef.current = new Ctx()
    }
    const ctx = ctxRef.current
    if (ctx.state === 'suspended') await ctx.resume()
    if (!sourceRef.current) {
      sourceRef.current = ctx.createMediaElementSource(audioRef.current)
      analyserRef.current = ctx.createAnalyser()
      analyserRef.current.fftSize = 512
      sourceRef.current.connect(analyserRef.current)
      analyserRef.current.connect(ctx.destination)
    }
  }

  function tick(now: number) {
    if (!analyserRef.current) return
    const TICK_MS = 100 // 意図的に粗くしてコマ落ち感を演出
    if (now - lastTickRef.current >= TICK_MS) {
      const data = new Uint8Array(analyserRef.current.frequencyBinCount)
      analyserRef.current.getByteFrequencyData(data)
      let sum = 0
      for (let i = 0; i < data.length; i++) sum += data[i]
      const avg = sum / data.length
      setMouthOpen(avg > thresholdRef.current)
      lastTickRef.current = now
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  useEffect(() => {
    if (!playing) {
      stopTick()
      audioRef.current?.pause()
      return
    }
    if (!audioUrl) return
    let cancelled = false
    ;(async () => {
      await ensureGraph()
      if (cancelled || !audioRef.current) return
      audioRef.current.currentTime = 0
      try {
        await audioRef.current.play()
        lastTickRef.current = performance.now()
        rafRef.current = requestAnimationFrame(tick)
      } catch (e) {
        console.warn('[anime-app] play blocked', e)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, audioUrl])

  useEffect(() => {
    return () => {
      stopTick()
      audioRef.current?.pause()
    }
  }, [])

  function handleEnded() {
    stopTick()
    onEnded?.()
  }

  const img = displayImage()

  return (
    <div
      className={
        className ??
        'flex items-center justify-center bg-background rounded-md border border-border aspect-square overflow-hidden relative'
      }
    >
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={img} src={img} alt={character?.name ?? ''} className="w-full h-full object-contain" />
      ) : (
        <div className="text-center text-muted-foreground p-4">
          <Users size={32} className="mx-auto mb-2" />
          <p className="text-xs">画像を登録してください</p>
        </div>
      )}
      <audio ref={audioRef} src={audioUrl ?? undefined} onEnded={handleEnded} preload="auto" />
    </div>
  )
}
