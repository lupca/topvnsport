export function cleanOptionForSku(text: string): string {
  if (!text) return "";
  let cleaned = text.replace(/[đĐ]/g, 'd');
  cleaned = cleaned.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // strip accents
  cleaned = cleaned.toUpperCase();
  cleaned = cleaned.replace(/[^A-Z0-9]+/g, '-');
  return cleaned.replace(/^-+|-+$/g, '');
}

export function generateSkuCode(productCode: string, t1?: string | null, t2?: string | null): string {
  const cleanedProductCode = (productCode || "").toUpperCase().trim();

  // Don't generate SKU if product code is empty
  if (!cleanedProductCode) {
    return "";
  }

  const parts = [cleanedProductCode];
  if (t1) {
    const cleanedT1 = cleanOptionForSku(t1);
    if (cleanedT1) parts.push(cleanedT1);
  }
  if (t2) {
    const cleanedT2 = cleanOptionForSku(t2);
    if (cleanedT2) parts.push(cleanedT2);
  }
  if (parts.length === 1) {
    parts.push("DEFAULT");
  }
  return parts.join("-");
}
