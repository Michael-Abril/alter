/**
 * OWNER: Person 4 (Voice/UI)
 * PURPOSE: Root layout with Clerk provider and dark theme
 * DEPENDENCIES: @clerk/nextjs, globals.css
 * STATUS: Ready to use
 */

import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import './globals.css';

export const metadata: Metadata = {
  title: 'NightShift AI — Work While You Sleep',
  description:
    'NightShift AI learns how you work, then continues your work while you sleep. Wake up to finished drafts, sent emails, and completed tasks.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-nightshift-bg text-nightshift-text-primary antialiased">
        <ClerkProvider
          appearance={{
            baseTheme: dark,
            variables: {
              colorPrimary: '#E94560',
              colorBackground: '#0A0A12',
              colorText: '#E8E8F0',
            },
          }}
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
