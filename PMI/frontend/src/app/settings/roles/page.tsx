"use client";

import React, { useState } from "react";
import { Search, SlidersHorizontal, ChevronLeft, ChevronRight, Edit2, Trash2, Shield, Plus } from "lucide-react";
import { APP_SETTINGS } from "@/config/settings";
import { popupService, showConfirm } from "@/components/ui/popupService";

interface Role {
  id: number;
  name: string;
  permissionType: string;
}

export default function RolesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [roles, setRoles] = useState<Role[]>([
    { id: 1, name: "Administrator", permissionType: "All" }
  ]);

  const filteredRoles = roles.filter(role => 
    role.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    role.permissionType.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalResults = filteredRoles.length;
  const totalPages = Math.ceil(totalResults / perPage) || 1;

  const handleDelete = async (id: number) => {
    if (await showConfirm("Bạn có chắc chắn muốn xóa vai trò này không?")) {
      setRoles(roles.filter(role => role.id !== id));
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-200/60 pb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <span>Roles</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">Manage security roles and permissions</p>
        </div>
        <button
          onClick={() => void popupService.alert("Tính năng tạo vai trò đang được phát triển.")}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-750 text-white text-xs font-semibold rounded-lg shadow-md shadow-indigo-600/10 hover:shadow-indigo-500/20 transition-all duration-200 active:scale-95 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Create Role</span>
        </button>
      </div>

      {/* Toolbar controls */}
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-sm p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search & Results */}
        <div className="flex items-center gap-4 flex-1">
          <div className="relative w-72">
            <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition-all text-slate-700"
            />
          </div>
          <span className="text-xs text-slate-400 font-medium">
            {totalResults} Results
          </span>
        </div>

        {/* Filters, Per Page, Pagination */}
        <div className="flex items-center gap-4 flex-wrap md:flex-nowrap">
          {/* Filter Button */}
          <button className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-600 transition-colors cursor-pointer">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filter</span>
          </button>

          {/* Per Page */}
          <div className="flex items-center gap-2">
            <select
              value={perPage}
              onChange={(e) => setPerPage(Number(e.target.value))}
              className="bg-slate-55 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
            >
              {APP_SETTINGS.pagination.options.map(val => (
                <option key={val} value={val}>{val}</option>
              ))}
            </select>
            <span className="text-xs text-slate-400 font-medium">Per Page</span>
          </div>

          <div className="h-4 w-px bg-slate-200 hidden sm:block"></div>

          {/* Pagination */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 font-medium">
              {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
                className="p-1.5 rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent text-slate-500 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
                className="p-1.5 rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent text-slate-500 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Roles Table */}
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">ID</th>
                <th className="px-6 py-4 font-semibold">Name</th>
                <th className="px-6 py-4 font-semibold">Permission Type</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredRoles.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-slate-400 font-medium">
                    No roles found
                  </td>
                </tr>
              ) : (
                filteredRoles.map((role) => (
                  <tr key={role.id} className="hover:bg-slate-50/50 transition-colors duration-150">
                    <td className="px-6 py-4 font-medium text-slate-400">{role.id}</td>
                    <td className="px-6 py-4 font-semibold text-slate-800">{role.name}</td>
                    <td className="px-6 py-4 text-slate-500">{role.permissionType}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => void popupService.alert(`Tính năng sửa vai trò (ID: ${role.id}) đang được phát triển.`)}
                          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-all cursor-pointer"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => void handleDelete(role.id)}
                          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-rose-600 transition-all cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
