import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "InterviewAI — Practice Smarter. Interview Better.",
  description:
    "A preview of InterviewAI: personalized technical interview practice, structured feedback, and a clearer path to improvement. Coming soon.",
};

const themeScript = `try{document.documentElement.dataset.theme=localStorage.getItem('interviewai-theme')==='light'?'light':'dark'}catch{document.documentElement.dataset.theme='dark'}`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body id="top" className={GeistSans.variable}>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
