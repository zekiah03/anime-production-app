// プロジェクト一式(キャラ・表情・音声・セリフ・シーン・BGM・SE・設定)を
// 1つの zip としてエクスポート/インポートする。
// OneDrive/Dropbox 等の同期フォルダに置けば、2台の端末間で手動で共有できる。

import JSZip from 'jszip'
import { STORE_NAMES, clearStore, getAllRaw, putRaw, type StoreName } from '@/lib/db'

const SCHEMA_VERSION = 1

// 各ストアで Blob を持つフィールド
const BLOB_FIELDS: Partial<Record<StoreName, string[]>> = {
  characters: ['image_blob'],
  character_expressions: ['image_blob'],
  audio_files: ['file_blob'],
  layers: ['image_blob'],
  bgm_tracks: ['file_blob'],
  sound_effects: ['file_blob'],
}

// 実行時にだけ存在する derived フィールド。保存時に取り除く(blob URL は端末固有で意味がない)。
const EPHEMERAL_FIELDS = ['image_url', 'file_url']

export interface ExportManifest {
  app: 'anime-production-app'
  schema_version: number
  exported_at: string
  counts: Record<string, number>
  total_blobs: number
}

function stripEphemeral(obj: Record<string, unknown>) {
  for (const k of EPHEMERAL_FIELDS) delete obj[k]
}

export async function exportProject(): Promise<Blob> {
  const zip = new JSZip()
  const counts: Record<string, number> = {}
  let totalBlobs = 0

  for (const store of STORE_NAMES) {
    const records = (await getAllRaw(store)) as Record<string, unknown>[]
    counts[store] = records.length
    const blobKeys = BLOB_FIELDS[store] ?? []

    const serialized = records.map((rec, idx) => {
      const row: Record<string, unknown> = { ...rec }
      for (const key of blobKeys) {
        const value = row[key]
        if (value instanceof Blob) {
          const id = (row.id as string | undefined) ?? `row-${idx}`
          const path = `blobs/${store}/${id}`
          zip.file(path, value)
          row[key] = null
          row[`${key}__path`] = path
          totalBlobs++
        }
      }
      stripEphemeral(row)
      return row
    })

    zip.file(`data/${store}.json`, JSON.stringify(serialized, null, 2))
  }

  const manifest: ExportManifest = {
    app: 'anime-production-app',
    schema_version: SCHEMA_VERSION,
    exported_at: new Date().toISOString(),
    counts,
    total_blobs: totalBlobs,
  }
  zip.file('manifest.json', JSON.stringify(manifest, null, 2))

  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
}

export interface ImportResult {
  manifest: ExportManifest
  counts: Record<string, number>
}

export async function importProject(
  file: File | Blob,
  options: { clearExisting?: boolean } = { clearExisting: true },
): Promise<ImportResult> {
  const zip = await JSZip.loadAsync(file)

  const manifestFile = zip.file('manifest.json')
  if (!manifestFile) {
    throw new Error('manifest.json が見つかりません(正しいプロジェクト zip ではありません)')
  }
  const manifest = JSON.parse(await manifestFile.async('string')) as ExportManifest
  if (manifest.app !== 'anime-production-app') {
    throw new Error('このアプリのプロジェクト zip ではありません')
  }

  const counts: Record<string, number> = {}

  for (const store of STORE_NAMES) {
    const jsonFile = zip.file(`data/${store}.json`)
    if (!jsonFile) {
      counts[store] = 0
      continue
    }
    const records = JSON.parse(await jsonFile.async('string')) as Record<string, unknown>[]
    const blobKeys = BLOB_FIELDS[store] ?? []

    if (options.clearExisting) {
      await clearStore(store)
    }

    for (const rec of records) {
      const row: Record<string, unknown> = { ...rec }
      for (const key of blobKeys) {
        const pathKey = `${key}__path`
        const path = row[pathKey] as string | undefined
        if (path) {
          const blobFile = zip.file(path)
          if (blobFile) {
            row[key] = await blobFile.async('blob')
          } else {
            delete row[key]
          }
        }
        delete row[pathKey]
      }
      // エクスポート時に null にした URL は残ったままなので除去
      for (const k of EPHEMERAL_FIELDS) delete row[k]
      await putRaw(store, row)
    }
    counts[store] = records.length
  }

  return { manifest, counts }
}

// ダウンロード用ヘルパー(Blob を名前付きで保存)
export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

// ファイル名用のタイムスタンプ
export function makeExportFilename(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const mi = String(now.getMinutes()).padStart(2, '0')
  return `anime-project-${yyyy}${mm}${dd}-${hh}${mi}.zip`
}
