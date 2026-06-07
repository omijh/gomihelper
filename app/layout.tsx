import React from 'react';
import './globals.css';

export const metadata = {
  title: 'GomiHelper',
  description: 'Trash day & bulky-item fee lookups for Tokyo wards',
  icons: { icon: '/raccoon-favicon.svg' },
  manifest: '/manifest.json',
  other: { 'theme-color': '#5b6ef5' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
