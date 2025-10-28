import React from 'react';

export const metadata = {
  title: 'GomiHelper',
  description: 'Trash day & bulky-item fee lookups (Japan)',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{fontFamily:'system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, Helvetica, Arial, sans-serif'}}>
        {children}
      </body>
    </html>
  );
}