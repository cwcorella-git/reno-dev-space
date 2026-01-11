import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { CanvasProvider } from '@/contexts/CanvasContext'
import { ContentProvider } from '@/contexts/ContentContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Reno Dev Space - Local Game Developers',
  description: 'Local game developers in Reno. Build together, keep what you make.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <ContentProvider>
            <CanvasProvider>
              {children}
            </CanvasProvider>
          </ContentProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
