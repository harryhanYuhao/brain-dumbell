import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeToggle } from "./components/ThemeToggle";
import { themeScript } from "./theme";
import { exercises } from "./exercises";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Brain Dumbell",
    template: "%s · Brain Dumbell",
  },
  description: "Short, focused exercises to train your brain.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        <header className="border-b border-border">
          <nav className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
            <Link
              href="/"
              className="flex items-center gap-2 whitespace-nowrap font-semibold"
            >
              <span
                aria-hidden
                className="grid size-8 place-items-center rounded-lg bg-accent text-sm text-white"
              >
                🧠
              </span>
              Brain Dumbell
            </Link>
            <div className="flex items-center gap-1">
              <ul className="hidden gap-1 whitespace-nowrap text-sm sm:flex">
                {exercises.map((exercise) => (
                  <li key={exercise.href}>
                    <Link
                      href={exercise.href}
                      className="rounded-md px-3 py-1.5 text-muted transition-colors hover:bg-accent-soft hover:text-foreground"
                    >
                      {exercise.name}
                    </Link>
                  </li>
                ))}
              </ul>
              <ThemeToggle />
            </div>
          </nav>
        </header>
        <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-10 sm:px-6">
          {children}
        </main>
        <footer className="border-t border-border py-6 text-center text-xs text-muted">
          Lift a little every day.
        </footer>
      </body>
    </html>
  );
}
