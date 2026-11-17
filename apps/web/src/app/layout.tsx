import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { NavigationModeProvider } from "@/context/NavigationModeContext";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MarinOS — Sistema Operativo Náutico y Gestión de Flota",
  description:
    "PWA Offline-First para veleros, catamaranes y flotas de chárter: Bridge GPS, Gemelo Digital, Zarpe OCR, Handover Wizard SHA-256 y Bitácora con Replay.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased">
        <NavigationModeProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </NavigationModeProvider>
      </body>
    </html>
  );
}
