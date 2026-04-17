'use client'

// シーンカードに表示する小さなサムネイル。
// 最初のセリフ(または背景のみ)を基準に、クライアントサイドでフレームを 1 枚描画して使う。

import { useEffect, useRef, useState } from 'react'
import type {
  AudioFile,
  Character,
  CharacterExpression,
  IllustrationWithLayers,
  Layer,
  SceneCastMember,
  SceneWithDialogues,
} from '@/types/db'

const W = 320
const H = 180 // 16:9 固定(アスペクトはサムネ用に統一)

async function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

function pickIdleUrl(
  member: SceneCastMember,
  expressions: CharacterExpression[],
  characters: Character[],
): string | null {
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

function backgroundLayersForScene(
  scene: SceneWithDialogues,
  illustrations: IllustrationWithLayers[],
): Layer[] {
  if (!scene.background_illustration_id) return []
  const illust = illustrations.find((i) => i.id === scene.background_illustration_id)
  if (!illust) return []
  return [...illust.layers]
    .filter((l) => l.visible)
    .sort((a, b) => a.order_index - b.order_index)
}

/**
 * 指定されたシーンの特定セリフ(未指定なら先頭の有効セリフ)を静止画 1 枚として描画する。
 * 返り値は dataUrl (format 指定可能)。サムネイル兼フレームスナップショット用。
 */
export async function renderSceneFrame(
  scene: SceneWithDialogues,
  data: {
    characters: Character[]
    audioFiles: AudioFile[]
    expressions: CharacterExpression[]
    illustrations: IllustrationWithLayers[]
    sceneCast: SceneCastMember[]
  },
  opts: {
    width?: number
    height?: number
    targetSdId?: string | null
    format?: 'image/png' | 'image/jpeg'
    quality?: number
    overlay?: boolean
  } = {},
): Promise<string | null> {
  const W2 = opts.width ?? W
  const H2 = opts.height ?? H
  const canvas = document.createElement('canvas')
  canvas.width = W2
  canvas.height = H2
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  // ベース塗り
  ctx.fillStyle = '#0b0b0b'
  ctx.fillRect(0, 0, W2, H2)

  // 背景
  const bgLayers = backgroundLayersForScene(scene, data.illustrations)
  for (const layer of bgLayers) {
    const bg = await loadImage(layer.image_url)
    if (!bg) continue
    const scale = Math.max(W2 / bg.width, H2 / bg.height)
    const w = bg.width * scale
    const h = bg.height * scale
    const x = (W2 - w) / 2
    const y = (H2 - h) / 2
    const prev = ctx.globalAlpha
    ctx.globalAlpha = layer.opacity
    ctx.drawImage(bg, x, y, w, h)
    ctx.globalAlpha = prev
  }

  // 対象セリフ: targetSdId があればそれ、無ければ最初の有効セリフ
  const targetSd = opts.targetSdId
    ? scene.dialogues.find((sd) => sd.id === opts.targetSdId)
    : undefined
  const firstValid = targetSd ?? scene.dialogues.find((sd) => {
    const d = sd.dialogue
    if (!d) return false
    const character = data.characters.find((c) => c.id === d.character_id) ?? null
    const audio = data.audioFiles.find((a) => a.id === d.audio_id) ?? null
    const isNormal = character && audio
    const isNarration = !character && d.text.trim().length > 0
    return isNormal || isNarration
  })

  const sceneCastMembers = data.sceneCast.filter((c) => c.scene_id === scene.id)
  const speakerCharacterId = firstValid?.dialogue?.character_id ?? null
  const extras = sceneCastMembers.filter((m) => m.character_id !== speakerCharacterId)

  // 共演キャラ
  for (const ex of extras) {
    const url = pickIdleUrl(ex, data.expressions, data.characters)
    if (!url) continue
    const img = await loadImage(url)
    if (!img) continue
    const fit = Math.min(W2 / img.width, H2 / img.height)
    const baseW = img.width * fit
    const baseH = img.height * fit
    const w = baseW * ex.scale
    const h = baseH * ex.scale
    const cx = W2 * ex.x
    const x = cx - w / 2
    const y = H2 - h
    if (ex.flipped) {
      ctx.save()
      ctx.translate(cx, 0)
      ctx.scale(-1, 1)
      ctx.drawImage(img, -w / 2, y, w, h)
      ctx.restore()
    } else {
      ctx.drawImage(img, x, y, w, h)
    }
  }

  // 発話キャラ(口閉じ または メイン画像)
  if (firstValid && speakerCharacterId) {
    const character = data.characters.find((c) => c.id === speakerCharacterId) ?? null
    const charExprs = data.expressions.filter((e) => e.character_id === speakerCharacterId)
    const speakerCast = sceneCastMembers.find((m) => m.character_id === speakerCharacterId)
    const imgUrl =
      charExprs.find((e) => e.kind === 'mouth_closed')?.image_url ??
      character?.image_url ??
      null
    if (imgUrl) {
      const img = await loadImage(imgUrl)
      if (img) {
        const fit = Math.min(W2 / img.width, H2 / img.height)
        const baseW = img.width * fit
        const baseH = img.height * fit
        const sd = firstValid
        const scale =
          speakerCast?.scale ??
          (typeof sd.character_scale === 'number' ? sd.character_scale : 1.0)
        const x01 =
          speakerCast?.x ??
          (typeof sd.character_x === 'number' ? sd.character_x : 0.5)
        const flipped =
          typeof speakerCast?.flipped === 'boolean'
            ? !!speakerCast.flipped
            : !!sd.character_flipped
        const w = baseW * scale
        const h = baseH * scale
        const cx = W2 * x01
        const x = cx - w / 2
        const y = H2 - h
        if (flipped) {
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
  }

  // サムネ用の軽いグラデオーバーレイ(opts.overlay が false ならスキップ)
  if (opts.overlay !== false) {
    const grad = ctx.createLinearGradient(0, H2 - 40, 0, H2)
    grad.addColorStop(0, 'rgba(0,0,0,0)')
    grad.addColorStop(1, 'rgba(0,0,0,0.45)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W2, H2)
  }

  const fmt = opts.format ?? 'image/jpeg'
  const q = opts.quality ?? 0.8
  return canvas.toDataURL(fmt, q)
}

export function SceneThumbnail({
  scene,
  characters,
  audioFiles,
  expressions,
  illustrations,
  sceneCast,
  className,
}: {
  scene: SceneWithDialogues
  characters: Character[]
  audioFiles: AudioFile[]
  expressions: CharacterExpression[]
  illustrations: IllustrationWithLayers[]
  sceneCast: SceneCastMember[]
  className?: string
}) {
  const [url, setUrl] = useState<string | null>(null)
  const lastKeyRef = useRef<string>('')

  // シーン内容が変わったら再描画。依存キーはざっくり関連要素のハッシュ風文字列で判断。
  const depsKey =
    scene.id +
    '|' +
    (scene.background_illustration_id ?? '') +
    '|' +
    scene.dialogues.length +
    '|' +
    (scene.dialogues[0]?.dialogue_id ?? '') +
    '|' +
    (scene.dialogues[0]?.character_x ?? '') +
    '|' +
    (scene.dialogues[0]?.character_scale ?? '') +
    '|' +
    (scene.dialogues[0]?.character_flipped ? 1 : 0) +
    '|' +
    sceneCast
      .filter((c) => c.scene_id === scene.id)
      .map((c) => `${c.character_id}:${c.x.toFixed(2)}:${c.scale.toFixed(2)}:${c.flipped ? 1 : 0}`)
      .join(',') +
    '|' +
    characters.length +
    '|' +
    expressions.length +
    '|' +
    illustrations.length

  useEffect(() => {
    if (depsKey === lastKeyRef.current) return
    lastKeyRef.current = depsKey
    let cancelled = false
    renderSceneFrame(scene, {
      characters,
      audioFiles,
      expressions,
      illustrations,
      sceneCast,
    })
      .then((u) => {
        if (!cancelled) setUrl(u)
      })
      .catch((e) => console.warn('[anime-app] thumbnail gen failed', e))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey])

  if (!url) {
    return (
      <div
        className={`bg-muted rounded flex items-center justify-center text-[10px] text-muted-foreground ${
          className ?? 'w-20 h-12'
        }`}
      >
        …
      </div>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className={`rounded object-cover ${className ?? 'w-20 h-12'}`}
    />
  )
}
