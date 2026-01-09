import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Job Application Agent',
  description: 'v0 - Job application automation assistant',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
