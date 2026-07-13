# Backend Package: Pagination Module

## Task ID: BE-02
## Prerequisites: BE-00 (Setup)
## Estimated: 1.5 hours

---

## Mục Tiêu

Tạo unified pagination với:
- Generic response model
- SQLAlchemy query pagination
- Consistent across all services

---

## Implementation

### File: `packages/backend-common/topvnsport_common/pagination.py`

```python
"""Pagination utilities for SQLAlchemy queries."""

from typing import TypeVar, Generic, List, Any
from pydantic import BaseModel, Field
from sqlalchemy.orm import Query


T = TypeVar('T')


class PaginatedResponse(BaseModel, Generic[T]):
    """
    Standard paginated response model.
    
    Attributes:
        items: List of items for current page
        total: Total number of items across all pages
        page: Current page number (1-indexed)
        page_size: Number of items per page
        pages: Total number of pages
        has_next: Whether there is a next page
        has_prev: Whether there is a previous page
    """
    items: List[T]
    total: int = Field(ge=0)
    page: int = Field(ge=1)
    page_size: int = Field(ge=1)
    pages: int = Field(ge=0)
    has_next: bool
    has_prev: bool

    model_config = {
        "json_schema_extra": {
            "example": {
                "items": [],
                "total": 100,
                "page": 1,
                "page_size": 20,
                "pages": 5,
                "has_next": True,
                "has_prev": False,
            }
        }
    }


def paginate(
    query: Query,
    page: int = 1,
    page_size: int = 20,
    max_page_size: int = 100,
) -> dict[str, Any]:
    """
    Paginate a SQLAlchemy query.
    
    Args:
        query: SQLAlchemy Query object
        page: Page number (1-indexed, default 1)
        page_size: Items per page (default 20)
        max_page_size: Maximum allowed page_size (default 100)
    
    Returns:
        Dictionary with pagination data:
        - items: List of items for current page
        - total: Total count
        - page: Current page
        - page_size: Actual page size used
        - pages: Total pages
        - has_next: Boolean
        - has_prev: Boolean
    
    Example:
        @app.get("/products")
        def list_products(
            page: int = 1,
            page_size: int = 20,
            db: Session = Depends(get_db)
        ):
            query = db.query(Product).filter(Product.active == True)
            return paginate(query, page, page_size)
    """
    # Validate and cap page_size
    if page_size < 1:
        page_size = 20
    page_size = min(page_size, max_page_size)
    
    # Validate page
    if page < 1:
        page = 1
    
    # Get total count
    total = query.count()
    
    # Calculate total pages (ceiling division)
    pages = (total + page_size - 1) // page_size if total > 0 else 0
    
    # Ensure page doesn't exceed total pages
    if pages > 0 and page > pages:
        page = pages
    
    # Calculate offset and get items
    offset = (page - 1) * page_size
    items = query.offset(offset).limit(page_size).all()
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": pages,
        "has_next": page < pages,
        "has_prev": page > 1,
    }


def paginate_list(
    items: List[Any],
    page: int = 1,
    page_size: int = 20,
    max_page_size: int = 100,
) -> dict[str, Any]:
    """
    Paginate an in-memory list.
    
    Useful for small datasets or post-processed results.
    
    Args:
        items: List of items to paginate
        page: Page number (1-indexed)
        page_size: Items per page
        max_page_size: Maximum allowed page_size
    
    Returns:
        Dictionary with pagination data (same as paginate())
    """
    # Validate and cap page_size
    if page_size < 1:
        page_size = 20
    page_size = min(page_size, max_page_size)
    
    # Validate page
    if page < 1:
        page = 1
    
    total = len(items)
    pages = (total + page_size - 1) // page_size if total > 0 else 0
    
    if pages > 0 and page > pages:
        page = pages
    
    start = (page - 1) * page_size
    end = start + page_size
    page_items = items[start:end]
    
    return {
        "items": page_items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": pages,
        "has_next": page < pages,
        "has_prev": page > 1,
    }
```

---

## Test Cases

### File: `packages/backend-common/tests/unit/test_pagination.py`

