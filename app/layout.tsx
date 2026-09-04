import './globals.css';

export const metadata = {
  title: 'Price Action Lab',
  description: 'Objective market structure and liquidity analysis engine',
};

export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body>{children}</body></html>;
}
