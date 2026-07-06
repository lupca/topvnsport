import React from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function DesktopLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <DashboardLayout><div className="min-h-full bg-transparent">{children}</div></DashboardLayout>;
}
