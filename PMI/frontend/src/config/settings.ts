export const APP_SETTINGS = {
  appName: "TOP VN SPORT",
  appVersion: "1.2.0",
  appShortName: "TVS",
  appSubtitle: "PIM System",
  
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:18100",
  },
  
  pagination: {
    defaultLimit: 10,
    options: [10, 20, 50],
  }
};
