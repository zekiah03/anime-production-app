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
  BgmTrack,
  CameraMotion,
  Character,
  CharacterExpression,
  CharacterMotion,
  IllustrationWithLayers,
  Layer,
  SceneCastMember,
  SceneColorFilter,
  SceneWithDialogues,
  ScreenEffect,
  SoundEffect,
  TelopShake,
  TelopStyle,
} from '@/types/db'
import { COLOR_FILTER_CSS } from '@/types/db'
import { DEFAULT_TELOP_STYLE, TELOP_FONT_FAMILY } from '@/types/db'
import { hexToRgba } from '@/components/telop-settings-dialog'

const LIPSYNC_THRESHOLD = 40
const TICK_MS = 100

type Aspect = '9:16' | '16:9' | '1:1'
type Quality = '720p' | '1080p'
type Format = 'webm' | 'mp4'
type Status = 'idle' | 'preparing' | 'recording' | 'converting' | 'complete' | 'error'

function resolutionFor(aspect: Aspect, quality: Quality): { width: number; height: number } {
  const unit = quality === '1080p' ? 1080 : 720
  if (aspect === '9:16')
    return { width: unit === 1080 ? 1080 : 720, height: unit === 1080 ? 1920 : 1280 }
  if (aspect === '16:9')
    return { width: unit === 1080 ? 1920 : 1280, height: unit === 1080 ? 1080 : 720 }
  return { width: unit, height: unit }
}

function easePop(t: number): number {
  if (t <= 0) return 0.3
  if (t >= 1) return 1
  if (t < 0.6) {
    const u = t / 0.6
    return 0.3 + (1.1 - 0.3) * (1 - (1 - u) * (1 - u))
  }
  const u = (t - 0.6) / 0.4
  return 1.1 - 0.1 * u
}

// シーン全体に適用するカメラの transform。CSS の camera-* と数値的に揃える。
function applyCamera(
  ctx: CanvasRenderingContext2D,
  cameraMotion: CameraMotion | null | undefined,
  sceneElapsedMs: number,
  WIDTH: number,
  HEIGHT: number,
) {
  if (!cameraMotion || cameraMotion === 'none') return
  const SCENE_DUR = 8000 // 8s でフル進行(以降はそのままキープ)
  switch (cameraMotion) {
    case 'zoom_in_slow': {
      const t = Math.min(sceneElapsedMs / SCENE_DUR, 1)
      const scale = 1.0 + 0.15 * t
      ctx.translate(WIDTH / 2, HEIGHT / 2)
      ctx.scale(scale, scale)
      ctx.translate(-WIDTH / 2, -HEIGHT / 2)
      return
    }
    case 'zoom_out_slow': {
      const t = Math.min(sceneElapsedMs / SCENE_DUR, 1)
      const scale = 1.15 - 0.15 * t
      ctx.translate(WIDTH / 2, HEIGHT / 2)
      ctx.scale(scale, scale)
      ctx.translate(-WIDTH / 2, -HEIGHT / 2)
      return
    }
    case 'pan_right': {
      const t = Math.min(sceneElapsedMs / SCENE_DUR, 1)
      const dx = (-0.03 + 0.06 * t) * WIDTH
      ctx.translate(WIDTH / 2 + dx, HEIGHT / 2)
      ctx.scale(1.08, 1.08)
      ctx.translate(-WIDTH / 2, -HEIGHT / 2)
      return
    }
    case 'pan_left': {
      const t = Math.min(sceneElapsedMs / SCENE_DUR, 1)
      const dx = (0.03 - 0.06 * t) * WIDTH
      ctx.translate(WIDTH / 2 + dx, HEIGHT / 2)
      ctx.scale(1.08, 1.08)
      ctx.translate(-WIDTH / 2, -HEIGHT / 2)
      return
    }
    case 'shake_subtle': {
      const t = sceneElapsedMs / 400
      const dx = Math.sin(t * Math.PI * 4) * 1.5
      const dy = Math.cos(t * Math.PI * 5) * 1.0
      ctx.translate(dx, dy)
      return
    }
    case 'shake_heavy': {
      const t = sceneElapsedMs / 300
      const dx = Math.sin(t * Math.PI * 6) * 5
      const dy = Math.cos(t * Math.PI * 7) * 4
      ctx.translate(dx, dy)
      return
    }
  }
}

function computeShake(kind: TelopShake, elapsedMs: number): { x: number; y: number } {
  if (kind === 'none') return { x: 0, y: 0 }
  const amplitude = kind === 'heavy' ? 3 : 1
  const t = elapsedMs / 40
  return { x: Math.sin(t * 2.3) * amplitude, y: Math.cos(t * 3.1) * amplitude }
}

interface MotionFrame {
  dx: number
  dy: number
  scale: number
  alpha: number
}

const IDENTITY_MOTION: MotionFrame = { dx: 0, dy: 0, scale: 1, alpha: 1 }

