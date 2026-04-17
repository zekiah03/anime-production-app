// canvas 2D で簡易な背景サンプル画像(PNG)を合成する。
// 権利フリー(生成物なので著作権発生しない)、オフラインで完結。

const WIDTH = 1920
const HEIGHT = 1080

function makeCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  return canvas
}

function toPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('canvas toBlob failed'))),
      'image/png',
    )
  })
}

async function drawSkyBlue(): Promise<Blob> {
  const canvas = makeCanvas()
  const ctx = canvas.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, 0, HEIGHT)
  g.addColorStop(0, '#4fc3f7')
  g.addColorStop(0.7, '#b3e5fc')
  g.addColorStop(1, '#e1f5fe')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  // 雲
  ctx.fillStyle = 'rgba(255, 255, 255, 0.72)'
  const clouds = [
    [0.15, 0.18, 180, 0.72],
    [0.4, 0.12, 220, 0.55],
    [0.72, 0.22, 160, 0.65],
    [0.88, 0.08, 130, 0.5],
  ] as const
  for (const [cx, cy, r, ry] of clouds) {
    ctx.beginPath()
    ctx.ellipse(cx * WIDTH, cy * HEIGHT, r, r * ry, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  return toPngBlob(canvas)
}

async function drawSunset(): Promise<Blob> {
  const canvas = makeCanvas()
  const ctx = canvas.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, 0, HEIGHT)
  g.addColorStop(0, '#311b92')
  g.addColorStop(0.4, '#ff6f00')
  g.addColorStop(0.75, '#ffca28')
  g.addColorStop(1, '#ff8a65')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  // 太陽(柔らかいハロー)
  const halo = ctx.createRadialGradient(WIDTH * 0.7, HEIGHT * 0.6, 30, WIDTH * 0.7, HEIGHT * 0.6, 260)
  halo.addColorStop(0, 'rgba(255, 250, 230, 1)')
  halo.addColorStop(0.5, 'rgba(255, 220, 160, 0.4)')
  halo.addColorStop(1, 'rgba(255, 220, 160, 0)')
  ctx.fillStyle = halo
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  return toPngBlob(canvas)
}

async function drawNightSky(): Promise<Blob> {
  const canvas = makeCanvas()
  const ctx = canvas.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, 0, HEIGHT)
  g.addColorStop(0, '#0d1b2a')
  g.addColorStop(0.7, '#1b263b')
  g.addColorStop(1, '#2d3a5a')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  // 星をランダム配置(seed 固定せず、実行ごとに少し変わる)
  for (let i = 0; i < 180; i++) {
    const x = Math.random() * WIDTH
    const y = Math.random() * HEIGHT * 0.85
    const r = Math.random() * 1.8 + 0.3
    const alpha = 0.45 + Math.random() * 0.55
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  // 月
  const moonG = ctx.createRadialGradient(WIDTH * 0.82, 200, 10, WIDTH * 0.82, 200, 110)
  moonG.addColorStop(0, 'rgba(240, 240, 220, 1)')
  moonG.addColorStop(0.6, 'rgba(240, 240, 220, 0.85)')
  moonG.addColorStop(1, 'rgba(240, 240, 220, 0)')
  ctx.fillStyle = moonG
  ctx.beginPath()
  ctx.arc(WIDTH * 0.82, 200, 110, 0, Math.PI * 2)
  ctx.fill()
  return toPngBlob(canvas)
}

