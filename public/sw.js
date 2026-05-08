// アニメ制作支援ツールの Service Worker。
// 目的: 2 回目以降の起動をオフラインでも動くようにする(アプリ本体のシェルをキャッシュ)。
// データ本体は IndexedDB に入っているので、シェル(HTML/JS/CSS/画像)さえキャッシュすれば完全にオフライン可。
//
// 戦略:
//   - ナビゲーション(HTML): network-first, フォールバックでキャッシュ → それでもダメなら /offline
//   - 静的アセット(_next/static, /icons, /placeholder 等): stale-while-revalidate
//   - それ以外(blob:, data:, chrome-extension:): パススルー
//
// バージョンを上げるたびに古いキャッシュは自動削除される。

const CACHE_VERSION = 'v1'
const CACHE_NAME = `anime-app-${CACHE_VERSION}`
const OFFLINE_URLS = ['/', '/characters', '/environment', '/storyboard']

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME)
      // 主要ルートはプリキャッシュ(失敗しても致命ではないので catch)
      await Promise.all(
        OFFLINE_URLS.map((u) =>
          cache.add(u).catch((e) => console.warn('[sw] precache miss', u, e)),
        ),
      )
      // すぐ activate させる(古い SW を待たない)
      self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // 旧バージョンのキャッシュを掃除
      const names = await caches.keys()
      await Promise.all(
        names
          .filter((n) => n.startsWith('anime-app-') && n !== CACHE_NAME)
          .map((n) => caches.delete(n)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)

  // GET 以外はパススルー(POST 等は cache しない)
  if (req.method !== 'GET') return
  // 同一オリジン以外はパススルー(外部CDN等はブラウザ側のHTTPキャッシュに任せる)
  if (url.origin !== self.location.origin) return
  // Next.js API / _next/data など動的なルートはネットワーク優先(キャッシュしても壊れがち)
  if (url.pathname.startsWith('/api/')) return

  // HTML ナビゲーション
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req)
          const cache = await caches.open(CACHE_NAME)
          cache.put(req, fresh.clone())
          return fresh
        } catch {
          const cache = await caches.open(CACHE_NAME)
          const cached = await cache.match(req)
          return cached ?? (await cache.match('/')) ?? new Response('Offline', { status: 503 })
        }
      })(),
    )
    return
  }

  // 静的アセット: stale-while-revalidate
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME)
      const cached = await cache.match(req)
      const fetchPromise = fetch(req)
        .then((resp) => {
          // Next.js の静的ファイルのみキャッシュ(/_next/, 画像, アイコン等)
          if (
            resp &&
            resp.status === 200 &&
            (url.pathname.startsWith('/_next/') ||
              url.pathname.startsWith('/icon') ||
              url.pathname.endsWith('.svg') ||
              url.pathname.endsWith('.png') ||
              url.pathname.endsWith('.jpg') ||
              url.pathname.endsWith('.webmanifest'))
          ) {
            cache.put(req, resp.clone())
          }
          return resp
        })
        .catch(() => cached)
      return cached ?? fetchPromise
    })(),
  )
})
