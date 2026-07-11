import React from "react";

export default function DesktopLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="min-h-full bg-transparent">{children}</div>;
}
