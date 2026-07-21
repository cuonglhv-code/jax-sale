import type { Metadata } from "next";
import { Montserrat, Sansita } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { ThemeScript } from "./ThemeScript";

export const metadata: Metadata = {
  title: "Jaxtina CRM",
  description: "Hệ thống CRM đa trung tâm Jaxtina",
};

// ALL Vietnamese text uses this face — verified full Vietnamese diacritic coverage. Never used for
// display-only strings that should carry the brand's Sansita treatment.
const montserrat = Montserrat({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-montserrat",
  display: "swap",
});

// ASCII-only brand wordmark (e.g. the sidebar "jax-sales" lockup) — never set Vietnamese text in
// this face, it has no verified diacritic coverage.
const sansita = Sansita({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-sansita",
  display: "swap",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className={`${montserrat.variable} ${sansita.variable}`}>
      <head>
        <ThemeScript />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
