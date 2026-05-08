'use client'

import { useEffect, useRef, useState } from 'react'
import { Users } from 'lucide-react'
import type {
  CameraMotion,
  Character,
  CharacterExpression,
  CharacterMotion,
  Layer,
  ScreenEffect,
  TelopStyle,
} from '@/types/db'
import { DEFAULT_TELOP_STYLE } from '@/types/db'
import { toBandStyle, toTextStyle } from '@/components/telop-settings-dialog'
import { EffectOverlay } from '@/components/effect-overlay'

const CAMERA_CLASS: Record<Exclude<CameraMotion, 'none'>, string> = {
  zoom_in_slow: 'camera-zoom-in',
  zoom_out_slow: 'camera-zoom-out',
  pan_right: 'camera-pan-right',
  pan_left: 'camera-pan-left',
  shake_subtle: 'camera-shake-subtle',
  shake_heavy: 'camera-shake-heavy',
}

export const CAMERA_LABEL: Record<CameraMotion, string> = {
  none: 'カメラ固定',
  zoom_in_slow: 'ゆっくりズームイン',
  zoom_out_slow: 'ゆっくりズームアウト',
  pan_right: '右へパン',
  pan_left: '左へパン',
  shake_subtle: '微振動(緊張)',
  shake_heavy: '強振動(衝撃)',
}

// motion キー名と対応する CSS クラス。none は未指定時のため割り当てなし。
export const MOTION_CLASS: Record<Exclude<CharacterMotion, 'none'>, string> = {
  shake: 'motion-shake',
  jump: 'motion-jump',
  pop_in: 'motion-pop-in',
  slide_in_left: 'motion-slide-in-left',
  slide_in_right: 'motion-slide-in-right',
  fade_in: 'motion-fade-in',
  zoom_in: 'motion-zoom-in',
}

export const MOTION_LABEL: Record<CharacterMotion, string> = {
  none: '動きなし',
  shake: '震える',
  jump: 'ジャンプ',
  pop_in: 'ポップイン',
  slide_in_left: '左からスライド',
  slide_in_right: '右からスライド',
  fade_in: 'フェードイン',
  zoom_in: '拡大して登場',
}

// 発話しない共演キャラ(静止画で並べる)
export interface StageExtraCharacter {
  character: Character
  expressions: CharacterExpression[]
  x: number
  scale: number
  idleExpressionId: string | null
  flipped?: boolean
}

interface LipSyncStageProps {
  character: Character | null
  expressions: CharacterExpression[] // このキャラに紐づく表情のみ
  audioUrl?: string | null
  overrideExpressionId?: string | null
  threshold?: number
  playing: boolean
  caption?: string | null
  telopStyle?: TelopStyle | null
  // 背景レイヤー(order_index 昇順、可視のみ)。キャラ画像の後ろに重ねる。
  backgroundLayers?: Layer[]
  // 立ち位置 (0..1, 0.5=中央) と縦方向スケール (1.0=ステージ高さいっぱい)
  characterX?: number
  characterScale?: number
  // 左右反転(斜め前向きの立ち絵を逆向きにする)
  characterFlipped?: boolean
  // 発話者以外の共演キャラ。 background と main character の間に描画する。
  extraCharacters?: StageExtraCharacter[]
  // 音声なしのナレーションで使う表示時間 ms。audioUrl が null かつ playing の間に、
  // この時間が経過したら onEnded を呼ぶ。
  silentDurationMs?: number
  // 再生速度(1=等倍)。音声と無音タイマーの両方に反映。
  playbackRate?: number
  // 音声音量 0..1 (既定 1.0)
  audioVolume?: number
  // セリフ冒頭で発火するキャラのアクション(セリフごとに変わる前提なので playing の立ち上がりで再生)
  motion?: CharacterMotion | null
  // 画面エフェクト(playing 中ループ表示)
  effect?: ScreenEffect | null
  // シーン全体のカメラワーク(背景+キャラ全部にかかる)
  cameraMotion?: CameraMotion | null
  onEnded?: () => void
  className?: string
}

