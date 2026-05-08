'use client'

import type { ScreenEffect } from '@/types/db'

export const EFFECT_LABEL: Record<ScreenEffect, string> = {
  none: 'なし',
  anger: '怒りマーク 💢',
  sweat: '汗 💦',
  sparkle: 'キラキラ ✨',
  heart: 'ハート ❤️',
  shock: 'ショック ⚡',
  question: 'ハテナ ❓',
  shock_lines: '集中線',
  speed_lines: '流線',
}

interface Props {
  effect: ScreenEffect | null | undefined
}

// LipSyncStage の上に重ねる絶対配置のエフェクト群。
// playing 中だけ親で条件描画する想定。
export function EffectOverlay({ effect }: Props) {
  if (!effect || effect === 'none') return null

  switch (effect) {
    case 'anger':
      return (
        <div className="absolute pointer-events-none" style={{ top: '8%', right: '20%' }}>
          <span className="effect-emoji-jolt" style={{ fontSize: '14%', lineHeight: 1 }}>
            💢
          </span>
        </div>
      )
    case 'sweat':
      return (
        <div className="absolute pointer-events-none" style={{ top: '12%', left: '24%' }}>
          <span className="effect-emoji-drop" style={{ fontSize: '12%', lineHeight: 1 }}>
            💦
          </span>
        </div>
      )
    case 'sparkle':
      return (
        <div className="absolute inset-0 pointer-events-none">
          {[
            { top: '14%', left: '18%', delay: '0s' },
            { top: '20%', right: '20%', delay: '0.3s' },
            { top: '38%', left: '10%', delay: '0.6s' },
            { top: '50%', right: '12%', delay: '0.15s' },
            { bottom: '32%', left: '24%', delay: '0.45s' },
          ].map((p, i) => (
            <span
              key={i}
              className="effect-emoji-twinkle absolute"
              style={{ ...p, fontSize: '8%', lineHeight: 1, animationDelay: p.delay }}
            >
              ✨
            </span>
          ))}
        </div>
      )
    case 'heart':
      return (
        <div className="absolute inset-0 pointer-events-none">
          {[
            { bottom: '20%', left: '30%', delay: '0s' },
            { bottom: '30%', right: '32%', delay: '0.4s' },
            { bottom: '12%', left: '46%', delay: '0.8s' },
          ].map((p, i) => (
            <span
              key={i}
              className="effect-emoji-float-up absolute"
              style={{ ...p, fontSize: '10%', lineHeight: 1, animationDelay: p.delay }}
            >
              ❤️
            </span>
          ))}
        </div>
      )
    case 'shock':
      return (
        <div className="absolute pointer-events-none" style={{ top: '14%', right: '18%' }}>
          <span className="effect-emoji-jolt" style={{ fontSize: '16%', lineHeight: 1 }}>
            ⚡
          </span>
        </div>
      )
    case 'question':
      return (
        <div className="absolute pointer-events-none" style={{ top: '6%', right: '22%' }}>
          <span
            className="effect-emoji-pulse"
            style={{ fontSize: '14%', lineHeight: 1, color: '#fbbf24' }}
          >
            ❓
          </span>
        </div>
      )
    case 'shock_lines':
      // 中心へ収束する集中線(放射状の grad ストライプを scale で広げる)
      return (
        <div
          className="absolute inset-0 pointer-events-none effect-shock-lines"
          style={{
            background:
              'repeating-conic-gradient(from 0deg at 50% 50%, transparent 0deg, transparent 6deg, rgba(0,0,0,0.85) 6deg, rgba(0,0,0,0.85) 7deg)',
            mixBlendMode: 'multiply',
            maskImage: 'radial-gradient(circle at center, transparent 18%, black 60%)',
            WebkitMaskImage:
              'radial-gradient(circle at center, transparent 18%, black 60%)',
          }}
        />
      )
    case 'speed_lines':
      return (
        <div
          className="absolute inset-0 pointer-events-none effect-speed-lines"
          style={{
            background:
              'repeating-linear-gradient(90deg, rgba(255,255,255,0.85) 0px, rgba(255,255,255,0.85) 2px, transparent 2px, transparent 18px)',
            mixBlendMode: 'screen',
            maskImage:
              'linear-gradient(90deg, black 0%, transparent 25%, transparent 75%, black 100%)',
            WebkitMaskImage:
              'linear-gradient(90deg, black 0%, transparent 25%, transparent 75%, black 100%)',
          }}
        />
      )
    default:
      return null
  }
}
