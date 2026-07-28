import type { Metadata } from "next";
import "./globals.css";
import { APP_SETTINGS } from "@/config/settings";
import AppShell from "@/components/AppShell";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { SystemPopupProvider } from "@topvnsport/ui-kit";

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
        <PageErrorBoundary>
          <SystemPopupProvider>
            <AppShell>
              {children}
            </AppShell>
          </SystemPopupProvider>
        </PageErrorBoundary>
      </body>
    </html>
  );
}
