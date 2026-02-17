import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from 'sonner';
import { NetworkStatus } from '@/components/ui/network-status';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#3b82f6',
};

export const metadata: Metadata = {
  title: {
    template: '%s | YouOS',
    default: 'YouOS - Your AI-Powered Life OS',
  },
  description: 'Your AI-powered life operating system. One place for Gmail, Slack, Notion, Calendar, and Drive — while AI does the hard work, you focus on being human.',
  keywords: ['productivity', 'AI', 'life OS', 'search', 'organization', 'gmail', 'slack', 'notion'],
  openGraph: {
    title: 'YouOS - Your AI-Powered Life OS',
    description: 'Your AI-powered life operating system. One place for Gmail, Slack, Notion, Calendar, and Drive — while AI does the hard work, you focus on being human.',
    type: 'website',
    siteName: 'YouOS',
  },
  robots: {
    index: false,
    follow: false,
  },
  icons: {
    icon: '/icon',
  },
  other: {
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <meta name="color-scheme" content="light" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        <NetworkStatus />
        {children}
        <Toaster
          position="top-right"
          richColors
          closeButton
          visibleToasts={4}
          duration={4000}
          toastOptions={{
            style: {
              borderRadius: '12px',
              fontSize: '13px',
            },
            className: 'shadow-lg',
          }}
          gap={8}
        />
      </body>
    </html>
  );
}
