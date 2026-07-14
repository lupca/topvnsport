const getBaseUrl = () => {
  if (typeof window !== "undefined") {
    return "/identity-api";
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:18110";
};

export const APP_SETTINGS = {
  appName: "TOP VN SPORT",
  appVersion: "1.0.0",
  appShortName: "TVS",
  appSubtitle: "Identity Management",
  
  api: {
    baseUrl: getBaseUrl(),
  },
  
  pagination: {
    defaultLimit: 10,
    options: [10, 20, 50],
  }
};
