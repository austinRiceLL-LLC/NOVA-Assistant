import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./atlas.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const imageUrl = `${protocol}://${host}/favicon.svg`;

  return {
    title: "Atlas — Your intelligent workspace",
    description: "A calm AI command center for your inbox, calendar, files, and work apps.",
    manifest: "/manifest.webmanifest",
    themeColor: "#0c0f14",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      title: "Atlas — A little less noise. A lot more clarity.",
      description: "One intelligent command center for email, calendar, files, and work apps.",
      images: [{ url: imageUrl, width: 40, height: 40, alt: "Atlas intelligent workspace" }],
    },
    twitter: { card: "summary", images: [imageUrl] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;
}
