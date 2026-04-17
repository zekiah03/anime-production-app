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
                // Card の draggable にイベントが届かないよう止める
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
              className={`border-r border-border last:border-r-0 cursor-move px-2 py-1 transition overflow-hidden ${
                isDragging ? 'opacity-50' : ''
              } ${
                isDropTarget
                  ? 'bg-primary/25'
                  : clip.isNarration
                    ? 'bg-accent/10 hover:bg-accent/20'
                    : 'bg-card hover:bg-primary/10'
              }`}
              style={{ width: `${widthPct}%`, minWidth: 56 }}
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

      <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums px-0.5">
        <span>0s</span>
        <span>{(totalSec / 2).toFixed(1)}s</span>
        <span>{totalSec.toFixed(1)}s</span>
      </div>
    </div>
  )
}