// CSS の motion-* と数値的に合わせたフレーム計算。終了後は IDENTITY を返す。
function computeMotion(
  motion: CharacterMotion | null | undefined,
  elapsedMs: number,
): MotionFrame {
  if (!motion || motion === 'none') return IDENTITY_MOTION
  switch (motion) {
    case 'shake': {
      const dur = 600
      if (elapsedMs >= dur) return IDENTITY_MOTION
      const t = elapsedMs / dur
      const amp = 6 * (1 - t)
      return { dx: Math.sin(elapsedMs / 30) * amp, dy: 0, scale: 1, alpha: 1 }
    }
    case 'jump': {
      const dur = 450
      if (elapsedMs >= dur) return IDENTITY_MOTION
      const t = elapsedMs / dur
      const dy = -32 * (4 * t * (1 - t))
      return { dx: 0, dy, scale: 1, alpha: 1 }
    }
    case 'pop_in': {
      const dur = 300
      if (elapsedMs >= dur) return IDENTITY_MOTION
      const t = elapsedMs / dur
      if (t < 0.6) {
        const u = t / 0.6
        return { dx: 0, dy: 0, scale: 1.12 * u, alpha: u }
      }
      const u = (t - 0.6) / 0.4
      return { dx: 0, dy: 0, scale: 1.12 - 0.12 * u, alpha: 1 }
    }
    case 'slide_in_left': {
      const dur = 350
      if (elapsedMs >= dur) return IDENTITY_MOTION
      const t = elapsedMs / dur
      const ease = 1 - Math.pow(1 - t, 3)
      return { dx: -220 * (1 - ease), dy: 0, scale: 1, alpha: ease }
    }
    case 'slide_in_right': {
      const dur = 350
      if (elapsedMs >= dur) return IDENTITY_MOTION
      const t = elapsedMs / dur
      const ease = 1 - Math.pow(1 - t, 3)
      return { dx: 220 * (1 - ease), dy: 0, scale: 1, alpha: ease }
    }
    case 'fade_in': {
      const dur = 400
      if (elapsedMs >= dur) return IDENTITY_MOTION
      return { dx: 0, dy: 0, scale: 1, alpha: elapsedMs / dur }
    }
    case 'zoom_in': {
      const dur = 300
      if (elapsedMs >= dur) return IDENTITY_MOTION
      const t = elapsedMs / dur
      return { dx: 0, dy: 0, scale: 0.5 + 0.5 * t, alpha: t }
    }
  }
  return IDENTITY_MOTION
}

