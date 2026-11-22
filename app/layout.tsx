import type {Metadata, Viewport} from 'next';
import './globals.css';
import {Providers} from './providers';
import {APP_NAME, APP_TAGLINE} from '@/lib/config';

export const metadata: Metadata = {
  title: APP_NAME,
  description: `${APP_TAGLINE} Random jokes and private crowdwork with five comedy personas.`,
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({children}: LayoutProps<'/'>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Sticker theme fonts: Bowlby One SC (headings) and Sofia Sans (body) */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bowlby+One+SC&family=Sofia+Sans:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
