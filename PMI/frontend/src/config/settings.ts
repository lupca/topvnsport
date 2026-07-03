const getBaseUrl = () => {
  if (typeof window !== "undefined") {
    return "/pmi-api";
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:18100";
};

export const APP_SETTINGS = {
  appName: "TOP VN SPORT",
  appVersion: "1.2.0",
  appShortName: "TVS",
  appSubtitle: "PIM System",
  
  api: {
    baseUrl: getBaseUrl(),
  },
  
  pagination: {
    defaultLimit: 10,
    options: [10, 20, 50],
  }
};
