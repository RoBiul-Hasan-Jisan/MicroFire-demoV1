import type { Metadata } from "next";
import { Archivo, Fredoka, Lexend } from "next/font/google";
import Link from "next/link";
import { connection } from "next/server";
import { Nav } from "@/components/Nav";
import { ExplorerProvider } from "@/components/guide/EmberGuide";
import "./globals.css";
import "./explorer-ui.css";

const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], axes: ["wdth"] }); // data tables and numbers
const fredoka = Fredoka({ variable: "--font-fredoka", subsets: ["latin"], axes: ["wdth"] }); // friendly headings
const lexend = Lexend({ variable: "--font-lexend", subsets: ["latin"] }); // easy-reading body text

export const metadata: Metadata = {
  metadataBase: new URL("https://microfire-atlas.vercel.app"), // absolute URLs for the share image
  title: { default: "MicroFire Atlas", template: "%s · MicroFire Atlas" },
  description:
    "Explore NASA microgravity fire experiments test by test: find the evidence closest to a mission scenario, compare outcomes, and see where the data stops.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Render per request so each page gets a fresh CSP nonce (see proxy.ts).
  await connection();
  return (
    <html lang="en" className={`${archivo.variable} ${fredoka.variable} ${lexend.variable} antialiased`}>
      <body className="min-h-screen flex flex-col">
        <ExplorerProvider>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 bg-panel px-3 py-2">
          Skip to content
        </a>
        <header className="site-header">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 h-14 flex items-center justify-between gap-6">
            <Link href="/" className="flex items-center gap-2.5 shrink-0" aria-label="MicroFire Atlas home">
              <Mark />
              <span className="display text-[15px] tracking-tight">MicroFire Atlas</span>
            </Link>
            <Nav />
          </div>
        </header>
        <main id="main" className="flex-1">
          {children}
        </main>
        <footer className="site-footer mt-24">
          <div className="footer-invitation mx-auto max-w-7xl px-4 sm:px-6"><div><p className="display text-2xl">Keep asking. Keep exploring.</p><p className="text-muted text-sm mt-2">Every discovery starts with a good question.</p></div><Link href="/ask" className="story-cta">Ask the evidence</Link></div>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 text-sm text-muted grid gap-3 sm:grid-cols-2">
            <p>
              Built from public NASA technical reports. Not affiliated with or endorsed by NASA. Scores on this site
              are project heuristics, not NASA ratings or fire-safety certification.
            </p>
            <p className="sm:text-right">
              <Link className="link" href="/methodology">
                How it works
              </Link>
              <span className="mx-3 text-faint">/</span>
              <Link className="link" href="/sources">
                Sources
              </Link>
              <span className="mx-3 text-faint">/</span>
              <Link className="link" href="/tour">
                90-second tour
              </Link>
            </p>
          </div>
        </footer>
        </ExplorerProvider>
      </body>
    </html>
  );
}

/** A blue near-limit flame over an amber one: the site's two main outcomes. */
function Mark() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <circle cx="11" cy="11" r="10" fill="none" stroke="var(--rule-strong)" />
      <path d="M11 4c3 4 5 6 5 9a5 5 0 0 1-10 0c0-3 2-5 5-9z" fill="var(--flame)" opacity=".9" />
      <ellipse cx="11" cy="14" rx="2.4" ry="3" fill="var(--quench)" />
    </svg>
  );
}
