import { StringOption } from '../../types';

export const isNoStringOption = (value: string): boolean => {
  const normalized = value.toLowerCase();
  return (
    normalized.includes('khung') ||
    normalized.includes('khong') ||
    normalized.includes('không') ||
    normalized.includes('no string') ||
    normalized.includes('khong dan') ||
    normalized.includes('không đan')
  );
};

export const getTensionTooltip = (kg: number): string => {
  if (kg < 10) {
    return 'Mức căng nhẹ (9 - 9.5 kg): Phù hợp tuyệt đối với người mới tập, trẻ em, phụ nữ lực tay nhẹ, ưu tiên trợ lực tối đa.';
  }

  if (kg <= 11) {
    return 'Mức căng trung bình (10 - 11 kg): Khuyên dùng cho người chơi phong trào lâu năm, kỹ thuật khá, cân bằng trợ lực và kiểm soát.';
  }

  return 'Mức căng cao chuyên nghiệp (11.5 - 13 kg+): Dành riêng cho tay vợt bán chuyên/chuyên nghiệp, lực cổ tay cực khỏe, kiểm soát cầu chính xác 100% nhưng hoàn toàn không trợ lực.';
};

export const inferStringMeta = (
  optionName: string,
  stringOptions: StringOption[]
): { type: StringOption['type']; thickness: string } => {
  const option = stringOptions.find(
    (item) =>
      item.name.toLowerCase().includes(optionName.toLowerCase()) ||
      optionName.toLowerCase().includes(item.name.toLowerCase())
  );

  return {
    type: option?.type || 'Trợ lực / Âm thanh',
    thickness: option?.thickness || '0.65mm'
  };
};
