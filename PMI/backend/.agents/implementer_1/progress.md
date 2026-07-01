# progress.md

- **Status**: Completed
- **Last visited**: 2026-06-29T19:59:50Z
- **Steps completed**:
  - Investigated database models, relations, schemas, and main.py route mapping.
  - Defined the `ProductBySkuResponse` Pydantic model in `schemas.py`.
  - Implemented the `GET /api/products/by-sku/{sku_code}` endpoint in `main.py` using genuine database lookup logic.
  - Handled combination of tier options (including lookup of tier names like "Màu sắc", "Kích cỡ" etc.) for `variant_name`.
  - Implemented cover image, variant media, and product media fallbacks for `image_url`.
  - Verified backend compilation and endpoint behavior in the dockerized environment with HTTP queries.
