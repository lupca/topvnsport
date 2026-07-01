const getBaseUrl = () => {
  if (typeof window !== "undefined") {
    return `http://${window.location.hostname}:18102`;
  }
  return process.env.NEXT_PUBLIC_WMS_API_URL || "http://localhost:18102";
};

export const APP_SETTINGS = {
  appName: "TOP VN SPORT WMS",
  appVersion: "1.2.0",
  appShortName: "WMS",
  appSubtitle: "Warehouse Management",
  
  api: {
    baseUrl: getBaseUrl(),
  },
  
  pagination: {
    defaultLimit: 10,
    options: [10, 20, 50],
  }
};
