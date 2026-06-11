import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "R2BM | Cloudflare R2 Bucket Manager by only4.fun",
  description: "Upload, organize, and share your files on Cloudflare R2 storage. Fast image compression, public URLs, and secure credential management.",
  keywords: ["R2", "Cloudflare R2", "bucket manager", "image upload", "image compression", "R2 bucket", "only4fun"],
  authors: [{ name: "Ketut Dana", url: "https://github.com/dnysaz" }],
  openGraph: {
    title: "R2BM — Cloudflare R2 Bucket Manager",
    description: "Upload, organize, and share files on Cloudflare R2 storage with auto-compression.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
