import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import "./dark.css";
import "./mobile.css";
import "./projects.css";
import "./login-onboarding.css";
import "./temp-admin-login.css";

const portalFont = Manrope({ subsets: ["latin"], display: "swap", variable: "--font-portal" });

export const metadata: Metadata = {
  title: "Take Me Team Portal",
  description: "The internal home for Take Me people, work and company knowledge.",
  icons: {
    icon: "/take-me-icon-192.png",
    shortcut: "/take-me-icon-192.png",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.webmanifest",
  applicationName: "Take Me Team Portal",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Take Me",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7fafb" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1115" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={portalFont.variable}>
      <body>
        {children}
      </body>
    </html>
  );
}
