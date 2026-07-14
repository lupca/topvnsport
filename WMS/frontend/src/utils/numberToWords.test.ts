import { describe, expect, it } from 'vitest';
import { convertNumberToVietnameseWords } from './numberToWords';

describe('convertNumberToVietnameseWords', () => {
  it('should handle zero', () => {
    expect(convertNumberToVietnameseWords(0)).toBe('Không đồng chẵn');
  });

  it('should handle simple numbers', () => {
    expect(convertNumberToVietnameseWords(123)).toBe('Một trăm hai mươi ba đồng chẵn');
  });

  it('should handle millions', () => {
    expect(convertNumberToVietnameseWords(1000000)).toBe('Một triệu đồng chẵn');
    expect(convertNumberToVietnameseWords(2750000)).toBe('Hai triệu bảy trăm năm mươi nghìn đồng chẵn');
  });

  it('should handle middle zeros and ones', () => {
    expect(convertNumberToVietnameseWords(1005000)).toBe('Một triệu không trăm lẻ năm nghìn đồng chẵn');
  });
});
