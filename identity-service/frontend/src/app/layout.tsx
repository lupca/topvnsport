import type { Metadata } from "next";
import "./globals.css";
import { APP_SETTINGS } from "@/config/settings";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata: Metadata = {
  title: `${APP_SETTINGS.appName} - ${APP_SETTINGS.appSubtitle}`,
  description: "Centralized Single Sign-On (SSO) Identity Service for TOP VN SPORT.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <head />
      <body>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
