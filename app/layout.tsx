import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { ToastProvider } from '@/components/toast'
import { AppErrorBoundary } from '@/components/error-boundary'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: 'アニメ制作支援ツール',
    template: '%s - アニメ制作支援ツール',
  },
  description: 'ブラウザで完結するアニメ制作ワークフロー。キャラ・音声・シーン・BGM・SE を統合管理し、動画まで書き出せます。',
  applicationName: 'AnimeStudio',
  manifest: '/manifest.webmanifest',
  themeColor: '#0b0b0b',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'AnimeStudio',
  },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja" className="dark bg-background">
      <body className="font-sans antialiased">
        <AppErrorBoundary>
          <ToastProvider>{children}</ToastProvider>
        </AppErrorBoundary>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
