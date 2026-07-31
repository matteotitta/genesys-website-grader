import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://website-grader.genesysgrowth.com"),
  title: "Genesys Website Grader | Find Positioning Gaps on Your B2B SaaS Website",
  description: "Get tailored and actionable positioning recommendations for your B2B SaaS website with Matteo's PM Score methodology refined over 10 years working with 45+ companies.",
  keywords: ["website grader", "B2B SaaS", "positioning", "PM Score", "website analysis", "competitive analysis", "messaging", "Genesys Growth"],
  authors: [{ name: "Matteo Tittarelli", url: "https://www.linkedin.com/in/matteo-titta/" }],
  creator: "Genesys Growth",
  publisher: "Genesys Growth",
  openGraph: {
    title: "Genesys Website Grader | Find Positioning Gaps on Your B2B SaaS Website",
    description: "Get tailored and actionable positioning recommendations for your B2B SaaS website with Matteo's PM Score methodology refined over 10 years working with 45+ companies.",
    url: "https://website-grader.genesysgrowth.com",
    siteName: "Genesys Website Grader",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Genesys Website Grader - Find positioning gaps on your B2B SaaS website",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Genesys Website Grader | Find Positioning Gaps on Your B2B SaaS Website",
    description: "Get tailored and actionable positioning recommendations for your B2B SaaS website with Matteo's PM Score methodology.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png" },
    ],
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://cdn.fontshare.com" crossOrigin="anonymous" />
        {/* General Sans (Indian Type Foundry, free on Fontshare) */}
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600,700&display=swap"
        />
      </head>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
