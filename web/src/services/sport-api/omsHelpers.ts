import { OMS_API_URL } from './constants';
import { OmsChannel, OmsPaginatedChannels } from './types';

export async function getChannels(search?: string): Promise<OmsChannel[]> {
  try {
    const query = search
      ? `?search=${encodeURIComponent(search)}&limit=100`
      : '?limit=100';

    const response = await fetch(`${OMS_API_URL}/channels${query}`);
    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as OmsPaginatedChannels;
    return data?.items || [];
  } catch {
    return [];
  }
}

export function findManualChannel(channels?: OmsChannel[] | null): OmsChannel | undefined {
  return (channels || []).find((channel) => channel?.is_active && channel?.code?.toUpperCase() === 'MANUAL');
}

export function findStorefrontChannel(channels?: OmsChannel[] | null): OmsChannel | undefined {
  return (channels || []).find((channel) => channel?.is_active && channel?.code?.toUpperCase() === 'STOREFRONT');
}

