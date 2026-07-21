export const SIMULATED_LATENCY = 200;
export const PMI_API_URL = (import.meta as any).env?.VITE_PMI_API_URL || 'http://localhost:18100';
export const OMS_API_URL = (import.meta as any).env?.VITE_OMS_API_URL || 'http://localhost:18101';
export const WMS_API_URL = (import.meta as any).env?.VITE_WMS_API_URL || 'http://localhost:18102';
export const NO_IMAGE_URL = 'https://via.placeholder.com/300?text=No+Image';

export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
