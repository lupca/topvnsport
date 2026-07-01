const getBaseUrl = () => {
  if (typeof window !== "undefined") {
    return `http://${window.location.hostname}:8001`;
  }
  return process.env.NEXT_PUBLIC_OMS_API_URL || "http://localhost:8001";
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
