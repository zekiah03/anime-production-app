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
  Character,
  CharacterExpression,
  IllustrationWithLayers,
  Layer,
  SceneCastMember,
  SceneWithDialogues,
  SoundEffect,
  TelopShake,
  TelopStyle,
} from '@/types/db'
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

function computeShake(kind: TelopShake, elapsedMs: number): { x: number; y: number } {
  if (kind === 'none') return { x: 0, y: 0 }
  const amplitude = kind === 'heavy' ? 3 : 1
  const t = elapsedMs / 40
  return { x: Math.sin(t * 2.3) * amplitude, y: Math.cos(t * 3.1) * amplitude }
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
}

export function VideoExportDialog({
  videoName,
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
  const [aspect, setAspect] = useState<Aspect>('9:16')
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
  ) {
    ctx.fillStyle = '#111111'
    ctx.fillRect(0, 0, WIDTH, HEIGHT)

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
        const w = baseW * userScale
        const h = baseH * userScale
        const cx = WIDTH * current.characterX
        const x = cx - w / 2
        const y = HEIGHT - h
        if (current.characterFlipped) {
          ctx.save()
          ctx.translate(cx, 0)
          ctx.scale(-1, 1)
          ctx.drawImage(img, -w / 2, y, w, h)
          ctx.restore()
        } else {
          ctx.drawImage(img, x, y, w, h)
        }
      }
    }

    // テロップ
    if (current.text) {
      const style = effectiveStyle
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

      // シーン単位で BGM と背景を切り替えながらセリフを再生
      for (const seg of validSegments) {
        if (cancelledRef.current) break
        setCurrentSceneLabel(`#${globalIdx + 1} ${seg.scene.title ?? ''}`)

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
