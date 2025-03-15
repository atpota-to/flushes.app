import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { ThemeProvider } from '@/lib/theme-context';
import ClientOnly from '@/components/ClientOnly';
import NavigationBar from '@/components/NavigationBar';
import { Analytics } from "@vercel/analytics/react"

// Configure this layout as having dynamic runtime to fix SSR issues with theme
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Flushes",
  description: 'The world\'s first decentralized social media app for sharing the most universal human experience. Post your flushes and connect with other bathroom enjoyers.',
  // Add the custom shortcut-version meta tag
  other: {
    'shortcut-version': '1.0',
  },
  openGraph: {
    title: 'Flushes',
    description: 'The world\'s first decentralized social media app for sharing the most universal human experience. Post your flushes and connect with other bathroom enjoyers.',
    url: 'https://flushes.app',
    siteName: 'Flushes',
    images: [
      {
        url: 'https://flushes.app/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Flushes',
      }
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Flushes',
    description: 'The world\'s first decentralized social media app for sharing the most universal human experience. Post your flushes and connect with other bathroom enjoyers.',
    images: ['https://flushes.app/og-image.png'],
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <ThemeProvider>
            <header>
              <ClientOnly>
                <NavigationBar />
              </ClientOnly>
            </header>
            <main>{children}</main>
          </ThemeProvider>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}