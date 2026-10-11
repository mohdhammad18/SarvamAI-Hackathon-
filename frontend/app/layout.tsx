import type { Metadata } from "next";
import { Baloo_2 } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { TutorProvider } from "@/lib/tutor";

const baloo = Baloo_2({ variable: "--font-baloo", subsets: ["latin", "devanagari"], weight: ["400", "500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: "BoloBuddy — AI Reading Fluency Coach",
  description: "A friendly AI reading tutor powered by Sarvam AI that listens, guides and celebrates every reader.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${baloo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <TutorProvider>
          <Nav />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
        </TutorProvider>
      </body>
    </html>
  );
}