```python
"""Tests for pagination module."""

import pytest
from unittest.mock import MagicMock, PropertyMock
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import Session

from topvnsport_common.database import Base
from topvnsport_common.pagination import (
    PaginatedResponse,
    paginate,
    paginate_list,
)


# Test model
class Item(Base):
    __tablename__ = "items"
    id = Column(Integer, primary_key=True)
    name = Column(String(50))


class TestPaginatedResponse:
    """Tests for PaginatedResponse model."""

    def test_model_serialization(self):
        """Should serialize all pagination fields correctly."""
        # Given
        response = PaginatedResponse[dict](
            items=[{"id": 1}, {"id": 2}],
            total=100,
            page=2,
            page_size=20,
            pages=5,
            has_next=True,
            has_prev=True,
        )
        
        # When
        data = response.model_dump()
        
        # Then
        assert data["items"] == [{"id": 1}, {"id": 2}]
        assert data["total"] == 100
        assert data["page"] == 2
        assert data["page_size"] == 20
        assert data["pages"] == 5
        assert data["has_next"] is True
        assert data["has_prev"] is True

    def test_generic_type_constraint(self):
        """Should accept generic item types."""
        # Given
        class ProductSchema:
            def __init__(self, id: int, name: str):
                self.id = id
                self.name = name
        
        # When/Then - should not raise
        response = PaginatedResponse[dict](
            items=[{"id": 1, "name": "Product"}],
            total=1,
            page=1,
            page_size=20,
            pages=1,
            has_next=False,
            has_prev=False,
        )

    def test_validation_total_non_negative(self):
        """Should reject negative total."""
        with pytest.raises(ValueError):
            PaginatedResponse[dict](
                items=[],
                total=-1,  # Invalid
                page=1,
                page_size=20,
                pages=0,
                has_next=False,
                has_prev=False,
            )

    def test_validation_page_positive(self):
        """Should reject page < 1."""
        with pytest.raises(ValueError):
            PaginatedResponse[dict](
                items=[],
                total=0,
                page=0,  # Invalid
                page_size=20,
                pages=0,
                has_next=False,
                has_prev=False,
            )


class TestPaginate:
    """Tests for paginate() function."""

    def _create_mock_query(self, total: int, items: list):
        """Helper to create mock SQLAlchemy query."""
        query = MagicMock()
        query.count.return_value = total
        query.offset.return_value = query
        query.limit.return_value = query
        query.all.return_value = items
        return query

    def test_paginate_first_page(self):
        """Should return first page correctly."""
        # Given
        items = [{"id": i} for i in range(1, 11)]
        query = self._create_mock_query(total=50, items=items)
        
        # When
        result = paginate(query, page=1, page_size=10)
        
        # Then
        assert result["items"] == items
        assert result["page"] == 1
        assert result["total"] == 50
        assert result["pages"] == 5
        assert result["has_prev"] is False
        assert result["has_next"] is True

    def test_paginate_middle_page(self):
        """Should return middle page correctly."""
        # Given
        items = [{"id": i} for i in range(21, 31)]
        query = self._create_mock_query(total=50, items=items)
        
        # When
        result = paginate(query, page=3, page_size=10)
        
        # Then
        assert result["page"] == 3
        assert result["has_prev"] is True
        assert result["has_next"] is True
        query.offset.assert_called_with(20)  # (3-1) * 10

    def test_paginate_last_page(self):
        """Should return last page correctly."""
        # Given
        items = [{"id": i} for i in range(41, 51)]
        query = self._create_mock_query(total=50, items=items)
        
        # When
        result = paginate(query, page=5, page_size=10)
        
        # Then
        assert result["page"] == 5
        assert result["has_next"] is False
        assert result["has_prev"] is True

    def test_paginate_partial_last_page(self):
        """Should handle partial last page."""
        # Given
        items = [{"id": i} for i in range(41, 46)]  # Only 5 items
        query = self._create_mock_query(total=45, items=items)
        
        # When
        result = paginate(query, page=5, page_size=10)
        
        # Then
        assert len(result["items"]) == 5
        assert result["total"] == 45
        assert result["pages"] == 5

    def test_paginate_empty_query(self):
        """Should handle empty query."""
        # Given
        query = self._create_mock_query(total=0, items=[])
        
        # When
        result = paginate(query, page=1, page_size=10)
        
        # Then
        assert result["items"] == []
        assert result["total"] == 0
        assert result["pages"] == 0
        assert result["has_next"] is False
        assert result["has_prev"] is False

    def test_page_size_capped_at_max(self):
        """Should cap page_size at max_page_size."""
        # Given
        query = self._create_mock_query(total=1000, items=[])
        
        # When
        result = paginate(query, page=1, page_size=500, max_page_size=100)
        
        # Then
        assert result["page_size"] == 100
        query.limit.assert_called_with(100)

    def test_total_pages_calculation(self):
        """Should calculate total pages correctly (ceiling division)."""
        # Given
        query = self._create_mock_query(total=101, items=[])
        
        # When
        result = paginate(query, page=1, page_size=10)
        
        # Then
        assert result["pages"] == 11  # ceil(101/10)

    def test_offset_calculation(self):
        """Should calculate correct offset."""
        # Given
        query = self._create_mock_query(total=100, items=[])
        
        # When
        paginate(query, page=3, page_size=20)
        
        # Then
        query.offset.assert_called_with(40)  # (3-1) * 20

    def test_default_page_size(self):
        """Should use default page_size=20."""
        # Given
        query = self._create_mock_query(total=100, items=[])
        
        # When
        result = paginate(query, page=1)
        
        # Then
        assert result["page_size"] == 20
        query.limit.assert_called_with(20)

    def test_page_exceeds_total_pages(self):
        """Should clamp page to max pages."""
        # Given
        query = self._create_mock_query(total=30, items=[])
        
        # When
        result = paginate(query, page=100, page_size=10)
        
        # Then
        assert result["page"] == 3  # Only 3 pages exist

    def test_negative_page_defaults_to_one(self):
        """Should default to page 1 for negative page."""
        # Given
        query = self._create_mock_query(total=50, items=[])
        
        # When
        result = paginate(query, page=-5, page_size=10)
        
        # Then
        assert result["page"] == 1

    def test_zero_page_size_defaults(self):
        """Should default page_size for invalid values."""
        # Given
        query = self._create_mock_query(total=50, items=[])
        
        # When
        result = paginate(query, page=1, page_size=0)
        
        # Then
        assert result["page_size"] == 20


class TestPaginateList:
    """Tests for paginate_list() function."""

    def test_paginate_list_first_page(self):
        """Should paginate list correctly."""
        # Given
        items = list(range(50))
        
        # When
        result = paginate_list(items, page=1, page_size=10)
        
        # Then
        assert result["items"] == list(range(10))
        assert result["total"] == 50
        assert result["pages"] == 5

    def test_paginate_list_middle_page(self):
        """Should return correct slice for middle page."""
        # Given
        items = list(range(50))
        
        # When
        result = paginate_list(items, page=3, page_size=10)
        
        # Then
        assert result["items"] == list(range(20, 30))

    def test_paginate_list_empty(self):
        """Should handle empty list."""
        # Given
        items = []
        
        # When
        result = paginate_list(items, page=1, page_size=10)
        
        # Then
        assert result["items"] == []
        assert result["total"] == 0
        assert result["pages"] == 0

    def test_paginate_list_partial_page(self):
        """Should handle partial last page."""
        # Given
        items = list(range(25))
        
        # When
        result = paginate_list(items, page=3, page_size=10)
        
        # Then
        assert result["items"] == list(range(20, 25))
        assert len(result["items"]) == 5
```

---

## Verification

```bash
cd packages/backend-common

# Run pagination tests
pytest tests/unit/test_pagination.py -v

# Run with coverage
pytest tests/unit/test_pagination.py --cov=topvnsport_common.pagination --cov-report=term-missing

# Expected coverage: 100%
```

---

## Checklist

- [ ] pagination.py implemented
- [ ] PaginatedResponse model with validation
- [ ] paginate() for SQLAlchemy queries
- [ ] paginate_list() for in-memory lists
- [ ] All 18 test cases pass
- [ ] 100% code coverage
- [ ] Edge cases handled (empty, out of range, etc.)
