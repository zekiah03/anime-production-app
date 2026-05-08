// Web Audio API で短い SE と簡易 BGM を合成する。
// 著作権に触れないよう、サウンド素材は全てここで生成する。
// 差し替え前提の「たたき台」サンプル。

const SR = 44100

// ------------------------------------------------------------------
// WAV エンコーダ(PCM 16bit, little-endian)
// ------------------------------------------------------------------

export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const bitDepth = 16
  const bytesPerSample = bitDepth / 8
  const blockAlign = numChannels * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const numSamples = buffer.length
  const dataSize = numSamples * blockAlign
  const headerSize = 44
  const totalSize = headerSize + dataSize

  const arrayBuffer = new ArrayBuffer(totalSize)
  const view = new DataView(arrayBuffer)

  // RIFF header
  writeString(view, 0, 'RIFF')
  view.setUint32(4, totalSize - 8, true)
  writeString(view, 8, 'WAVE')

  // fmt chunk
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitDepth, true)

  // data chunk
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  const channels: Float32Array[] = []
  for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c))

  let offset = 44
  for (let i = 0; i < numSamples; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]))
      const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff
      view.setInt16(offset, int16 | 0, true)
      offset += 2
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' })
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
}

// ------------------------------------------------------------------
// 共通ユーティリティ
// ------------------------------------------------------------------

function OfflineCtx(durationSec: number, channels = 1) {
  const Ctor =
    window.OfflineAudioContext ||
    (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext })
      .webkitOfflineAudioContext
  return new Ctor(channels, Math.max(1, Math.floor(SR * durationSec)), SR)
}

// 簡易エンベロープを掛けた oscillator
function blip(
  ctx: OfflineAudioContext,
  type: OscillatorType,
  freqStart: number,
  freqEnd: number,
  duration: number,
  peakGain = 0.6,
  attack = 0.003,
  startAt = 0,
) {
  const osc = ctx.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(freqStart, startAt)
  if (freqEnd !== freqStart) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), startAt + duration)
  }
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, startAt)
  gain.gain.linearRampToValueAtTime(peakGain, startAt + Math.min(attack, duration * 0.1))
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)
  osc.connect(gain).connect(ctx.destination)
  osc.start(startAt)
  osc.stop(startAt + duration)
  return { osc, gain }
}

function noiseBuffer(ctx: BaseAudioContext, duration: number) {
  const buf = ctx.createBuffer(1, Math.floor(SR * duration), SR)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buf
}

async function render(ctx: OfflineAudioContext): Promise<AudioBuffer> {
  return await ctx.startRendering()
}

// ------------------------------------------------------------------
// SE(短い oneshot)
// ------------------------------------------------------------------

export interface SampleClip {
  name: string
  blob: Blob
  duration: number
}

async function makeSE_Pikoh(): Promise<SampleClip> {
  const duration = 0.16
  const ctx = OfflineCtx(duration)
  blip(ctx, 'sine', 1200, 2000, duration, 0.6)
  const buf = await render(ctx)
  return { name: 'ピコッ', blob: audioBufferToWavBlob(buf), duration }
}

async function makeSE_Pon(): Promise<SampleClip> {
  const duration = 0.2
  const ctx = OfflineCtx(duration)
  blip(ctx, 'triangle', 660, 300, duration, 0.5)
  const buf = await render(ctx)
  return { name: 'ポン', blob: audioBufferToWavBlob(buf), duration }
}

async function makeSE_Don(): Promise<SampleClip> {
  const duration = 0.3
  const ctx = OfflineCtx(duration)
  // 低音のアタック
  blip(ctx, 'square', 90, 45, duration, 0.7, 0.002)
  // 軽いサブノイズ
  const noise = noiseBuffer(ctx, 0.08)
  const src = ctx.createBufferSource()
  src.buffer = noise
  const ng = ctx.createGain()
  ng.gain.setValueAtTime(0.3, 0)
  ng.gain.exponentialRampToValueAtTime(0.0001, 0.1)
  // ローパス代わり
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 400
  src.connect(filter).connect(ng).connect(ctx.destination)
  src.start(0)
  const buf = await render(ctx)
  return { name: 'ドンッ', blob: audioBufferToWavBlob(buf), duration }
}

