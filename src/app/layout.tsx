import type { Metadata } from 'next'
import {
  Inter,
  Roboto_Mono,
  Press_Start_2P,
  Orbitron,
  Bangers,
  Creepster,
  Permanent_Marker,
  Bebas_Neue,
  Russo_One,
  VT323,
  Pixelify_Sans,
  Silkscreen,
} from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { CanvasProvider } from '@/contexts/CanvasContext'
import { ContentProvider } from '@/contexts/ContentContext'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const robotoMono = Roboto_Mono({ subsets: ['latin'], variable: '--font-roboto-mono' })
const pressStart2P = Press_Start_2P({ weight: '400', subsets: ['latin'], variable: '--font-press-start' })
const orbitron = Orbitron({ subsets: ['latin'], variable: '--font-orbitron' })
const bangers = Bangers({ weight: '400', subsets: ['latin'], variable: '--font-bangers' })
const creepster = Creepster({ weight: '400', subsets: ['latin'], variable: '--font-creepster' })
const permanentMarker = Permanent_Marker({ weight: '400', subsets: ['latin'], variable: '--font-permanent-marker' })
const bebasNeue = Bebas_Neue({ weight: '400', subsets: ['latin'], variable: '--font-bebas-neue' })
const russoOne = Russo_One({ weight: '400', subsets: ['latin'], variable: '--font-russo-one' })
const vt323 = VT323({ weight: '400', subsets: ['latin'], variable: '--font-vt323' })
const pixelifySans = Pixelify_Sans({ subsets: ['latin'], variable: '--font-pixelify-sans' })
const silkscreen = Silkscreen({ weight: '400', subsets: ['latin'], variable: '--font-silkscreen' })

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
      <body className={`${inter.variable} ${robotoMono.variable} ${pressStart2P.variable} ${orbitron.variable} ${bangers.variable} ${creepster.variable} ${permanentMarker.variable} ${bebasNeue.variable} ${russoOne.variable} ${vt323.variable} ${pixelifySans.variable} ${silkscreen.variable} font-sans`}>
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
