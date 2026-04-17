'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  DEFAULT_TELOP_STYLE,
  TELOP_FONT_FAMILY,
  type TelopFont,
  type TelopPosition,
  type TelopStyle,
} from '@/types/db'

const FONT_LABEL: Record<TelopFont, string> = {
  gothic: 'ゴシック',
  mincho: '明朝',
  rounded: '丸ゴシック',
}

const POSITION_LABEL: Record<TelopPosition, string> = {
  top: '上',
  center: '中央',
  bottom: '下',
}

export function TelopSettingsDialog({
  open,
  initialStyle,
  onSave,
  onClose,
}: {
  open: boolean
  initialStyle: TelopStyle
  onSave: (style: TelopStyle) => void | Promise<void>
  onClose: () => void
}) {
  const [style, setStyle] = useState<TelopStyle>(initialStyle)

  // ダイアログを開くたびに最新の設定で再初期化
  useEffect(() => {
    if (open) setStyle(initialStyle)
  }, [open, initialStyle])

  function update<K extends keyof TelopStyle>(key: K, value: TelopStyle[K]) {
    setStyle((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    await onSave(style)
    onClose()
  }

  function handleReset() {
    setStyle(DEFAULT_TELOP_STYLE)
  }

  const previewBandStyle = toBandStyle(style)
  const previewTextStyle = toTextStyle(style)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>テロップ設定</DialogTitle>
          <DialogDescription>
            再生・書き出し時の字幕の見た目を調整します(全シーン共通)
          </DialogDescription>
        </DialogHeader>

        {/* プレビュー */}
        <div
          className="relative w-full rounded-md bg-neutral-800 overflow-hidden border border-border"
          style={{ aspectRatio: '16 / 9' }}
        >
          <div
            className="absolute inset-x-2 pointer-events-none"
            style={{
              top: style.position === 'top' ? 12 : undefined,
              bottom: style.position === 'bottom' ? 12 : undefined,
              ...(style.position === 'center'
                ? { top: '50%', transform: 'translateY(-50%)' }
                : {}),
            }}
          >
            <div className="mx-auto max-w-[95%] text-center">
              <span className="inline-block" style={previewBandStyle}>
                <span style={previewTextStyle}>ここにセリフが入ります</span>
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* フォント */}
          <Field label="フォント">
            <select
              value={style.font}
              onChange={(e) => update('font', e.target.value as TelopFont)}
              className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {(Object.keys(FONT_LABEL) as TelopFont[]).map((f) => (
                <option key={f} value={f}>
                  {FONT_LABEL[f]}
                </option>
              ))}
            </select>
          </Field>

          {/* 位置 */}
          <Field label="表示位置">
            <div className="flex gap-1">
              {(Object.keys(POSITION_LABEL) as TelopPosition[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => update('position', p)}
                  className={`flex-1 px-3 py-2 text-sm rounded-md border transition ${
                    style.position === p
                      ? 'bg-primary/20 border-primary/40 text-primary'
                      : 'bg-background border-input text-foreground hover:bg-primary/10'
                  }`}
                >
                  {POSITION_LABEL[p]}
                </button>
              ))}
            </div>
          </Field>

          {/* サイズ */}
          <Field label={`文字サイズ: ${style.size}px`}>
            <input
              type="range"
              min={24}
              max={80}
              step={1}
              value={style.size}
              onChange={(e) => update('size', Number(e.target.value))}
              className="w-full accent-primary"
            />
          </Field>

          {/* 太字 */}
          <Field label="太字">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={style.bold}
                onChange={(e) => update('bold', e.target.checked)}
                className="accent-primary"
              />
              太字で表示
            </label>
          </Field>

          {/* 文字色 */}
          <Field label="文字色">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={style.color}
                onChange={(e) => update('color', e.target.value)}
                className="w-10 h-9 rounded border border-input bg-background"
              />
              <code className="text-xs text-muted-foreground tabular-nums">{style.color}</code>
            </div>
          </Field>

          {/* 縁取り色 */}
          <Field label="縁取り色">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={style.stroke_color}
                onChange={(e) => update('stroke_color', e.target.value)}
                className="w-10 h-9 rounded border border-input bg-background"
              />
              <code className="text-xs text-muted-foreground tabular-nums">
                {style.stroke_color}
              </code>
            </div>
          </Field>

          {/* 縁取り太さ */}
          <Field label={`縁取り太さ: ${style.stroke_width}px`}>
            <input
              type="range"
              min={0}
              max={12}
              step={1}
              value={style.stroke_width}
              onChange={(e) => update('stroke_width', Number(e.target.value))}
              className="w-full accent-primary"
            />
          </Field>

          {/* 帯色 */}
          <Field label="帯色">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={style.band_color}
                onChange={(e) => update('band_color', e.target.value)}
                className="w-10 h-9 rounded border border-input bg-background"
              />
              <code className="text-xs text-muted-foreground tabular-nums">
                {style.band_color}
              </code>
            </div>
          </Field>

          {/* 帯不透明度 */}
          <Field label={`帯の不透明度: ${Math.round(style.band_opacity * 100)}%`}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={style.band_opacity}
              onChange={(e) => update('band_opacity', Number(e.target.value))}
              className="w-full accent-primary"
            />
          </Field>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={handleReset}>
            既定値に戻す
          </Button>
          <Button type="button" onClick={handleSave}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">{label}</label>
      {children}
    </div>
  )
}

// =========== スタイルヘルパー(Stage/Preview 共用) ===========

export function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '')
  const bigint = parseInt(
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => c + c)
          .join('')
      : normalized,
    16,
  )
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function toBandStyle(style: TelopStyle): React.CSSProperties {
  return {
    backgroundColor: hexToRgba(style.band_color, style.band_opacity),
    padding: '10px 16px',
    borderRadius: 10,
    lineHeight: 1.15,
  }
}

export function toTextStyle(style: TelopStyle): React.CSSProperties {
  return {
    color: style.color,
    fontFamily: TELOP_FONT_FAMILY[style.font],
    fontSize: style.size,
    fontWeight: style.bold ? 700 : 400,
    WebkitTextStroke:
      style.stroke_width > 0 ? `${style.stroke_width}px ${style.stroke_color}` : undefined,
    paintOrder: 'stroke fill',
  } as React.CSSProperties
}
