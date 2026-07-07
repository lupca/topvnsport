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
      <head />
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