function pickIdleImage(extra: StageExtraCharacter): string | null {
  if (extra.idleExpressionId) {
    const found = extra.expressions.find((e) => e.id === extra.idleExpressionId)
    if (found) return found.image_url
  }
  const mc = extra.expressions.find((e) => e.kind === 'mouth_closed')
  if (mc) return mc.image_url
  return extra.character.image_url
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
  caption,
  telopStyle,
  backgroundLayers,
  characterX,
  characterScale,
  characterFlipped,
  extraCharacters,
  silentDurationMs,
  playbackRate,
  audioVolume,
  motion,
  effect,
  cameraMotion,
  onEnded,
  className,
}: LipSyncStageProps) {
  const cameraClass =
    cameraMotion && cameraMotion !== 'none' ? CAMERA_CLASS[cameraMotion] : ''
  const rate = typeof playbackRate === 'number' && playbackRate > 0 ? playbackRate : 1
  const vol = typeof audioVolume === 'number' ? Math.max(0, Math.min(1, audioVolume)) : 1
  const effectiveStyle = telopStyle ?? DEFAULT_TELOP_STYLE
  const cx = typeof characterX === 'number' ? characterX : 0.5
  const cs = typeof characterScale === 'number' ? characterScale : 1.0
  const flipSx = characterFlipped ? -1 : 1

  // motion アニメーションを再生のたびに再発火させるためのカウンター。
  // playing が false→true になった時点 / motion が変わった時点でインクリメントする。
  const [motionKey, setMotionKey] = useState(0)
  const prevPlayingRef = useRef(false)
  useEffect(() => {
    if (playing && !prevPlayingRef.current) {
      setMotionKey((k) => k + 1)
    }
    prevPlayingRef.current = playing
  }, [playing, motion])
  const motionClass =
    motion && motion !== 'none' && playing ? MOTION_CLASS[motion] : ''

  // typewriter の段階表示用(intro=typewriter 以外のときは常に全文)
  const [revealedText, setRevealedText] = useState<string>(caption ?? '')
  useEffect(() => {
    if (!caption || !playing) {
      setRevealedText(caption ?? '')
      return
    }
    if (effectiveStyle.intro !== 'typewriter') {
      setRevealedText(caption)
      return
    }
    const cps = effectiveStyle.typewriter_cps > 0 ? effectiveStyle.typewriter_cps : 30
    const start = performance.now()
    let raf = 0
    let cancelled = false
    const tick = (now: number) => {
      if (cancelled) return
      const chars = Math.min(caption.length, Math.floor(((now - start) / 1000) * cps))
      setRevealedText(caption.slice(0, chars))
      if (chars < caption.length) {
        raf = requestAnimationFrame(tick)
      }
    }
    setRevealedText('')
    raf = requestAnimationFrame(tick)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [caption, playing, effectiveStyle.intro, effectiveStyle.typewriter_cps])

  const introClass =
    effectiveStyle.intro === 'pop'
      ? 'telop-intro-pop'
      : effectiveStyle.intro === 'fade'
        ? 'telop-intro-fade'
        : ''
  const shakeClass =
    effectiveStyle.shake === 'subtle'
      ? 'telop-shake-subtle'
      : effectiveStyle.shake === 'heavy'
        ? 'telop-shake-heavy'
        : ''
  const [mouthOpen, setMouthOpen] = useState(false)
  const [blinking, setBlinking] = useState(false)

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
  const blinkExpr = expressions.find((e) => e.kind === 'blink') ?? null
  const override = overrideExpressionId
    ? expressions.find((e) => e.id === overrideExpressionId) ?? null
    : null

  function displayImage(): string | null {
    if (!character) return null
    // 瞬きは最優先(口形/表情を瞬時に上書きする瞬間切替)
    if (blinking && blinkExpr) return blinkExpr.image_url
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
    if (!audioUrl) {
      // ナレーション(無音): 指定時間だけ待って onEnded。再生速度で短縮/延長。
      const ms = (typeof silentDurationMs === 'number' ? silentDurationMs : 3000) / rate
      const timer = window.setTimeout(() => onEnded?.(), ms)
      return () => window.clearTimeout(timer)
    }
    let cancelled = false
    ;(async () => {
      await ensureGraph()
      if (cancelled || !audioRef.current) return
      audioRef.current.currentTime = 0
      audioRef.current.playbackRate = rate
      audioRef.current.volume = vol
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
  }, [playing, audioUrl, silentDurationMs, rate, vol])

  useEffect(() => {
    return () => {
      stopTick()
      audioRef.current?.pause()
    }
  }, [])

  // 瞬き: 3〜5秒ごとに 120ms だけ blink 画像を出す。
  // blink 画像が登録されていないキャラではなにもしない。
  useEffect(() => {
    if (!blinkExpr) return
    let cancelled = false
    let timer: number | null = null

    const blinkOnce = () => {
      if (cancelled) return
      setBlinking(true)
      timer = window.setTimeout(() => {
        if (cancelled) return
        setBlinking(false)
        scheduleNext()
      }, 80) // コマ切替風の短さ(ヌルヌルさせない)
    }

    const scheduleNext = () => {
      if (cancelled) return
      const delay = 3000 + Math.random() * 2000
      timer = window.setTimeout(blinkOnce, delay)
    }

    scheduleNext()

    return () => {
      cancelled = true
      if (timer !== null) window.clearTimeout(timer)
      setBlinking(false)
    }
  }, [blinkExpr])

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
      {/* カメラワーク用ラッパー: 背景・共演者・発話キャラ・エフェクトをまとめて動かす。
          cameraMotion を変えると key が変わって CSS アニメが頭から再生される。 */}
      <div
        key={`cam-${cameraMotion ?? 'none'}`}
        className={`absolute inset-0 ${cameraClass}`}
      >
      {backgroundLayers?.map((layer) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={layer.id}
          src={layer.image_url}
          alt=""
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          style={{ opacity: layer.opacity }}
        />
      ))}
      {/* 共演キャラ(静止画)は背景の上・発話者の下に描画する */}
      {extraCharacters?.map((extra) => {
        const url = pickIdleImage(extra)
        if (!url) return null
        const exFlip = extra.flipped ? -1 : 1
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={extra.character.id}
            src={url}
            alt={extra.character.name}
            className="absolute"
            style={{
              bottom: 0,
              left: `${extra.x * 100}%`,
              height: `${extra.scale * 100}%`,
              width: 'auto',
              maxWidth: 'none',
              transform: `translateX(-50%) scaleX(${exFlip})`,
              objectFit: 'contain',
            }}
          />
        )
      })}
      {img ? (
        // 3層: 外= 絶対配置と中央寄せ / 中= motion アニメーション / 内= 画像 + 左右反転
        <div
          className="absolute pointer-events-none"
          style={{
            bottom: 0,
            left: `${cx * 100}%`,
            height: `${cs * 100}%`,
            transform: 'translateX(-50%)',
          }}
        >
          <div
            key={`motion-${motionKey}`}
            className={`h-full ${motionClass}`}
            style={{ transformOrigin: 'bottom center' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img}
              alt={character?.name ?? ''}
              className="h-full w-auto"
              style={{
                maxWidth: 'none',
                transform: `scaleX(${flipSx})`,
                objectFit: 'contain',
              }}
            />
          </div>
        </div>
      ) : character ? (
        // キャラは指定されているが画像未登録
        <div className="relative text-center text-muted-foreground p-4">
          <Users size={32} className="mx-auto mb-2" />
          <p className="text-xs">画像を登録してください</p>
        </div>
      ) : null /* ナレーション: 主役枠は空 */}
      {playing && <EffectOverlay effect={effect ?? null} />}
      </div>{/* /camera wrapper */}
      {caption && playing && (
        <div
          className="absolute inset-x-2 pointer-events-none"
          style={{
            top: effectiveStyle.position === 'top' ? 8 : undefined,
            bottom: effectiveStyle.position === 'bottom' ? 8 : undefined,
            ...(effectiveStyle.position === 'center'
              ? { top: '50%', transform: 'translateY(-50%)' }
              : {}),
          }}
        >
          <div className="mx-auto max-w-[95%] text-center">
            <span
              key={caption /* 新しいセリフに入れ替わったら intro アニメを再実行させる */}
              className={`inline-block ${introClass}`.trim()}
              style={toBandStyle(effectiveStyle)}
            >
              <span className={shakeClass || undefined}>
                <span style={{ ...toTextStyle(effectiveStyle), whiteSpace: 'pre-wrap' }}>
                  {revealedText}
                </span>
              </span>
            </span>
          </div>
        </div>
      )}
      <audio ref={audioRef} src={audioUrl ?? undefined} onEnded={handleEnded} preload="auto" />
    </div>
  )
}
