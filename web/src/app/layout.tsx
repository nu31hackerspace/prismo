import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prismo — Open-Source Access Control for Hackerspaces",
  description:
    "Prismo is a simple, open-source NFC/RFID access control system for hackerspaces and makerspaces. Control doors and machines with easy-to-build hardware and free software.",
  icons: {
    icon: "/assets/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div style={{ display: "contents" }}>{children}</div>
      </body>
    </html>
  );
}
