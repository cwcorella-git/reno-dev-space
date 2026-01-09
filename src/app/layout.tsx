import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { CanvasProvider } from '@/contexts/CanvasContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Reno Dev Space - Game Developer Collective',
  description: 'A non-profit, horizontal game developer collective in Reno. Create together, keep what you make.',
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
          <CanvasProvider>
            {children}
          </CanvasProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
