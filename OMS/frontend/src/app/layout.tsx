import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-plus-jakarta-sans",
});

export const metadata: Metadata = {
  title: "TOP VN SPORT OMS - Order Management System",
  description: "Order Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={plusJakartaSans.variable}>
      <head>
        <style dangerouslySetInnerHTML={{__html: `
          body {
            font-family: var(--font-plus-jakarta-sans), sans-serif;
          }
        `}} />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
