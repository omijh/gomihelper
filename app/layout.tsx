import React from 'react';
import './globals.css';

export const metadata = {
  title: 'GomiHelper',
  description: 'Trash day & bulky-item fee lookups (Japan)',
  icons: {
    icon: '/raccoon-favicon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