async function makeSE_Kira(): Promise<SampleClip> {
  const duration = 0.55
  const ctx = OfflineCtx(duration)
  // ドミソドのアルペジオ
  const notes = [523.25, 659.25, 783.99, 1046.5]
  notes.forEach((f, i) => {
    blip(ctx, 'sine', f, f, 0.2, 0.4, 0.002, i * 0.08)
  })
  const buf = await render(ctx)
  return { name: 'キラッ', blob: audioBufferToWavBlob(buf), duration }
}

async function makeSE_Shock(): Promise<SampleClip> {
  const duration = 0.45
  const ctx = OfflineCtx(duration)
  // 不協和音 + 下降
  blip(ctx, 'sawtooth', 440, 120, duration, 0.4)
  blip(ctx, 'sawtooth', 466.16, 130, duration, 0.3) // A + Bb
  const buf = await render(ctx)
  return { name: 'ガーン', blob: audioBufferToWavBlob(buf), duration }
}

async function makeSE_Puff(): Promise<SampleClip> {
  const duration = 0.18
  const ctx = OfflineCtx(duration)
  const noise = noiseBuffer(ctx, duration)
  const src = ctx.createBufferSource()
  src.buffer = noise
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 1000
  filter.Q.value = 1.5
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, 0)
  gain.gain.linearRampToValueAtTime(0.5, 0.005)
  gain.gain.exponentialRampToValueAtTime(0.0001, duration)
  src.connect(filter).connect(gain).connect(ctx.destination)
  src.start(0)
  const buf = await render(ctx)
  return { name: 'パフッ', blob: audioBufferToWavBlob(buf), duration }
}

async function makeSE_Click(): Promise<SampleClip> {
  const duration = 0.08
  const ctx = OfflineCtx(duration)
  blip(ctx, 'square', 2000, 2000, duration, 0.4)
  const buf = await render(ctx)
  return { name: 'カチッ', blob: audioBufferToWavBlob(buf), duration }
}

async function makeSE_Chime(): Promise<SampleClip> {
  const duration = 0.8
  const ctx = OfflineCtx(duration)
  // 2和音ベル
  blip(ctx, 'sine', 880, 880, duration, 0.4, 0.01)
  blip(ctx, 'sine', 1318.51, 1318.51, duration, 0.25, 0.01)
  const buf = await render(ctx)
  return { name: 'ピンポン', blob: audioBufferToWavBlob(buf), duration }
}

export async function generateSampleSoundEffects(): Promise<SampleClip[]> {
  return Promise.all([
    makeSE_Pikoh(),
    makeSE_Pon(),
    makeSE_Don(),
    makeSE_Kira(),
    makeSE_Shock(),
    makeSE_Puff(),
    makeSE_Click(),
    makeSE_Chime(),
  ])
}

// ------------------------------------------------------------------
// BGM(シーン全体に流すので数秒のループに耐える簡易メロディ)
// ------------------------------------------------------------------

// アルペジオ 1 サイクルをエンベロープ付きで鳴らす
function arpeggio(
  ctx: OfflineAudioContext,
  notes: number[],
  startAt: number,
  step: number,
  type: OscillatorType,
  peakGain: number,
) {
  notes.forEach((f, i) => {
    const t = startAt + i * step
    blip(ctx, type, f, f, step * 0.95, peakGain, 0.01, t)
  })
}

