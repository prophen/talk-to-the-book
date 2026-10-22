import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Talk to the Book",
  description:
    "Dictate a memory. Gemma running locally cleans it into a draft and files it into your book. ElevenLabs reads it back.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
