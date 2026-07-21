#!/usr/bin/env python3
"""
Script to format and repair product descriptions in PMI database.
- Joins bad newline splits inside emoji headers (e.g. 🔥\n🔥 -> 🔥🔥, ✔\nChất liệu -> ✔ Chất liệu).
- Removes Shopee character counters (e.g. 1975/3000).
- Inserts proper newlines before bullet points, numbered lists, section headers, and section emojis.
"""

import os
import sys
import re
import argparse

# Include PMI backend path
sys.path.append(os.path.join(os.path.dirname(__file__), '../../PMI/backend'))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import models

DEFAULT_DB_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:15433/pim_db")

EMOJI_LIST = r'🎒|🔥|🌟|🏸|🐉|🛒|📌|✅|⚡|👕|👟|🎯|💡|🛡️|🔹|🚀|⭐|🎾|🏓|🏆|💥|👉|✔|⚙|👥|🏷️|⚡'

SECTION_HEADERS_EXPLICIT = [
    r'THÔNG TIN SẢN PHẨM\b', r'ĐẶC ĐIỂM NỔI BẬT\b', r'THÔNG SỐ KĨ THUẬT\b', r'THÔNG SỐ KỸ THUẬT\b',
    r'HƯỚNG DẪN BẢO QUẢN\b', r'HƯỚNG DẪN SỬ DỤNG\b', r'HƯỚNG DẪN CHỌN SIZE\b', r'CAM KẾT\b', r'LƯU Ý\b',
    r'BẢO HÀNH\b', r'BẢNG SIZE\b', r'MÔ TẢ SẢN PHẨM\b', r'TAGS:'
]

def format_description(desc: str) -> str:
    """Clean, repair, and format a product description string."""
    if not desc:
        return desc

    text = desc

    # Step A: Repair bad newlines between emojis (e.g. 🔥\n🔥 -> 🔥🔥)
    while True:
        new_text = re.sub(r'([\u2600-\u27bf\U0001f000-\U0001ffff])\n+([\u2600-\u27bf\U0001f000-\U0001ffff])', r'\1\2', text)
        if new_text == text:
            break
        text = new_text

    # Step B: Repair bad newline right after an emoji header symbol before title text (e.g. ✔\nChất liệu -> ✔ Chất liệu)
    text = re.sub(
        r'([\u2600-\u27bf\U0001f000-\U0001ffff])\n+([A-Z0-9ÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐa-z0-9])',
        r'\1 \2',
        text
    )

    # Step C: Remove Shopee character counter at the end (e.g. 1975/3000, 1669\n/3000, etc.)
    text = re.sub(r'(\n|\s)*\d{1,4}\s*(\n|\s)*/\s*3000\s*$', '', text, flags=re.IGNORECASE)

    # Step D: Add newline before section emojis if preceded by non-newline and non-emoji text
    text = re.sub(rf'([^\n\u200d\u2600-\u27bf\U0001f000-\U0001ffff])\s*({EMOJI_LIST})', r'\1\n\2', text)

    # Step E: Add newline before bullet points (- , + , • , * , ✔ ) if preceded by non-newline and non-emoji/colon/asterisk
    text = re.sub(
        r'([^\n:\*\u2600-\u27bf\U0001f000-\U0001ffff])\s*([\-\+•\*✔]\s+[A-Z0-9ÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐa-z0-9])',
        r'\1\n\2',
        text
    )

    # Step F: Add newline before numbered items (1. , 2. , 3. ) if preceded by non-newline
    text = re.sub(
        r'([^\n])\s*(\d+\.\s+[A-Z0-9ÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ])',
        r'\1\n\2',
        text
    )

    # Step G: Add newline before explicit ALL CAPS Section Headers (e.g. THÔNG SỐ KĨ THUẬT, THÔNG TIN SẢN PHẨM)
    for header in SECTION_HEADERS_EXPLICIT:
        text = re.sub(rf'([^\n])\s*({header})', r'\1\n\2', text)

    # Step H: Normalize multiple newlines (max 2 consecutive newlines)
    text = re.sub(r'\n{3,}', '\n\n', text)

    return text.strip()

def main():
    parser = argparse.ArgumentParser(description="Format PMI Product Descriptions")
    parser.add_argument("--dry-run", action="store_true", help="Inspect changes without updating database")
    parser.add_argument("--db-url", default=DEFAULT_DB_URL, help="PostgreSQL Database Connection URL")
    args = parser.parse_args()

    print(f"Connecting to database: {args.db_url}")
    engine = create_engine(args.db_url)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    try:
        products = db.query(models.Product).order_by(models.Product.id.asc()).all()
        print(f"Total products found: {len(products)}")

        updated_count = 0

        for p in products:
            orig_desc = p.description or ""
            new_desc = format_description(orig_desc)

            if orig_desc != new_desc:
                updated_count += 1
                orig_line_count = len(orig_desc.split('\n'))
                new_line_count = len(new_desc.split('\n'))

                print(f"[{'DRY-RUN' if args.dry_run else 'UPDATE'}] ID: {p.id:3d} | Code: {p.product_code:15s} | Lines: {orig_line_count:2d} -> {new_line_count:2d}")

                if not args.dry_run:
                    p.description = new_desc

        if not args.dry_run and updated_count > 0:
            db.commit()
            print("\nSuccessfully committed updates to database!")
        elif args.dry_run:
            print("\n[DRY-RUN] No changes were written to the database.")

        print(f"\nExecution Summary:")
        print(f"  - Total products checked: {len(products)}")
        print(f"  - Products formatted: {updated_count}")

    except Exception as e:
        if not args.dry_run:
            db.rollback()
        print(f"Error executing script: {e}")
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    main()
