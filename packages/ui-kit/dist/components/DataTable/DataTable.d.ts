import React from "react";
export interface Column<T> {
    key: string;
    label: string;
    render?: (item: T) => React.ReactNode;
    className?: string;
}
export interface PaginationProps {
    currentPage: number;
    totalPages: number;
    limit: number;
    totalItems: number;
    onPageChange: (page: number) => void;
    onLimitChange: (limit: number) => void;
}
export interface DataTableProps<T> {
    title: string;
    description?: string;
    data: T[];
    columns: Column<T>[];
    pagination?: PaginationProps;
    searchQuery?: string;
    onSearchChange?: (query: string) => void;
    onAddClick?: () => void;
    addLabel?: string;
    onEditClick?: (item: T) => void;
    onDeleteClick?: (item: T) => void;
    onCopyClick?: (item: T) => void;
    loading?: boolean;
    showRowNumber?: boolean;
}
export default function DataTable<T extends {
    id: any;
}>({ title, description, data, columns, pagination, searchQuery, onSearchChange, onAddClick, addLabel, onEditClick, onDeleteClick, onCopyClick, loading, showRowNumber, }: DataTableProps<T>): JSX.Element;
