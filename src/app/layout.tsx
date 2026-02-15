import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: 'TopicOS - Search-First Productivity',
  description: 'AI-powered topic-centric productivity platform. Organize your work across Gmail, Slack, Notion, Calendar, and Drive.',
  keywords: ['productivity', 'AI', 'topic management', 'search', 'organization'],
  openGraph: {
    title: 'TopicOS - Search-First Productivity',
    description: 'AI-powered topic-centric productivity. Unify your Gmail, Slack, Notion, Calendar, and Drive.',
    type: 'website',
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
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
