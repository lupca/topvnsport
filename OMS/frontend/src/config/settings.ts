const getBaseUrl = () => {
  return process.env.NEXT_PUBLIC_OMS_API_URL || "http://localhost:18101";
};

export const APP_SETTINGS = {
  appName: "TOP VN SPORT OMS",
  appVersion: "1.2.0",
  appShortName: "OMS",
  appSubtitle: "Order Management",
  
  api: {
    baseUrl: getBaseUrl(),
  },
  
  pagination: {
    defaultLimit: 10,
    options: [10, 20, 50],
  }
};
