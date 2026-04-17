// ffmpeg.wasm を遅延ロードして WebM → mp4 変換を行う。
// 初回は ~30MB のコアを CDN からダウンロード(以降ブラウザキャッシュ)。
// シングルスレッド版を使うので COOP/COEP ヘッダ不要。

// 型は dynamic import 時に取得するため、簡易 interface だけ用意
interface FFmpegInstance {
  load: (opts: { coreURL: string; wasmURL: string }) => Promise<boolean>
  writeFile: (name: string, data: Uint8Array) => Promise<boolean>
  readFile: (name: string) => Promise<Uint8Array | string>
  exec: (args: string[]) => Promise<number>
  on: (event: 'progress' | 'log', handler: (...args: unknown[]) => void) => void
  off: (event: 'progress' | 'log', handler: (...args: unknown[]) => void) => void
  terminate: () => void
}

let cached: FFmpegInstance | null = null
let loading: Promise<FFmpegInstance> | null = null

// シングルスレッド版 core(SharedArrayBuffer 不要)
const CORE_BASE_URL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'

export async function loadFfmpeg(
  onLoadProgress?: (kind: 'core-js' | 'core-wasm', loaded: number, total: number) => void,
): Promise<FFmpegInstance> {
  if (cached) return cached
  if (loading) return loading

  loading = (async () => {
    const [{ FFmpeg }, util] = await Promise.all([
      import('@ffmpeg/ffmpeg'),
      import('@ffmpeg/util'),
    ])
    const ff = new FFmpeg() as unknown as FFmpegInstance

    // toBlobURL は内部で fetch するが progress は取れないので、
    // 手動で fetch してプログレスを返す関数を用意する
    async function fetchAsBlobUrl(url: string, mime: string, kind: 'core-js' | 'core-wasm') {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`ffmpeg core の取得失敗: ${url}`)
      const contentLength = Number(res.headers.get('Content-Length')) || 0
      const reader = res.body?.getReader()
      if (!reader) return util.toBlobURL(url, mime)
      const chunks: Uint8Array[] = []
      let loaded = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) {
          chunks.push(value)
          loaded += value.length
          onLoadProgress?.(kind, loaded, contentLength)
        }
      }
      const blob = new Blob(chunks as BlobPart[], { type: mime })
      return URL.createObjectURL(blob)
    }

    const coreURL = await fetchAsBlobUrl(
      `${CORE_BASE_URL}/ffmpeg-core.js`,
      'text/javascript',
      'core-js',
    )
    const wasmURL = await fetchAsBlobUrl(
      `${CORE_BASE_URL}/ffmpeg-core.wasm`,
      'application/wasm',
      'core-wasm',
    )
    await ff.load({ coreURL, wasmURL })

    cached = ff
    return ff
  })()
    .catch((e) => {
      loading = null
      throw e
    })

  return loading
}

export async function convertWebmToMp4(
  webmBlob: Blob,
  onProgress?: (ratio: number) => void,
): Promise<Blob> {
  const util = await import('@ffmpeg/util')
  const ff = await loadFfmpeg()

  const progressHandler = (...args: unknown[]) => {
    const first = args[0] as { progress?: number } | number | undefined
    let ratio = 0
    if (typeof first === 'number') {
      ratio = first
    } else if (first && typeof first === 'object' && typeof first.progress === 'number') {
      ratio = first.progress
    }
    if (onProgress) onProgress(Math.max(0, Math.min(1, ratio)))
  }

  if (onProgress) ff.on('progress', progressHandler)

  try {
    await ff.writeFile('input.webm', await util.fetchFile(webmBlob))
    // H.264 + AAC、投稿互換重視(yuv420p、+faststart)、速さ寄り(preset=fast, crf=23)
    await ff.exec([
      '-i',
      'input.webm',
      '-c:v',
      'libx264',
      '-preset',
      'fast',
      '-crf',
      '23',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-movflags',
      '+faststart',
      'output.mp4',
    ])
    const data = (await ff.readFile('output.mp4')) as Uint8Array
    return new Blob([data.buffer as ArrayBuffer], { type: 'video/mp4' })
  } finally {
    if (onProgress) ff.off('progress', progressHandler)
  }
}
