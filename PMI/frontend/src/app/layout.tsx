import type { Metadata } from "next";
import "./globals.css";
import { APP_SETTINGS } from "@/config/settings";
import DashboardLayout from "@/components/layout/DashboardLayout";
import SystemPopupProvider from "@/components/ui/SystemPopupProvider";

export const metadata: Metadata = {
  title: `${APP_SETTINGS.appName} - Product Management`,
  description: "Advanced Product Information Management System with Shopee-like variant options.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
        <style dangerouslySetInnerHTML={{__html: `
          body {
            font-family: 'Plus Jakarta Sans', sans-serif;
          }
        `}} />
      </head>
      <body>
        <SystemPopupProvider>
          <DashboardLayout>
            {children}
          </DashboardLayout>
        </SystemPopupProvider>
      </body>
    </html>
  );
}