async function drawForest(): Promise<Blob> {
  const canvas = makeCanvas()
  const ctx = canvas.getContext('2d')!
  // 空
  const skyG = ctx.createLinearGradient(0, 0, 0, HEIGHT * 0.6)
  skyG.addColorStop(0, '#a5d6a7')
  skyG.addColorStop(1, '#e8f5e9')
  ctx.fillStyle = skyG
  ctx.fillRect(0, 0, WIDTH, HEIGHT * 0.6)
  // 地面
  const groundG = ctx.createLinearGradient(0, HEIGHT * 0.6, 0, HEIGHT)
  groundG.addColorStop(0, '#66bb6a')
  groundG.addColorStop(1, '#1b5e20')
  ctx.fillStyle = groundG
  ctx.fillRect(0, HEIGHT * 0.6, WIDTH, HEIGHT * 0.4)
  // 遠景の木のシルエット(濃淡2段)
  function treeSilhouette(color: string, baseY: number, count: number, trunkH: number, leafR: number) {
    ctx.fillStyle = color
    for (let i = 0; i < count; i++) {
      const cx = (i + 0.5) * (WIDTH / count) + (Math.random() - 0.5) * 80
      ctx.fillRect(cx - 8, baseY, 16, trunkH)
      ctx.beginPath()
      ctx.arc(cx, baseY - 12, leafR, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  treeSilhouette('#2e7d32', HEIGHT * 0.62, 6, 160, 90)
  treeSilhouette('#1b5e20', HEIGHT * 0.7, 5, 180, 70)
  return toPngBlob(canvas)
}

async function drawRoom(): Promise<Blob> {
  const canvas = makeCanvas()
  const ctx = canvas.getContext('2d')!
  // 壁
  const wallG = ctx.createLinearGradient(0, 0, 0, HEIGHT * 0.78)
  wallG.addColorStop(0, '#ffe0b2')
  wallG.addColorStop(1, '#ffcc80')
  ctx.fillStyle = wallG
  ctx.fillRect(0, 0, WIDTH, HEIGHT * 0.78)
  // 床
  const floorG = ctx.createLinearGradient(0, HEIGHT * 0.78, 0, HEIGHT)
  floorG.addColorStop(0, '#8d6e63')
  floorG.addColorStop(1, '#4e342e')
  ctx.fillStyle = floorG
  ctx.fillRect(0, HEIGHT * 0.78, WIDTH, HEIGHT * 0.22)
  // 窓
  const winX = WIDTH * 0.58
  const winY = 120
  const winW = 460
  const winH = 340
  // 外の光
  const outsideG = ctx.createLinearGradient(0, winY, 0, winY + winH)
  outsideG.addColorStop(0, '#b3e5fc')
  outsideG.addColorStop(1, '#81d4fa')
  ctx.fillStyle = outsideG
  ctx.fillRect(winX, winY, winW, winH)
  // 枠
  ctx.strokeStyle = '#5d4037'
  ctx.lineWidth = 10
  ctx.strokeRect(winX, winY, winW, winH)
  ctx.beginPath()
  ctx.moveTo(winX + winW / 2, winY)
  ctx.lineTo(winX + winW / 2, winY + winH)
  ctx.moveTo(winX, winY + winH / 2)
  ctx.lineTo(winX + winW, winY + winH / 2)
  ctx.stroke()
  return toPngBlob(canvas)
}

async function drawClassroom(): Promise<Blob> {
  const canvas = makeCanvas()
  const ctx = canvas.getContext('2d')!
  // 壁
  ctx.fillStyle = '#fff59d'
  ctx.fillRect(0, 0, WIDTH, HEIGHT * 0.7)
  // 床
  const floorG = ctx.createLinearGradient(0, HEIGHT * 0.7, 0, HEIGHT)
  floorG.addColorStop(0, '#bcaaa4')
  floorG.addColorStop(1, '#8d6e63')
  ctx.fillStyle = floorG
  ctx.fillRect(0, HEIGHT * 0.7, WIDTH, HEIGHT * 0.3)
  // 黒板
  const boardX = WIDTH * 0.22
  const boardY = 120
  const boardW = WIDTH * 0.56
  const boardH = 300
  ctx.fillStyle = '#2e7d32'
  ctx.fillRect(boardX, boardY, boardW, boardH)
  ctx.strokeStyle = '#5d4037'
  ctx.lineWidth = 14
  ctx.strokeRect(boardX, boardY, boardW, boardH)
  // 教卓
  ctx.fillStyle = '#8d6e63'
  ctx.fillRect(WIDTH * 0.4, HEIGHT * 0.7 - 70, WIDTH * 0.2, 90)
  return toPngBlob(canvas)
}

async function drawSolid(color: string): Promise<Blob> {
  const canvas = makeCanvas()
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = color
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  return toPngBlob(canvas)
}

async function drawSpotlight(): Promise<Blob> {
  const canvas = makeCanvas()
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  const spot = ctx.createRadialGradient(WIDTH / 2, HEIGHT * 0.5, 40, WIDTH / 2, HEIGHT * 0.5, 700)
  spot.addColorStop(0, 'rgba(255, 240, 200, 0.95)')
  spot.addColorStop(0.4, 'rgba(255, 240, 200, 0.35)')
  spot.addColorStop(1, 'rgba(255, 240, 200, 0)')
  ctx.fillStyle = spot
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  return toPngBlob(canvas)
}

export interface SampleImage {
  name: string
  blob: Blob
}

export async function generateSampleIllustrations(): Promise<SampleImage[]> {
  const entries: Array<[string, () => Promise<Blob>]> = [
    ['青空', drawSkyBlue],
    ['夕焼け', drawSunset],
    ['夜空', drawNightSky],
    ['森', drawForest],
    ['部屋', drawRoom],
    ['教室', drawClassroom],
    ['ステージ(スポット)', drawSpotlight],
    ['黒背景', () => drawSolid('#0a0a0a')],
    ['白背景', () => drawSolid('#ffffff')],
  ]
  const results: SampleImage[] = []
  for (const [name, fn] of entries) {
    results.push({ name, blob: await fn() })
  }
  return results
}
