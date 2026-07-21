import { z } from "zod";

export const tierVariationSchema = z.object({
  tier_index: z.number().min(1).max(2),
  name: z.string().min(1, "Nhóm phân loại hàng không được trống"),
  options: z.array(z.string().min(1, "Phân loại không được trống")).min(1, "Tối thiểu 1 phân loại")
});

export const variantSchema = z.object({
  tier_1_option: z.string().nullable(),
  tier_2_option: z.string().nullable(),
  sku_code: z.string().optional().nullable().or(z.literal("")),
  price: z.coerce.number().min(0, "Giá trị phải lớn hơn hoặc bằng 0"),
  barcode: z.string().optional().nullable()
});

export const productMediaSchema = z.object({
  image_url: z.string().url(),
  is_cover: z.boolean(),
  display_order: z.number().min(1),
  variant_tier_1_option: z.string().optional().nullable()
});

export const productChannelAttributeValueSchema = z.object({
  attribute_mapping_id: z.number(),
  value_string: z.string().optional().nullable(),
  value_decimal: z.coerce.number().optional().nullable()
});

export const variantChannelListingSchema = z.object({
  sku_code: z.string(),
  price_override: z.coerce.number().optional().nullable(),
  channel_variant_id: z.string().optional().nullable()
});

export const productChannelListingSchema = z.object({
  channel_code: z.string(),
  status: z.enum(["Published", "Draft", "Hidden"]),
  title_override: z.string().optional().nullable(),
  description_override: z.string().optional().nullable(),
  shipping_config: z.any().optional().nullable(),
  channel_product_id: z.string().optional().nullable(),
  attribute_values: z.array(productChannelAttributeValueSchema).default([]),
  variant_overrides: z.array(variantChannelListingSchema).default([])
});

export const productFormSchema = z.object({
  product_code: z.string().min(1, "Trường này là bắt buộc"),
  name: z.string().min(5, "Độ dài tối thiểu là 5 ký tự"),
  description: z.string().min(10, "Độ dài tối thiểu là 10 ký tự"),
  category_id: z.coerce.number().min(1, "Vui lòng chọn ngành hàng"),
  family_id: z.coerce.number().min(1, "Vui lòng chọn bộ thuộc tính"),
  weight: z.coerce.number().min(1, "Giá trị phải lớn hơn hoặc bằng 1"),
  length: z.coerce.number().optional().nullable(),
  width: z.coerce.number().optional().nullable(),
  height: z.coerce.number().optional().nullable(),
  hs_code: z.string().optional().nullable(),
  tax_code: z.string().optional().nullable(),
  is_pre_order: z.boolean().default(false),
  dts_days: z.coerce.number().min(7, "Giá trị phải lớn hơn hoặc bằng 7").max(30, "Giá trị phải nhỏ hơn hoặc bằng 30").optional().nullable(),
  status: z.enum(["Draft", "Published"]).default("Draft"),
  tier_variations: z.array(tierVariationSchema).max(2),
  variants: z.array(variantSchema).min(1),
  media: z.array(productMediaSchema),
  channel_listings: z.array(productChannelListingSchema).default([])
});

export type ProductFormValues = z.infer<typeof productFormSchema>;
