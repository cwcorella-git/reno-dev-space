import type { Metadata } from 'next'
import {
  Inter,
  JetBrains_Mono,
  Exo_2,
  Anton,
  Oswald,
  Space_Grotesk,
  Playfair_Display,
  Lora,
  Quicksand,
  Caveat,
  Orbitron,
  Bebas_Neue,
} from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { CanvasProvider } from '@/contexts/CanvasContext'
import { ContentProvider } from '@/contexts/ContentContext'
import { EffectsProvider } from '@/contexts/EffectsContext'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' })
const exo2 = Exo_2({ subsets: ['latin'], variable: '--font-exo-2' })
const anton = Anton({ weight: '400', subsets: ['latin'], variable: '--font-anton' })
const oswald = Oswald({ subsets: ['latin'], variable: '--font-oswald' })
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' })
const playfairDisplay = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' })
const lora = Lora({ subsets: ['latin'], variable: '--font-lora' })
const quicksand = Quicksand({ subsets: ['latin'], variable: '--font-quicksand' })
const caveat = Caveat({ subsets: ['latin'], variable: '--font-caveat' })
const orbitron = Orbitron({ subsets: ['latin'], variable: '--font-orbitron' })
const bebasNeue = Bebas_Neue({ weight: '400', subsets: ['latin'], variable: '--font-bebas-neue' })

export const metadata: Metadata = {
  title: 'Reno Dev Space - Local Game Developers',
  description: 'Local game developers in Reno. Build together, keep what you make.',
  icons: {
    icon: [
      { url: '/reno-dev-space/favicon.svg', type: 'image/svg+xml' },
      { url: '/reno-dev-space/favicon.ico', sizes: '32x32' },
    ],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${jetbrainsMono.variable} ${exo2.variable} ${anton.variable} ${oswald.variable} ${spaceGrotesk.variable} ${playfairDisplay.variable} ${lora.variable} ${quicksand.variable} ${caveat.variable} ${orbitron.variable} ${bebasNeue.variable} font-sans`}>
        <AuthProvider>
          <ContentProvider>
            <CanvasProvider>
              <EffectsProvider>
                {children}
              </EffectsProvider>
            </CanvasProvider>
          </ContentProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
