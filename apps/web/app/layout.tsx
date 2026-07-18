import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "ValueLoop · Customer Value Intelligence";
  const description = "Detect value loss, explain likely causes, and guide the safest next-best action.";
  return {
    title,
    description,
    openGraph: { title, description, type: "website", images: [{ url: `${origin}/og.png`, width: 1664, height: 936, alt: "ValueLoop customer value intelligence dashboard" }] },
    twitter: { card: "summary_large_image", title, description, images: [`${origin}/og.png`] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-scroll-behavior="smooth"><body className={geist.variable}>{children}</body></html>;
}
