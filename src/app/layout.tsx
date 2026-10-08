import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "Blood Mithra — India's Community Blood Donor Network",
    template: "%s | Blood Mithra",
  },
  description:
    "Blood Mithra connects voluntary blood donors with patients, hospitals and blood banks. Find donors by blood group and location, register as a donor, and respond to emergency blood requests.",
  keywords: [
    "blood donor", "blood bank", "blood request", "emergency blood", "donate blood",
    "blood donation camp", "volunteer", "India", "Blood Mithra",
  ],
  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: "Blood Mithra",
    title: "Blood Mithra — Every Drop Counts",
    description:
      "Find blood donors near you, become a donor, and respond to emergency requests. A community-powered donor network.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Blood Mithra" }],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Navbar />
        {children}
        <Footer />
      </body>
    </html>
  );
}
