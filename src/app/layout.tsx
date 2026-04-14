/**
 * OWNER: Person 4 (Voice/UI)
 * PURPOSE: Root layout with Clerk provider and dark theme
 * DEPENDENCIES: @clerk/nextjs, globals.css
 * STATUS: Ready to use
 */

import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import { Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Alter — Portable AI identity',
  description:
    'Alter extracts who you are from your digital footprint and keeps a persistent, local-first personality profile — so AI acts in your voice across models. Every AI tool knows what to do. Alter knows who you are.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} min-h-screen bg-nightshift-bg font-sans text-nightshift-text-primary antialiased`}
      >
        <ClerkProvider
          appearance={{
            baseTheme: dark,
            variables: {
              colorPrimary: '#2563EB',
              colorBackground: '#0A0F1C',
              colorText: '#F3F4F6',
            },
          }}
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
