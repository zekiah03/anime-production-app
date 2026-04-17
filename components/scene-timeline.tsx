'use client'

import { useState } from 'react'
import { GripHorizontal, Volume2, Zap } from 'lucide-react'

export interface TimelineClip {
  id: string // SceneDialogue.id
  label: string // 発話者名 or 'ナレーション'
  durationSec: number
  hasSe: boolean
  isNarration: boolean
  text: string
  /** 発話者の ID 由来のカラー(HSL 文字列)。ナレーションは undefined */
  colorHsl?: string
}

function tickIntervalFor(totalSec: number): number {
  if (totalSec <= 10) return 2
  if (totalSec <= 30) return 5
  if (totalSec <= 60) return 10
  if (totalSec <= 180) return 30
  return 60
}

export function SceneTimelineBar({
  clips,
  bgmName,
  onReorder,
  className,
}: {
  clips: TimelineClip[]
  bgmName?: string | null
  onReorder: (fromIdx: number, toIdx: number) => void
  className?: string
}) {
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)
  const [dropIdx, setDropIdx] = useState<number | null>(null)

  if (clips.length === 0) {
    return (
      <div className={`text-xs text-muted-foreground ${className ?? ''}`}>
        タイムライン: まだセリフがありません
      </div>
    )
  }

  const totalSec = clips.reduce((s, c) => s + c.durationSec, 0)

  return (
    <div
      className={`space-y-2 ${className ?? ''}`}
      // ここから下の drag 系イベントが外側(Card の draggable)に伝播しないように止める
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between text-xs flex-wrap gap-2">
        <span className="text-muted-foreground">
          タイムライン: 合計 {totalSec.toFixed(1)}秒 / {clips.length}クリップ(ドラッグで並び替え)
        </span>
        {bgmName && (
          <span className="text-muted-foreground flex items-center gap-1">
            <Volume2 size={12} />
            BGM: {bgmName}(全体ループ)
          </span>
        )}
      </div>

      <div className="relative">
        <div className="flex rounded border border-border bg-background overflow-hidden min-h-[52px]">
          {clips.map((clip, i) => {
            const widthPct = Math.max((clip.durationSec / totalSec) * 100, 4)
            const isDragging = draggedIdx === i
            const isDropTarget =
              dropIdx === i && draggedIdx !== null && draggedIdx !== i
            return (
              <div
                key={clip.id}
                draggable
                onDragStart={(e) => {
                  e.stopPropagation()
                  setDraggedIdx(i)
                  e.dataTransfer.effectAllowed = 'move'
                  try {
                    e.dataTransfer.setData('text/plain', String(i))
                  } catch {}
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (draggedIdx !== null) setDropIdx(i)
                }}
                onDragLeave={() => {
                  if (dropIdx === i) setDropIdx(null)
                }}
                onDrop={(e) => {
                  e.stopPropagation()
                  if (draggedIdx !== null && draggedIdx !== i) {
                    onReorder(draggedIdx, i)
                  }
                  setDraggedIdx(null)
                  setDropIdx(null)
                }}
                onDragEnd={() => {
                  setDraggedIdx(null)
                  setDropIdx(null)
                }}
                className={`border-r border-border last:border-r-0 cursor-move px-2 py-1 transition overflow-hidden relative ${
                  isDragging ? 'opacity-50' : ''
                } ${
                  isDropTarget
                    ? 'bg-primary/25'
                    : clip.isNarration
                      ? 'bg-accent/10 hover:bg-accent/20'
                      : 'bg-card hover:bg-primary/10'
                }`}
                style={{
                  width: `${widthPct}%`,
                  minWidth: 56,
                  borderLeft: clip.colorHsl ? `3px solid ${clip.colorHsl}` : undefined,
                }}
                title={`${i + 1}. ${clip.label}${clip.hasSe ? ' (SE付き)' : ''}\n${clip.text}\n所要: ${clip.durationSec.toFixed(1)}秒`}
              >
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <GripHorizontal size={10} className="flex-shrink-0" />
                  <span className="tabular-nums">#{i + 1}</span>
                  {clip.hasSe && <Zap size={10} className="text-primary ml-auto" />}
                </div>
                <div className="text-xs font-medium text-foreground truncate">
                  {clip.label}
                </div>
                <div className="text-[10px] text-muted-foreground tabular-nums">
                  {clip.durationSec.toFixed(1)}秒
                </div>
              </div>
            )
          })}
        </div>
        {/* 時刻目盛り(バー上に薄い縦線を重ねる) */}
        {totalSec > 0 &&
          (() => {
            const interval = tickIntervalFor(totalSec)
            const ticks: number[] = []
            for (let t = interval; t < totalSec; t += interval) ticks.push(t)
            return ticks.map((t) => (
              <div
                key={t}
                className="absolute top-0 bottom-0 border-l border-border/40 pointer-events-none"
                style={{ left: `${(t / totalSec) * 100}%` }}
              />
            ))
          })()}
      </div>

      {/* 時刻ラベル */}
      {(() => {
        const interval = tickIntervalFor(totalSec)
        const labels: number[] = [0]
        for (let t = interval; t < totalSec; t += interval) labels.push(t)
        labels.push(totalSec)
        return (
          <div className="relative h-3 text-[10px] text-muted-foreground tabular-nums">
            {labels.map((t, i) => {
              const isLast = i === labels.length - 1
              const isFirst = i === 0
              const left = (t / totalSec) * 100
              const transform = isFirst
                ? 'translateX(0)'
                : isLast
                  ? 'translateX(-100%)'
                  : 'translateX(-50%)'
              return (
                <span
                  key={`${t}-${i}`}
                  className="absolute top-0"
                  style={{ left: `${left}%`, transform }}
                >
                  {t.toFixed(0)}s
                </span>
              )
            })}
          </div>
        )
      })()}
    </div>
  )
}
