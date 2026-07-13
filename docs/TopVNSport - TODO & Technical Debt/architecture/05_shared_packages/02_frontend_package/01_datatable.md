# Frontend Package: DataTable Component

## Task ID: FE-01
## Prerequisites: FE-00 (Setup)
## Estimated: 2 hours

---

## Mục Tiêu

Tạo reusable DataTable component với:
- Generic type support
- Column configuration
- Pagination
- Sorting (optional)
- Loading/empty states

---

## Implementation

### File: `packages/ui-kit/src/components/DataTable/DataTable.tsx`

```tsx
import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUpDown, ArrowUp, ArrowDown, Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T, index: number) => React.ReactNode;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

export interface PaginationConfig {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (item: T, index: number) => void;
  pagination?: PaginationConfig;
  sort?: SortConfig;
  onSort?: (sort: SortConfig) => void;
  className?: string;
  rowClassName?: string | ((item: T, index: number) => string);
  getRowKey?: (item: T, index: number) => string | number;
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  loading = false,
  emptyMessage = 'Không có dữ liệu',
  onRowClick,
  pagination,
  sort,
  onSort,
  className,
  rowClassName,
  getRowKey,
}: DataTableProps<T>) {
  const totalPages = pagination
    ? Math.ceil(pagination.total / pagination.pageSize)
    : 0;

  const handleSort = (column: Column<T>) => {
    if (!column.sortable || !onSort) return;
    
    const key = String(column.key);
    const direction =
      sort?.key === key && sort.direction === 'asc' ? 'desc' : 'asc';
    
    onSort({ key, direction });
  };

  const getCellValue = (item: T, column: Column<T>, index: number): React.ReactNode => {
    if (column.render) {
      return column.render(item, index);
    }
    
    const key = column.key as keyof T;
    const value = item[key];
    
    if (value === null || value === undefined) {
      return '-';
    }
    
    return String(value);
  };

  const getRowKeyValue = (item: T, index: number): string | number => {
    if (getRowKey) {
      return getRowKey(item, index);
    }
    if ('id' in item) {
      return item.id as string | number;
    }
    return index;
  };

  const getRowClassName = (item: T, index: number): string => {
    if (typeof rowClassName === 'function') {
      return rowClassName(item, index);
    }
    return rowClassName || '';
  };

  return (
    <div className={cn('w-full', className)}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" role="table">
          <thead>
            <tr className="border-b bg-gray-50">
              {columns.map((column, colIndex) => (
                <th
                  key={String(column.key) || colIndex}
                  className={cn(
                    'px-4 py-3 text-sm font-medium text-gray-700',
                    column.align === 'center' && 'text-center',
                    column.align === 'right' && 'text-right',
                    column.sortable && onSort && 'cursor-pointer hover:bg-gray-100',
                  )}
                  style={{ width: column.width }}
                  onClick={() => handleSort(column)}
                  aria-sort={
                    sort?.key === column.key
                      ? sort.direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                >
                  <div className="flex items-center gap-1">
                    <span>{column.header}</span>
                    {column.sortable && onSort && (
                      <span className="ml-1">
                        {sort?.key === column.key ? (
                          sort.direction === 'asc' ? (
                            <ArrowUp className="h-4 w-4" />
                          ) : (
                            <ArrowDown className="h-4 w-4" />
                          )
                        ) : (
                          <ArrowUpDown className="h-4 w-4 text-gray-400" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center"
                >
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                    <span className="text-gray-500">Đang tải...</span>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-gray-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item, rowIndex) => (
                <tr
                  key={getRowKeyValue(item, rowIndex)}
                  className={cn(
                    'border-b transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-gray-50',
                    getRowClassName(item, rowIndex),
                  )}
                  onClick={() => onRowClick?.(item, rowIndex)}
                >
                  {columns.map((column, colIndex) => (
                    <td
                      key={String(column.key) || colIndex}
                      className={cn(
                        'px-4 py-3 text-sm',
                        column.align === 'center' && 'text-center',
                        column.align === 'right' && 'text-right',
                      )}
                    >
                      {getCellValue(item, column, rowIndex)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && totalPages > 0 && (
        <div className="flex items-center justify-between border-t px-4 py-3">
          <div className="text-sm text-gray-500">
            Hiển thị {(pagination.page - 1) * pagination.pageSize + 1} -{' '}
            {Math.min(pagination.page * pagination.pageSize, pagination.total)} của{' '}
            {pagination.total} kết quả
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => pagination.onPageChange(1)}
              disabled={pagination.page === 1}
              className="rounded p-1 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Trang đầu"
            >
              <ChevronsLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="rounded p-1 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Trang trước"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            
            <span className="px-2 text-sm">
              Trang {pagination.page} / {totalPages}
            </span>
            
            <button
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={pagination.page >= totalPages}
              className="rounded p-1 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Trang sau"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <button
              onClick={() => pagination.onPageChange(totalPages)}
              disabled={pagination.page >= totalPages}
              className="rounded p-1 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Trang cuối"
            >
              <ChevronsRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## Test Cases

### File: `packages/ui-kit/src/components/DataTable/__tests__/DataTable.test.tsx`

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DataTable, Column } from '../DataTable';

interface TestItem {
  id: number;
  name: string;
  price: number;
  active: boolean;
}

const mockData: TestItem[] = [
  { id: 1, name: 'Product A', price: 100, active: true },
  { id: 2, name: 'Product B', price: 200, active: false },
  { id: 3, name: 'Product C', price: 300, active: true },
];

const columns: Column<TestItem>[] = [
  { key: 'name', header: 'Tên' },
  { key: 'price', header: 'Giá' },
];

describe('DataTable', () => {
  describe('Rendering', () => {
    it('renders column headers', () => {
      render(<DataTable data={mockData} columns={columns} />);
      
      expect(screen.getByText('Tên')).toBeInTheDocument();
      expect(screen.getByText('Giá')).toBeInTheDocument();
    });

    it('renders data rows', () => {
      render(<DataTable data={mockData} columns={columns} />);
      
      expect(screen.getByText('Product A')).toBeInTheDocument();
      expect(screen.getByText('Product B')).toBeInTheDocument();
      expect(screen.getByText('Product C')).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument();
    });

    it('renders custom cell with render function', () => {
      const columnsWithRender: Column<TestItem>[] = [
        { key: 'name', header: 'Tên' },
        { 
          key: 'price', 
          header: 'Giá', 
          render: (item) => <span data-testid="price">{item.price}đ</span> 
        },
      ];
      
      render(<DataTable data={mockData} columns={columnsWithRender} />);
      
      expect(screen.getByText('100đ')).toBeInTheDocument();
    });

    it('shows empty message when no data', () => {
      render(
        <DataTable 
          data={[]} 
          columns={columns} 
          emptyMessage="Không có sản phẩm" 
        />
      );
      
      expect(screen.getByText('Không có sản phẩm')).toBeInTheDocument();
    });

    it('shows default empty message', () => {
      render(<DataTable data={[]} columns={columns} />);
      
      expect(screen.getByText('Không có dữ liệu')).toBeInTheDocument();
    });

    it('shows loading state', () => {
      render(<DataTable data={[]} columns={columns} loading />);
      
      expect(screen.getByText('Đang tải...')).toBeInTheDocument();
    });

    it('applies column width styles', () => {
      const columnsWithWidth: Column<TestItem>[] = [
        { key: 'name', header: 'Tên', width: '200px' },
        { key: 'price', header: 'Giá' },
      ];
      
      render(<DataTable data={mockData} columns={columnsWithWidth} />);
      
      const header = screen.getByText('Tên').closest('th');
      expect(header).toHaveStyle({ width: '200px' });
    });

    it('handles null/undefined values', () => {
      const dataWithNull = [
        { id: 1, name: null, price: undefined },
      ] as any;
      
      render(<DataTable data={dataWithNull} columns={columns} />);
      
      expect(screen.getAllByText('-')).toHaveLength(2);
    });

    it('applies custom row className', () => {
      render(
        <DataTable 
          data={mockData} 
          columns={columns} 
          rowClassName="custom-row"
        />
      );
      
      const rows = screen.getAllByRole('row').slice(1); // Skip header
      rows.forEach(row => {
        expect(row).toHaveClass('custom-row');
      });
    });

    it('applies dynamic row className', () => {
      render(
        <DataTable 
          data={mockData} 
          columns={columns} 
          rowClassName={(item) => item.active ? 'active-row' : 'inactive-row'}
        />
      );
      
      const rows = screen.getAllByRole('row').slice(1);
      expect(rows[0]).toHaveClass('active-row');
      expect(rows[1]).toHaveClass('inactive-row');
    });
  });

  describe('Interactions', () => {
    it('calls onRowClick when row clicked', () => {
      const onRowClick = vi.fn();
      
      render(
        <DataTable 
          data={mockData} 
          columns={columns} 
          onRowClick={onRowClick}
        />
      );
      
      fireEvent.click(screen.getByText('Product A').closest('tr')!);
      
      expect(onRowClick).toHaveBeenCalledWith(mockData[0], 0);
    });

    it('row is clickable only when onRowClick provided', () => {
      const { rerender } = render(
        <DataTable data={mockData} columns={columns} />
      );
      
      const row = screen.getByText('Product A').closest('tr');
      expect(row).not.toHaveClass('cursor-pointer');
      
      rerender(
        <DataTable 
          data={mockData} 
          columns={columns} 
          onRowClick={() => {}}
        />
      );
      
      expect(screen.getByText('Product A').closest('tr')).toHaveClass('cursor-pointer');
    });
  });

  describe('Pagination', () => {
    const pagination = {
      page: 1,
      pageSize: 10,
      total: 50,
      onPageChange: vi.fn(),
    };

    it('renders pagination controls', () => {
      render(
        <DataTable 
          data={mockData} 
          columns={columns} 
          pagination={pagination}
        />
      );
      
      expect(screen.getByText('Trang 1 / 5')).toBeInTheDocument();
      expect(screen.getByLabelText('Trang sau')).toBeInTheDocument();
      expect(screen.getByLabelText('Trang trước')).toBeInTheDocument();
    });

    it('calls onPageChange when page changed', () => {
      const onPageChange = vi.fn();
      
      render(
        <DataTable 
          data={mockData} 
          columns={columns} 
          pagination={{ ...pagination, onPageChange }}
        />
      );
      
      fireEvent.click(screen.getByLabelText('Trang sau'));
      
      expect(onPageChange).toHaveBeenCalledWith(2);
    });

    it('disables prev button on first page', () => {
      render(
        <DataTable 
          data={mockData} 
          columns={columns} 
          pagination={{ ...pagination, page: 1 }}
        />
      );
      
      expect(screen.getByLabelText('Trang trước')).toBeDisabled();
      expect(screen.getByLabelText('Trang đầu')).toBeDisabled();
    });

    it('disables next button on last page', () => {
      render(
        <DataTable 
          data={mockData} 
          columns={columns} 
          pagination={{ ...pagination, page: 5, total: 50 }}
        />
      );
      
      expect(screen.getByLabelText('Trang sau')).toBeDisabled();
      expect(screen.getByLabelText('Trang cuối')).toBeDisabled();
    });

    it('shows correct page info', () => {
      render(
        <DataTable 
          data={mockData} 
          columns={columns} 
          pagination={{ page: 2, pageSize: 10, total: 50, onPageChange: vi.fn() }}
        />
      );
      
      expect(screen.getByText(/Hiển thị 11 - 20 của 50/)).toBeInTheDocument();
    });

    it('handles last page with partial results', () => {
      render(
        <DataTable 
          data={mockData} 
          columns={columns} 
          pagination={{ page: 5, pageSize: 10, total: 45, onPageChange: vi.fn() }}
        />
      );
      
      expect(screen.getByText(/Hiển thị 41 - 45 của 45/)).toBeInTheDocument();
    });

    it('navigates to first page', () => {
      const onPageChange = vi.fn();
      
      render(
        <DataTable 
          data={mockData} 
          columns={columns} 
          pagination={{ page: 3, pageSize: 10, total: 50, onPageChange }}
        />
      );
      
      fireEvent.click(screen.getByLabelText('Trang đầu'));
      
      expect(onPageChange).toHaveBeenCalledWith(1);
    });

    it('navigates to last page', () => {
      const onPageChange = vi.fn();
      
      render(
        <DataTable 
          data={mockData} 
          columns={columns} 
          pagination={{ page: 3, pageSize: 10, total: 50, onPageChange }}
        />
      );
      
      fireEvent.click(screen.getByLabelText('Trang cuối'));
      
      expect(onPageChange).toHaveBeenCalledWith(5);
    });
  });

  describe('Sorting', () => {
    const sortableColumns: Column<TestItem>[] = [
      { key: 'name', header: 'Tên', sortable: true },
      { key: 'price', header: 'Giá', sortable: true },
    ];

    it('shows sort indicator on sortable columns', () => {
      render(
        <DataTable 
          data={mockData} 
          columns={sortableColumns}
          onSort={() => {}}
        />
      );
      
      // Should show ArrowUpDown icon for unsorted columns
      const headers = screen.getAllByRole('columnheader');
      expect(headers[0].querySelector('svg')).toBeInTheDocument();
    });

    it('toggles sort direction on click', () => {
      const onSort = vi.fn();
      
      render(
        <DataTable 
          data={mockData} 
          columns={sortableColumns}
          onSort={onSort}
        />
      );
      
      // First click - ascending
      fireEvent.click(screen.getByText('Tên'));
      expect(onSort).toHaveBeenCalledWith({ key: 'name', direction: 'asc' });
      
      // Rerender with sort applied
      render(
        <DataTable 
          data={mockData} 
          columns={sortableColumns}
          sort={{ key: 'name', direction: 'asc' }}
          onSort={onSort}
        />
      );
      
      // Second click - descending
      fireEvent.click(screen.getByText('Tên'));
      expect(onSort).toHaveBeenCalledWith({ key: 'name', direction: 'desc' });
    });

    it('non-sortable columns do not respond to click', () => {
      const onSort = vi.fn();
      const mixedColumns: Column<TestItem>[] = [
        { key: 'name', header: 'Tên', sortable: false },
        { key: 'price', header: 'Giá', sortable: true },
      ];
      
      render(
        <DataTable 
          data={mockData} 
          columns={mixedColumns}
          onSort={onSort}
        />
      );
      
      fireEvent.click(screen.getByText('Tên'));
      expect(onSort).not.toHaveBeenCalled();
    });

    it('shows correct sort icon for current sort', () => {
      render(
        <DataTable 
          data={mockData} 
          columns={sortableColumns}
          sort={{ key: 'name', direction: 'asc' }}
          onSort={() => {}}
        />
      );
      
      const nameHeader = screen.getByText('Tên').closest('th');
      expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
    });
  });

  describe('Accessibility', () => {
    it('table has proper role', () => {
      render(<DataTable data={mockData} columns={columns} />);
      
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('pagination buttons have aria-labels', () => {
      render(
        <DataTable 
          data={mockData} 
          columns={columns} 
          pagination={{
            page: 2,
            pageSize: 10,
            total: 50,
            onPageChange: vi.fn(),
          }}
        />
      );
      
      expect(screen.getByLabelText('Trang đầu')).toBeInTheDocument();
      expect(screen.getByLabelText('Trang trước')).toBeInTheDocument();
      expect(screen.getByLabelText('Trang sau')).toBeInTheDocument();
      expect(screen.getByLabelText('Trang cuối')).toBeInTheDocument();
    });

    it('sortable headers have aria-sort', () => {
      render(
        <DataTable 
          data={mockData} 
          columns={[{ key: 'name', header: 'Tên', sortable: true }]}
          sort={{ key: 'name', direction: 'desc' }}
          onSort={() => {}}
        />
      );
      
      const header = screen.getByText('Tên').closest('th');
      expect(header).toHaveAttribute('aria-sort', 'descending');
    });
  });

  describe('Custom Row Key', () => {
    it('uses custom getRowKey function', () => {
      const dataWithUuid = [
        { uuid: 'abc-123', name: 'A' },
        { uuid: 'def-456', name: 'B' },
      ];
      
      const { container } = render(
        <DataTable 
          data={dataWithUuid} 
          columns={[{ key: 'name', header: 'Name' }]}
          getRowKey={(item) => item.uuid}
        />
      );
      
      // Should render without errors (key uniqueness)
      expect(container.querySelectorAll('tbody tr')).toHaveLength(2);
    });
  });
});
```

---

## Verification

```bash
cd packages/ui-kit

# Run DataTable tests
pnpm test src/components/DataTable

# Run with coverage
pnpm test:coverage

# Expected coverage: 100%
```

---

## Checklist

- [ ] DataTable.tsx implemented
- [ ] Generic type support
- [ ] Column configuration with render function
- [ ] Pagination with all navigation buttons
- [ ] Sorting with direction toggle
- [ ] Loading state
- [ ] Empty state with custom message
- [ ] Row click handler
- [ ] Custom row className (static and dynamic)
- [ ] Custom row key function
- [ ] All 26 test cases pass
- [ ] 100% code coverage
- [ ] Accessibility (roles, aria-labels)
