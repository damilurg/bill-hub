import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Bill Hub · Показания',
  description: 'Вода, тепло, газ и свет — показания и история в одном месте.',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="antialiased">{children}</body>
    </html>
  );
}
