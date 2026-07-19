import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ilma's Route to Revenue",
  description: "AI-assisted opportunity prioritization"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
