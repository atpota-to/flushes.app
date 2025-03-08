import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';

export const metadata: Metadata = {
  title: "im.flushing",
  description: 'The world\'s first decentralized social media app for sharing when you\'re on the toilet. Connect with other bathroom enjoyers all over the world by posting "flushes"!',
  openGraph: {
    title: 'im.flushing',
    description: 'The world\'s first decentralized bathroom status network. Post your flushes and connect with other bathroom enjoyers.',
    url: 'https://flushing.im',
    siteName: 'im.flushing',
    images: [
      {
        url: 'https://flushing.im/og-image.png',
        width: 1200,
        height: 630,
        alt: 'im.flushing',
      }
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'im.flushing',
    description: 'The world\'s first decentralized bathroom status network. Post your flushes and connect with other bathroom enjoyers.',
    images: ['https://flushing.im/og-image.png'],
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
          <main>{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}