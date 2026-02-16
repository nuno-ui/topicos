import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'sonner';

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
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        {children}
        <Toaster
          position="top-right"
          richColors
          closeButton
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