// 柔らかいパッド(持続音 + LFO 的な揺らぎ)
function pad(
  ctx: OfflineAudioContext,
  freq: number,
  startAt: number,
  duration: number,
  peakGain: number,
) {
  const osc = ctx.createOscillator()
  osc.type = 'triangle'
  osc.frequency.value = freq
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, startAt)
  gain.gain.linearRampToValueAtTime(peakGain, startAt + 0.6)
  gain.gain.linearRampToValueAtTime(peakGain * 0.9, startAt + duration - 0.6)
  gain.gain.linearRampToValueAtTime(0, startAt + duration)
  osc.connect(gain).connect(ctx.destination)
  osc.start(startAt)
  osc.stop(startAt + duration)
}

async function makeBGM_Honobono(): Promise<SampleClip> {
  // C メジャー・アルペジオ(ほのぼの)
  const duration = 8
  const ctx = OfflineCtx(duration)
  const step = 0.25
  const C4 = 261.63
  const E4 = 329.63
  const G4 = 392.0
  const C5 = 523.25
  const A4 = 440.0
  const D5 = 587.33
  const pattern = [C4, E4, G4, C5, E4, G4, C5, E4]
  const pattern2 = [A4, C5, E4, A4, D5, A4, C5, E4]
  for (let bar = 0; bar < 4; bar++) {
    const t0 = bar * 2
    const p = bar % 2 === 0 ? pattern : pattern2
    arpeggio(ctx, p, t0, step, 'triangle', 0.22)
  }
  pad(ctx, C4 / 2, 0, 8, 0.18)
  const buf = await render(ctx)
  return { name: 'ほのぼの(仮)', blob: audioBufferToWavBlob(buf), duration }
}

async function makeBGM_Genki(): Promise<SampleClip> {
  // 5音階ベースの元気な感じ
  const duration = 8
  const ctx = OfflineCtx(duration)
  const step = 0.2
  const scale = [523.25, 587.33, 659.25, 783.99, 880.0] // C D E G A
  const notes: number[] = []
  let idx = 0
  for (let i = 0; i < Math.floor(duration / step); i++) {
    notes.push(scale[idx])
    idx = (idx + (Math.random() > 0.4 ? 1 : -1) + scale.length) % scale.length
  }
  arpeggio(ctx, notes, 0, step, 'square', 0.15)
  // ベース(4拍ごと)
  for (let t = 0; t < duration; t += 1.0) {
    blip(ctx, 'sine', 130.81, 130.81, 0.2, 0.3, 0.005, t)
  }
  const buf = await render(ctx)
  return { name: '元気(仮)', blob: audioBufferToWavBlob(buf), duration }
}

async function makeBGM_Tension(): Promise<SampleClip> {
  // 不協和ドローン(緊張感)
  const duration = 8
  const ctx = OfflineCtx(duration)
  pad(ctx, 110, 0, duration, 0.25)
  pad(ctx, 116.54, 0, duration, 0.18) // A2 + Bb2
  // 時々高音が入る
  for (let t = 0.5; t < duration; t += 1.2) {
    blip(ctx, 'sine', 1760, 1760, 0.15, 0.12, 0.01, t)
  }
  const buf = await render(ctx)
  return { name: '緊張(仮)', blob: audioBufferToWavBlob(buf), duration }
}

async function makeBGM_Calm(): Promise<SampleClip> {
  // ゆったりパッドのみ
  const duration = 10
  const ctx = OfflineCtx(duration)
  pad(ctx, 261.63, 0, duration, 0.2) // C4
  pad(ctx, 329.63, 0, duration, 0.16) // E4
  pad(ctx, 392.0, 0, duration, 0.14) // G4
  const buf = await render(ctx)
  return { name: '静かに(仮)', blob: audioBufferToWavBlob(buf), duration }
}

export async function generateSampleBgmTracks(): Promise<SampleClip[]> {
  return Promise.all([
    makeBGM_Honobono(),
    makeBGM_Genki(),
    makeBGM_Tension(),
    makeBGM_Calm(),
  ])
}