// 画面エフェクトをキャンバスに描画。WIDTH/HEIGHT 基準で座標を計算する。
function drawEffect(
  ctx: CanvasRenderingContext2D,
  effect: ScreenEffect | null | undefined,
  elapsedMs: number,
  WIDTH: number,
  HEIGHT: number,
) {
  if (!effect || effect === 'none') return
  const t = elapsedMs / 1000 // seconds

  function emoji(text: string, x: number, y: number, sizePx: number, alpha: number) {
    if (alpha <= 0) return
    const prev = ctx.globalAlpha
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha))
    ctx.font = `${sizePx}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, x, y)
    ctx.globalAlpha = prev
  }

  switch (effect) {
    case 'anger': {
      // 0.5s ループのジョルト(揺れ拡大)。位置は右上。
      const cycle = (elapsedMs % 500) / 500
      const scale = 1 + 0.1 * Math.sin(cycle * Math.PI * 2)
      const jitter = 4 * Math.sin(cycle * Math.PI * 6)
      emoji('💢', WIDTH * 0.78 + jitter, HEIGHT * 0.18, WIDTH * 0.13 * scale, 1)
      return
    }
    case 'sweat': {
      // 1.6s ループで上から落ちる
      const cycle = (elapsedMs % 1600) / 1600
      const y = HEIGHT * 0.12 + (HEIGHT * 0.6) * cycle
      const a = cycle < 0.2 ? cycle * 5 : cycle > 0.8 ? (1 - cycle) * 5 : 1
      emoji('💦', WIDTH * 0.28, y, WIDTH * 0.11, a)
      return
    }
    case 'sparkle': {
      // 5箇所が時差で twinkle
      const points: Array<[number, number, number]> = [
        [0.18, 0.15, 0.0],
        [0.78, 0.2, 0.3],
        [0.1, 0.4, 0.6],
        [0.86, 0.5, 0.15],
        [0.24, 0.65, 0.45],
      ]
      for (const [px, py, delay] of points) {
        const cycle = ((t + delay) % 1.1) / 1.1
        const a = 0.4 + 0.6 * Math.abs(Math.sin(cycle * Math.PI))
        const scale = 0.6 + 0.6 * Math.abs(Math.sin(cycle * Math.PI))
        emoji('✨', WIDTH * px, HEIGHT * py, WIDTH * 0.08 * scale, a)
      }
      return
    }
    case 'heart': {
      // 1.6s ループで上に浮き上がる(3 つを時差発生)
      const points: Array<[number, number, number]> = [
        [0.32, 0.78, 0.0],
        [0.66, 0.7, 0.4],
        [0.5, 0.84, 0.8],
      ]
      for (const [px, py, delay] of points) {
        const cycle = ((t + delay) % 1.6) / 1.6
        const dy = -HEIGHT * 0.6 * cycle
        const scale = 0.6 + 0.6 * cycle
        const a = cycle < 0.2 ? cycle * 5 : cycle > 0.8 ? (1 - cycle) * 5 : 1
        emoji('❤️', WIDTH * px, HEIGHT * py + dy, WIDTH * 0.1 * scale, a)
      }
      return
    }
    case 'shock': {
      const cycle = (elapsedMs % 500) / 500
      const scale = 1 + 0.15 * Math.sin(cycle * Math.PI * 2)
      const jitter = 6 * Math.sin(cycle * Math.PI * 6)
      emoji('⚡', WIDTH * 0.78 + jitter, HEIGHT * 0.2, WIDTH * 0.16 * scale, 1)
      return
    }
    case 'question': {
      // 1.4s で pulse
      const cycle = (elapsedMs % 1400) / 1400
      let a = 0
      let scale = 1
      if (cycle < 0.2) {
        a = cycle * 5
        scale = 0.4 + (1.2 - 0.4) * (cycle / 0.2)
      } else if (cycle < 0.6) {
        a = 1
        scale = 1.2 - 0.2 * ((cycle - 0.2) / 0.4)
      } else {
        a = 1 - (cycle - 0.6) / 0.4
        scale = 1 - 0.05 * ((cycle - 0.6) / 0.4)
      }
      const prev = ctx.fillStyle
      ctx.fillStyle = '#fbbf24'
      emoji('❓', WIDTH * 0.74, HEIGHT * 0.14, WIDTH * 0.13 * scale, a)
      ctx.fillStyle = prev as string
      return
    }
    case 'shock_lines': {
      // 中心から放射する黒い線。0.9s で広がりながらフェードアウトをループ。
      const cycle = (elapsedMs % 900) / 900
      const scale = 0.3 + 1.1 * cycle
      const alpha = cycle < 0.2 ? cycle * 5 : 1 - (cycle - 0.2) / 0.8
      if (alpha <= 0) return
      const prev = ctx.globalAlpha
      ctx.globalAlpha = alpha * 0.85
      const cx = WIDTH / 2
      const cy = HEIGHT / 2
      const rOuter = Math.hypot(WIDTH, HEIGHT) * 0.6 * scale
      const rInner = rOuter * 0.18
      const lines = 60
      ctx.fillStyle = '#000000'
      for (let i = 0; i < lines; i++) {
        const ang = (i / lines) * Math.PI * 2
        const w = 0.04 // ~2.3deg
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(ang) * rInner, cy + Math.sin(ang) * rInner)
        ctx.lineTo(cx + Math.cos(ang + w) * rOuter, cy + Math.sin(ang + w) * rOuter)
        ctx.lineTo(cx + Math.cos(ang + w * 2) * rInner, cy + Math.sin(ang + w * 2) * rInner)
        ctx.closePath()
        ctx.fill()
      }
      ctx.globalAlpha = prev
      return
    }
    case 'speed_lines': {
      // 横方向の白い縞模様(0.6s でフェード in/out をループ)。両端のみ表示。
      const cycle = (elapsedMs % 600) / 600
      let a = 0
      if (cycle < 0.15) a = cycle / 0.15
      else if (cycle > 0.85) a = (1 - cycle) / 0.15
      else a = 1
      a *= 0.85
      if (a <= 0) return
      const prev = ctx.globalAlpha
      ctx.globalAlpha = a
      ctx.fillStyle = '#ffffff'
      const lineSpacing = 18
      const lineWidth = 2
      const sideZone = WIDTH * 0.25
      for (let y = 0; y < HEIGHT; y += lineSpacing) {
        ctx.fillRect(0, y, sideZone, lineWidth)
        ctx.fillRect(WIDTH - sideZone, y, sideZone, lineWidth)
      }
      ctx.globalAlpha = prev
      return
    }
  }
}

// 1シーン分の解決済み情報
interface SceneSegment {
  scene: SceneWithDialogues
  backgroundLayers: Layer[]
  bgmTrack: BgmTrack | null
  bgmVolume: number
  dialogues: ResolvedDialogue[]
  // このシーン固有の scene_cast(発話者を除いて描画する)
  cast: SceneCastMember[]
}

interface ExportExtra {
  character: Character
  x: number
  scale: number
  imageUrl: string
  flipped: boolean
}

interface ResolvedDialogue {
  text: string
  character: Character | null
  audio: AudioFile | null
  mouthOpen: CharacterExpression | null
  mouthClosed: CharacterExpression | null
  blink: CharacterExpression | null
  override: CharacterExpression | null
  se: SoundEffect | null
  seVolume: number
  characterX: number
  characterScale: number
  characterFlipped: boolean
  extras: ExportExtra[]
  silentDurationMs: number
  pauseAfterMs: number
  telopStyleForThis: TelopStyle
  motion: CharacterMotion | null
  effect: ScreenEffect | null
}

export function VideoExportDialog({
  videoName,
  defaultAspect,
  scenes,
  characters,
  audioFiles,
  expressions,
  bgmTracks,
  sounds,
  illustrations,
  sceneCast,
  telopStyle,
  open,
  onClose,
}: {
  videoName: string
  defaultAspect?: Aspect
  scenes: SceneWithDialogues[]
  characters: Character[]
  audioFiles: AudioFile[]
  expressions: CharacterExpression[]
  bgmTracks: BgmTrack[]
  sounds: SoundEffect[]
  illustrations: IllustrationWithLayers[]
  sceneCast: SceneCastMember[]
  telopStyle?: TelopStyle | null
  open: boolean
  onClose: () => void
}) {
  const effectiveStyle: TelopStyle = telopStyle ?? DEFAULT_TELOP_STYLE

  function pickIdleUrl(member: SceneCastMember): string | null {
    const charExprs = expressions.filter((e) => e.character_id === member.character_id)
    if (member.idle_expression_id) {
      const found = charExprs.find((e) => e.id === member.idle_expression_id)
      if (found) return found.image_url
    }
    const mc = charExprs.find((e) => e.kind === 'mouth_closed')
    if (mc) return mc.image_url
    const c = characters.find((ch) => ch.id === member.character_id)
    return c?.image_url ?? null
  }

  function backgroundForScene(s: SceneWithDialogues): Layer[] {
    if (!s.background_illustration_id) return []
    const illust = illustrations.find((i) => i.id === s.background_illustration_id)
    if (!illust) return []
    return [...illust.layers]
      .filter((l) => l.visible)
      .sort((a, b) => a.order_index - b.order_index)
  }

  const [status, setStatus] = useState<Status>('idle')
  const [progressTotal, setProgressTotal] = useState(0)
  const [progressIndex, setProgressIndex] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [format, setFormat] = useState<Format>('mp4')
  const [aspect, setAspect] = useState<Aspect>(defaultAspect ?? '9:16')
  const [quality, setQuality] = useState<Quality>('720p')
  const [convertProgress, setConvertProgress] = useState(0)
  const [ffmpegLoadMsg, setFfmpegLoadMsg] = useState<string | null>(null)
  const [currentSceneLabel, setCurrentSceneLabel] = useState('')

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const cancelledRef = useRef(false)

  const { width: WIDTH, height: HEIGHT } = resolutionFor(aspect, quality)

  // セグメント(シーンごとの前解決)を組み立てる
  const segments: SceneSegment[] = scenes
    .sort((a, b) => a.order_index - b.order_index)
    .map((scene) => {
      const bgmTrack = scene.bgm_track_id
        ? bgmTracks.find((t) => t.id === scene.bgm_track_id) ?? null
        : null
      const bgmVolume = typeof scene.bgm_volume === 'number' ? scene.bgm_volume : 0.25
      const sceneCastMembers = sceneCast.filter((c) => c.scene_id === scene.id)

      const dialogues: ResolvedDialogue[] = scene.dialogues
        .map((sd) => {
          const d = sd.dialogue
          if (!d) return null
          const character = characters.find((c) => c.id === d.character_id) ?? null
          const audio = audioFiles.find((a) => a.id === d.audio_id) ?? null
          const isNormal = character && audio
          const isNarration = !character && d.text.trim().length > 0
          if (!isNormal && !isNarration) return null
          const charExpressions = character
            ? expressions.filter((x) => x.character_id === character.id)
            : []
          const se = sd.se_id ? sounds.find((s) => s.id === sd.se_id) ?? null : null
          const seVolume = typeof sd.se_volume === 'number' ? sd.se_volume : 1
          const speakerCast = sceneCastMembers.find((m) => m.character_id === d.character_id)
          const characterX =
            speakerCast?.x ??
            (typeof sd.character_x === 'number' ? sd.character_x : 0.5)
          const characterScale =
            speakerCast?.scale ??
            (typeof sd.character_scale === 'number' ? sd.character_scale : 1.0)
          const characterFlipped =
            typeof speakerCast?.flipped === 'boolean'
              ? !!speakerCast.flipped
              : !!sd.character_flipped
          const extras: ExportExtra[] = sceneCastMembers
            .filter((m) => m.character_id !== d.character_id)
            .map((m) => {
              const c = characters.find((ch) => ch.id === m.character_id)
              const url = pickIdleUrl(m)
              if (!c || !url) return null
              return {
                character: c,
                x: m.x,
                scale: m.scale,
                imageUrl: url,
                flipped: !!m.flipped,
              }
            })
            .filter((x): x is ExportExtra => x !== null)
          const silentDurationMs =
            typeof d.duration_ms === 'number' && d.duration_ms > 0 ? d.duration_ms : 3000
          const pauseAfterMs =
            typeof sd.pause_after_ms === 'number' && sd.pause_after_ms > 0
              ? sd.pause_after_ms
              : 0
          const telopStyleForThis: TelopStyle = {
            ...effectiveStyle,
            intro: sd.telop_intro ?? effectiveStyle.intro,
            shake: sd.telop_shake ?? effectiveStyle.shake,
          }
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
            se,
            seVolume,
            characterX,
            characterScale,
            characterFlipped,
            extras,
            silentDurationMs,
            pauseAfterMs,
            telopStyleForThis,
            motion: sd.motion ?? null,
            effect: sd.effect ?? null,
          } as ResolvedDialogue
        })
        .filter((x): x is ResolvedDialogue => x !== null)

      return {
        scene,
        backgroundLayers: backgroundForScene(scene),
        bgmTrack,
        bgmVolume,
        dialogues,
        cast: sceneCastMembers,
      }
    })

  const validSegments = segments.filter((s) => s.dialogues.length > 0)
  const totalDialogues = validSegments.reduce((sum, s) => sum + s.dialogues.length, 0)

  useEffect(() => {
    if (!open) {
      setStatus('idle')
      setProgressTotal(0)
      setProgressIndex(0)
      setConvertProgress(0)
      setFfmpegLoadMsg(null)
      setErrorMessage(null)
      setCurrentSceneLabel('')
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      cancelledRef.current = false
    }
  }, [open])

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
    backgroundLayers: Layer[],
    cache: Map<string, HTMLImageElement>,
    mouthOpen: boolean,
    blinking: boolean,
    elapsedMs: number,
    cameraMotion: CameraMotion | null,
    sceneElapsedMs: number,
    titleCardText: string | null,
    colorFilter: SceneColorFilter | null,
  ) {
    ctx.fillStyle = '#111111'
    ctx.fillRect(0, 0, WIDTH, HEIGHT)

    // ここから先はカメラの transform + 色調フィルター配下(背景〜エフェクト)。
    // テロップは外に置くので filter / transform からは外れる。
    ctx.save()
    if (colorFilter && colorFilter !== 'none') {
      ctx.filter = COLOR_FILTER_CSS[colorFilter]
    }
    applyCamera(ctx, cameraMotion, sceneElapsedMs, WIDTH, HEIGHT)

    // 背景
    for (const layer of backgroundLayers) {
      const bg = cache.get(layer.image_url)
      if (!bg) continue
      const prevAlpha = ctx.globalAlpha
      ctx.globalAlpha = layer.opacity
      const scale = Math.max(WIDTH / bg.width, HEIGHT / bg.height)
      const w = bg.width * scale
      const h = bg.height * scale
      const x = (WIDTH - w) / 2
      const y = (HEIGHT - h) / 2
      ctx.drawImage(bg, x, y, w, h)
      ctx.globalAlpha = prevAlpha
    }

    // 共演キャラ
    for (const extra of current.extras) {
      const extraImg = cache.get(extra.imageUrl)
      if (!extraImg) continue
      const fit = Math.min(WIDTH / extraImg.width, HEIGHT / extraImg.height)
      const baseW = extraImg.width * fit
      const baseH = extraImg.height * fit
      const w = baseW * extra.scale
      const h = baseH * extra.scale
      const cx = WIDTH * extra.x
      const x = cx - w / 2
      const y = HEIGHT - h
      if (extra.flipped) {
        ctx.save()
        ctx.translate(cx, 0)
        ctx.scale(-1, 1)
        ctx.drawImage(extraImg, -w / 2, y, w, h)
        ctx.restore()
      } else {
        ctx.drawImage(extraImg, x, y, w, h)
      }
    }

    // 発話キャラ
    let imgUrl: string | null = null
    if (current.character) {
      if (blinking && current.blink) imgUrl = current.blink.image_url
      else if (current.override) imgUrl = current.override.image_url
      else if (current.mouthOpen && current.mouthClosed)
        imgUrl = (mouthOpen ? current.mouthOpen : current.mouthClosed).image_url
      else if (current.character.image_url) imgUrl = current.character.image_url
    }
    if (imgUrl) {
      const img = cache.get(imgUrl)
      if (img) {
        const fitScale = Math.min(WIDTH / img.width, HEIGHT / img.height)
        const baseW = img.width * fitScale
        const baseH = img.height * fitScale
        const userScale = current.characterScale
        // motion: dx/dy 移動 + scale 倍率 + alpha 不透明度。基準は身長(baseH)に対する割合。
        const m = computeMotion(current.motion, elapsedMs)
        const w = baseW * userScale * m.scale
        const h = baseH * userScale * m.scale
        const cx = WIDTH * current.characterX + m.dx
        const x = cx - w / 2
        // motion の dy は身長基準の割合で扱うと崩れにくい(身長 = baseH * userScale ≒ HEIGHT)
        const y = HEIGHT - h + m.dy
        const prevAlpha = ctx.globalAlpha
        ctx.globalAlpha = prevAlpha * m.alpha
        if (current.characterFlipped) {
          ctx.save()
          ctx.translate(cx, 0)
          ctx.scale(-1, 1)
          ctx.drawImage(img, -w / 2, y, w, h)
          ctx.restore()
        } else {
          ctx.drawImage(img, x, y, w, h)
        }
        ctx.globalAlpha = prevAlpha
      }
    }

    // 画面エフェクト(キャラの上、テロップの下)
    drawEffect(ctx, current.effect, elapsedMs, WIDTH, HEIGHT)

    // カメラ transform を解除(テロップは固定で出したい)
    ctx.restore()

    // テロップ
    if (current.text) {
      const style = current.telopStyleForThis ?? effectiveStyle
      const visibleText =
        style.intro === 'typewriter'
          ? current.text.slice(
              0,
              Math.floor(
                (elapsedMs / 1000) * (style.typewriter_cps > 0 ? style.typewriter_cps : 30),
              ),
            )
          : current.text
      if (visibleText) {
        const fadeAlpha = style.intro === 'fade' ? Math.min(1, elapsedMs / 240) : 1
        const popScale = style.intro === 'pop' ? easePop(elapsedMs / 280) : 1
        const shake = computeShake(style.shake, elapsedMs)

        const fontSize = style.size
        const weight = style.bold ? 'bold ' : ''
        ctx.font = `${weight}${fontSize}px ${TELOP_FONT_FAMILY[style.font]}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'

        const maxBandWidth = WIDTH - 80
        const metrics = ctx.measureText(visibleText)
        const padX = 28
        const padY = 18
        const bandWidth = Math.min(maxBandWidth, metrics.width + padX * 2)
        const bandHeight = fontSize + padY * 2
        const bandX = (WIDTH - bandWidth) / 2
        let bandY: number
        if (style.position === 'top') bandY = 60
        else if (style.position === 'center') bandY = (HEIGHT - bandHeight) / 2
        else bandY = HEIGHT - bandHeight - 60

        ctx.save()
        ctx.globalAlpha = fadeAlpha
        if (popScale !== 1) {
          const cxp = bandX + bandWidth / 2
          const cyp = bandY + bandHeight / 2
          ctx.translate(cxp, cyp)
          ctx.scale(popScale, popScale)
          ctx.translate(-cxp, -cyp)
        }
        if (shake.x !== 0 || shake.y !== 0) ctx.translate(shake.x, shake.y)

        ctx.fillStyle = hexToRgba(style.band_color, style.band_opacity)
        ctx.beginPath()
        ctx.roundRect(bandX, bandY, bandWidth, bandHeight, 14)
        ctx.fill()

        const textY = bandY + bandHeight - padY
        if (style.stroke_width > 0) {
          ctx.lineWidth = style.stroke_width
          ctx.strokeStyle = style.stroke_color
          ctx.lineJoin = 'round'
          ctx.miterLimit = 2
          ctx.strokeText(visibleText, WIDTH / 2, textY)
        }
        ctx.fillStyle = style.color
        ctx.fillText(visibleText, WIDTH / 2, textY)

        ctx.restore()
      }
    }

    // タイトルカード(シーン冒頭の大見出し): 0..2500ms で fade in→hold→fade out
    if (titleCardText && sceneElapsedMs < 2500) {
      const TC_DUR = 2500
      const FADE_IN = 300
      const FADE_OUT = 300
      let alpha = 1
      if (sceneElapsedMs < FADE_IN) {
        alpha = sceneElapsedMs / FADE_IN
      } else if (sceneElapsedMs > TC_DUR - FADE_OUT) {
        alpha = (TC_DUR - sceneElapsedMs) / FADE_OUT
      }
      alpha = Math.max(0, Math.min(1, alpha))
      ctx.save()
      // 半透明黒の全画面マスク(タイトルが浮き上がるよう少し落とす)
      ctx.fillStyle = `rgba(0,0,0,${0.45 * alpha})`
      ctx.fillRect(0, 0, WIDTH, HEIGHT)
      // 大見出し
      const fontSize = Math.round(WIDTH * 0.085)
      ctx.font = `bold ${fontSize}px "Hiragino Mincho ProN", "Yu Mincho", "MS Mincho", serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.lineWidth = Math.max(4, fontSize * 0.12)
      ctx.strokeStyle = `rgba(0,0,0,${alpha})`
      ctx.fillStyle = `rgba(255,255,255,${alpha})`
      ctx.strokeText(titleCardText, WIDTH / 2, HEIGHT / 2)
      ctx.fillText(titleCardText, WIDTH / 2, HEIGHT / 2)
      ctx.restore()
    }
  }

  async function startExport() {
    if (!canvasRef.current || validSegments.length === 0) return
    cancelledRef.current = false
    setStatus('preparing')
    setProgressIndex(0)
    setProgressTotal(totalDialogues)
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

    const imageCache = new Map<string, HTMLImageElement>()
    const urls = new Set<string>()
    for (const seg of validSegments) {
      for (const layer of seg.backgroundLayers) urls.add(layer.image_url)
      for (const q of seg.dialogues) {
        if (q.character?.image_url) urls.add(q.character.image_url)
        if (q.mouthOpen) urls.add(q.mouthOpen.image_url)
        if (q.mouthClosed) urls.add(q.mouthClosed.image_url)
        if (q.blink) urls.add(q.blink.image_url)
        if (q.override) urls.add(q.override.image_url)
        q.extras.forEach((ex) => urls.add(ex.imageUrl))
      }
    }

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
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
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

      recorder = new MediaRecorder(combinedStream, mimeType ? { mimeType } : undefined)
      const chunks: Blob[] = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }
      const recordingDone = new Promise<void>((resolve) => {
        if (!recorder) return resolve()
        recorder.onstop = () => resolve()
      })

      recorder.start(100)
      setStatus('recording')

      let globalIdx = 0
      let segIdx = -1

      // シーン単位で BGM と背景を切り替えながらセリフを再生
      for (const seg of validSegments) {
        if (cancelledRef.current) break
        segIdx++
        setCurrentSceneLabel(`#${globalIdx + 1} ${seg.scene.title ?? ''}`)

        // シーン頭のフェード: 前シーン末尾フレームを保存しておき、それを下敷きに
        // 黒のアルファを 0→1 まで上げていく。短時間(280ms)の黒フェード。
        if (segIdx > 0 && (seg.scene.transition_in ?? 'cut') === 'fade') {
          let snapshot: ImageData | null = null
          try {
            snapshot = ctx.getImageData(0, 0, WIDTH, HEIGHT)
          } catch (e) {
            // tainted canvas 等で失敗したら諦めて黒一発
            console.warn('[anime-app] fade snapshot failed', e)
          }
          const FADE_MS = 280
          const fadeStart = performance.now()
          await new Promise<void>((resolve) => {
            const tick = () => {
              if (cancelledRef.current) {
                resolve()
                return
              }
              const elapsed = performance.now() - fadeStart
              if (elapsed >= FADE_MS) {
                ctx.fillStyle = '#000'
                ctx.fillRect(0, 0, WIDTH, HEIGHT)
                resolve()
                return
              }
              const t = elapsed / FADE_MS
              if (snapshot) {
                ctx.putImageData(snapshot, 0, 0)
                ctx.fillStyle = `rgba(0,0,0,${t})`
                ctx.fillRect(0, 0, WIDTH, HEIGHT)
              } else {
                ctx.fillStyle = '#000'
                ctx.fillRect(0, 0, WIDTH, HEIGHT)
              }
              requestAnimationFrame(tick)
            }
            requestAnimationFrame(tick)
          })
        }

        // BGM: シーンに入ったときに起動、シーン終了時に停止
        let bgmEl: HTMLAudioElement | null = null
        let bgmSource: MediaElementAudioSourceNode | null = null
        let bgmGain: GainNode | null = null
        if (seg.bgmTrack?.file_url) {
          bgmEl = new Audio()
          bgmEl.src = seg.bgmTrack.file_url
          bgmEl.loop = true
          bgmEl.preload = 'auto'
          try {
            await new Promise<void>((resolve, reject) => {
              if (!bgmEl) return resolve()
              const onReady = () => resolve()
              const onErr = () => reject(new Error('BGM の読み込みに失敗'))
              bgmEl.addEventListener('canplaythrough', onReady, { once: true })
              bgmEl.addEventListener('error', onErr, { once: true })
              bgmEl.load()
            })
            bgmSource = audioCtx.createMediaElementSource(bgmEl)
            bgmGain = audioCtx.createGain()
            bgmGain.gain.value = seg.bgmVolume
            bgmSource.connect(bgmGain)
            bgmGain.connect(destination)
            bgmGain.connect(audioCtx.destination)
            bgmEl.currentTime = 0
            await bgmEl.play().catch((e) =>
              console.warn('[anime-app] bgm play blocked', e),
            )
          } catch (e) {
            console.warn('[anime-app] bgm setup failed', e)
            bgmEl = null
          }
        }

        // シーン全体のカメラワーク用の開始時刻
        const sceneStartAt = performance.now()
        const sceneCameraMotion = seg.scene.camera_motion ?? null

        for (const current of seg.dialogues) {
          if (cancelledRef.current) break
          setProgressIndex(globalIdx)
          globalIdx++

          let seEl: HTMLAudioElement | null = null
          let seSource: MediaElementAudioSourceNode | null = null
          let seGain: GainNode | null = null
          if (current.se?.file_url) {
            seEl = new Audio()
            seEl.src = current.se.file_url
            seEl.preload = 'auto'
            try {
              await new Promise<void>((resolve, reject) => {
                if (!seEl) return resolve()
                const onReady = () => resolve()
                const onErr = () => reject(new Error('SE の読み込みに失敗'))
                seEl.addEventListener('canplaythrough', onReady, { once: true })
                seEl.addEventListener('error', onErr, { once: true })
                seEl.load()
              })
              seSource = audioCtx.createMediaElementSource(seEl)
              seGain = audioCtx.createGain()
              seGain.gain.value = current.seVolume
              seSource.connect(seGain)
              seGain.connect(destination)
              seGain.connect(audioCtx.destination)
            } catch (e) {
              console.warn('[anime-app] se setup failed', e)
              seEl = null
            }
          }

          let audioEl: HTMLAudioElement | null = null
          let source: MediaElementAudioSourceNode | null = null
          let analyser: AnalyserNode | null = null
          if (current.audio) {
            audioEl = new Audio()
            audioEl.src = current.audio.file_url
            audioEl.preload = 'auto'
            await new Promise<void>((resolve, reject) => {
              const onReady = () => resolve()
              const onErr = () => reject(new Error('音声の読み込みに失敗'))
              audioEl!.addEventListener('canplaythrough', onReady, { once: true })
              audioEl!.addEventListener('error', onErr, { once: true })
              audioEl!.load()
            })
            source = audioCtx.createMediaElementSource(audioEl)
            analyser = audioCtx.createAnalyser()
            analyser.fftSize = 512
            source.connect(analyser)
            analyser.connect(destination)
            analyser.connect(audioCtx.destination)
          }

          const freq = analyser ? new Uint8Array(analyser.frequencyBinCount) : null
          let mouthOpen = false
          let lastTick = performance.now()
          let raf: number | null = null
          let blinking = false
          let blinkEndAt = 0
          let nextBlinkAt = performance.now() + 3000 + Math.random() * 2000

          await new Promise<void>((resolve, reject) => {
            const startAt = performance.now()
            const silentEndAt = current.audio ? Infinity : startAt + current.silentDurationMs

            if (audioEl) {
              audioEl.addEventListener('ended', () => resolve(), { once: true })
              audioEl.addEventListener(
                'error',
                () => reject(new Error('再生エラー')),
                { once: true },
              )
              audioEl.play().catch(reject)
            }
            if (seEl) {
              seEl.currentTime = 0
              seEl.play().catch((e) => console.warn('[anime-app] se play blocked', e))
            }

            const tick = (now: number) => {
              if (cancelledRef.current) {
                resolve()
                return
              }
              if (!current.audio && now >= silentEndAt) {
                resolve()
                return
              }
              if (analyser && freq && now - lastTick >= TICK_MS) {
                analyser.getByteFrequencyData(freq)
                let sum = 0
                for (let k = 0; k < freq.length; k++) sum += freq[k]
                mouthOpen = sum / freq.length > LIPSYNC_THRESHOLD
                lastTick = now
              }
              if (current.character) {
                if (blinking && now >= blinkEndAt) {
                  blinking = false
                  nextBlinkAt = now + 3000 + Math.random() * 2000
                } else if (!blinking && now >= nextBlinkAt) {
                  blinking = true
                  blinkEndAt = now + 80
                }
              }
              drawFrame(
                ctx,
                current,
                seg.backgroundLayers,
                imageCache,
                mouthOpen,
                blinking,
                now - startAt,
                sceneCameraMotion,
                now - sceneStartAt,
                seg.scene.title_card_text ?? null,
                seg.scene.color_filter ?? null,
              )
              raf = requestAnimationFrame(tick)
            }
            raf = requestAnimationFrame(tick)
          })

          if (raf !== null) cancelAnimationFrame(raf)
          try {
            source?.disconnect()
            analyser?.disconnect()
            seSource?.disconnect()
            seGain?.disconnect()
          } catch (e) {
            console.warn('[anime-app] disconnect warn', e)
          }
          if (seEl) {
            seEl.pause()
            seEl.src = ''
          }
          if (audioEl) audioEl.src = ''

          // 間合い(次のセリフまで無音で待つ)
          if (current.pauseAfterMs > 0 && !cancelledRef.current) {
            const pauseEnd = performance.now() + current.pauseAfterMs
            await new Promise<void>((resolve) => {
              let r: number | null = null
              const tick = (now: number) => {
                if (cancelledRef.current || now >= pauseEnd) {
                  resolve()
                  return
                }
                drawFrame(
                  ctx,
                  current,
                  seg.backgroundLayers,
                  imageCache,
                  false,
                  false,
                  current.silentDurationMs + 99999,
                  sceneCameraMotion,
                  now - sceneStartAt,
                  seg.scene.title_card_text ?? null,
                  seg.scene.color_filter ?? null,
                )
                r = requestAnimationFrame(tick)
              }
              r = requestAnimationFrame(tick)
              void r
            })
          }
        }

        // シーンを終える: BGM を止める
        if (bgmEl) {
          bgmEl.pause()
          try {
            bgmSource?.disconnect()
            bgmGain?.disconnect()
          } catch (e) {
            console.warn('[anime-app] bgm disconnect warn', e)
          }
          bgmEl.src = ''
        }
      }

      recorder.stop()
      await recordingDone

      if (cancelledRef.current) {
        setStatus('idle')
        return
      }

      const webmBlob = new Blob(chunks, { type: mimeType || 'video/webm' })

      if (format === 'mp4') {
        setStatus('converting')
        setConvertProgress(0)
        try {
          const { convertWebmToMp4, loadFfmpeg } = await import('@/lib/ffmpeg-lazy')
          await loadFfmpeg((kind, loaded, total) => {
            const label = kind === 'core-js' ? 'コード' : 'WASM'
            const pct = total > 0 ? Math.round((loaded / total) * 100) : 0
            setFfmpegLoadMsg(`変換ツール(${label})を読み込み中… ${pct}%`)
          })
          setFfmpegLoadMsg(null)
          const mp4Blob = await convertWebmToMp4(webmBlob, (r) => setConvertProgress(r))
          if (cancelledRef.current) {
            setStatus('idle')
            return
          }
          setBlobUrl(URL.createObjectURL(mp4Blob))
          setStatus('complete')
        } catch (e) {
          console.error('[anime-app] mp4 convert failed', e)
          setErrorMessage(
            'mp4 変換に失敗したため WebM のまま出力しました: ' + (e as Error).message,
          )
          setBlobUrl(URL.createObjectURL(webmBlob))
          setStatus('complete')
        }
      } else {
        setBlobUrl(URL.createObjectURL(webmBlob))
        setStatus('complete')
      }
    } catch (e) {
      console.error('[anime-app] video export failed', e)
      setErrorMessage((e as Error).message)
      setStatus('error')
      try {
        if (recorder && recorder.state !== 'inactive') recorder.stop()
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
    const ext = format === 'mp4' && !errorMessage ? 'mp4' : 'webm'
    a.download = `${videoName || 'video'}.${ext}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>動画「{videoName}」を書き出し</DialogTitle>
          <DialogDescription>
            この動画の全シーンを順番に繋いで 1 本の動画として生成します。シーンの境目で
            背景と BGM が切り替わります({validSegments.length} シーン /{' '}
            {totalDialogues} クリップ)
          </DialogDescription>
        </DialogHeader>

        {validSegments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            書き出し可能なシーンがありません。キャラ+音声が揃ったセリフを含むシーンを
            追加してください
          </p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-3 p-3 bg-background border border-border rounded-md">
              {/* クイック設定プリセット(投稿先ごと) */}
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-xs text-muted-foreground mr-1">プリセット:</span>
                {(
                  [
                    { label: 'Shorts/Reels', f: 'mp4', a: '9:16', q: '1080p' },
                    { label: 'X (Twitter)', f: 'mp4', a: '16:9', q: '720p' },
                    { label: 'YouTube', f: 'mp4', a: '16:9', q: '1080p' },
                    { label: 'Instagram正方', f: 'mp4', a: '1:1', q: '1080p' },
                  ] as const
                ).map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    disabled={status !== 'idle'}
                    onClick={() => {
                      setFormat(p.f as Format)
                      setAspect(p.a as Aspect)
                      setQuality(p.q as Quality)
                    }}
                    className="px-2 py-1 text-xs rounded border border-input text-muted-foreground hover:bg-primary/10 hover:text-primary disabled:opacity-50 transition"
                    title={`${p.f} / ${p.a} / ${p.q}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">出力形式</label>
                  <div className="flex gap-1">
                    {(['webm', 'mp4'] as Format[]).map((f) => (
                      <button
                        key={f}
                        type="button"
                        disabled={status !== 'idle'}
                        onClick={() => setFormat(f)}
                        className={`flex-1 px-2 py-1.5 text-xs rounded border transition disabled:opacity-50 ${
                          format === f
                            ? 'bg-primary/20 border-primary/40 text-primary'
                            : 'bg-card border-input text-foreground hover:bg-primary/10'
                        }`}
                      >
                        {f === 'webm' ? 'WebM' : 'mp4'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">アスペクト</label>
                  <div className="flex gap-1">
                    {(
                      [
                        ['9:16', '縦'],
                        ['16:9', '横'],
                        ['1:1', '正方'],
                      ] as [Aspect, string][]
                    ).map(([a, label]) => (
                      <button
                        key={a}
                        type="button"
                        disabled={status !== 'idle'}
                        onClick={() => setAspect(a)}
                        className={`flex-1 px-2 py-1.5 text-xs rounded border transition disabled:opacity-50 ${
                          aspect === a
                            ? 'bg-primary/20 border-primary/40 text-primary'
                            : 'bg-card border-input text-foreground hover:bg-primary/10'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">解像度</label>
                  <div className="flex gap-1">
                    {(['720p', '1080p'] as Quality[]).map((q) => (
                      <button
                        key={q}
                        type="button"
                        disabled={status !== 'idle'}
                        onClick={() => setQuality(q)}
                        className={`flex-1 px-2 py-1.5 text-xs rounded border transition disabled:opacity-50 ${
                          quality === q
                            ? 'bg-primary/20 border-primary/40 text-primary'
                            : 'bg-card border-input text-foreground hover:bg-primary/10'
                        }`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                出力サイズ: {WIDTH}×{HEIGHT}・形式: {format === 'mp4' ? 'mp4 (H.264/AAC)' : 'WebM'}
                {format === 'mp4' ? ' / 初回のみ変換ツールを ~30MB 読み込みます' : ''}
              </p>
            </div>

            <canvas
              ref={canvasRef}
              className="mx-auto border border-border rounded bg-black"
              style={{
                width: aspect === '16:9' ? 320 : 240,
                aspectRatio:
                  aspect === '9:16' ? '9 / 16' : aspect === '16:9' ? '16 / 9' : '1 / 1',
              }}
            />

            {status === 'idle' && (
              <Button onClick={startExport} className="gap-2 w-full">
                <Video size={18} /> 動画を書き出す
              </Button>
            )}

            {(status === 'preparing' || status === 'recording') && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground text-center">
                  {status === 'preparing'
                    ? '全シーンの画像を読み込み中...'
                    : `録画中 ${progressIndex + 1} / ${progressTotal}${
                        currentSceneLabel ? ` (${currentSceneLabel})` : ''
                      }`}
                </p>
                <div className="w-full h-2 bg-muted rounded overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{
                      width: `${progressTotal ? (progressIndex / progressTotal) * 100 : 0}%`,
                    }}
                  />
                </div>
                <Button variant="outline" onClick={cancel} className="gap-2 w-full">
                  <Square size={16} /> 中止
                </Button>
              </div>
            )}

            {status === 'converting' && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground text-center">
                  {ffmpegLoadMsg ?? `mp4 に変換中… ${Math.round(convertProgress * 100)}%`}
                </p>
                <div className="w-full h-2 bg-muted rounded overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${Math.round(convertProgress * 100)}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground text-center">
                  動画が長いほど時間がかかります。ブラウザは閉じないでください
                </p>
              </div>
            )}

            {status === 'complete' && blobUrl && (
              <div className="space-y-3">
                <video src={blobUrl} controls className="w-full rounded" />
                <Button onClick={downloadVideo} className="gap-2 w-full">
                  <Download size={16} /> ダウンロード (.
                  {format === 'mp4' && !errorMessage ? 'mp4' : 'webm'})
                </Button>
                {errorMessage && (
                  <p className="text-xs text-destructive text-center">※ {errorMessage}</p>
                )}
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
