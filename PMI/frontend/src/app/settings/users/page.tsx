"use client";

import React, { useState } from "react";
import { Search, SlidersHorizontal, ChevronLeft, ChevronRight, Edit2, Trash2, UserPlus } from "lucide-react";
import { APP_SETTINGS } from "@/config/settings";
import { popupService, showConfirm } from "@/components/ui/popupService";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  status: "Active" | "Inactive";
}

export default function UsersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [users, setUsers] = useState<User[]>([
    { id: 1, name: "Administrator", email: "admin@example.com", role: "Administrator", status: "Active" }
  ]);

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalResults = filteredUsers.length;
  const totalPages = Math.ceil(totalResults / perPage) || 1;

  const handleDelete = async (id: number) => {
    if (await showConfirm("Bạn có chắc chắn muốn xóa người dùng này không?")) {
      setUsers(users.filter(user => user.id !== id));
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Users</h1>
          <p className="text-xs text-gray-500 mt-1">Manage platform users and access levels</p>
        </div>
        <button
          onClick={() => void popupService.alert("Tính năng tạo người dùng đang được phát triển.")}
          className="inline-flex items-center gap-1.5 px-4 py-2 btn-primary text-gray-900 text-xs font-semibold rounded-lg shadow-md shadow-sm hover:shadow-sm transition-all duration-200 active:scale-95 cursor-pointer"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Create User</span>
        </button>
      </div>

      {/* Toolbar controls */}
      <div className="bg-surface border border-gray-200 rounded-xl shadow-sm p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search & Results */}
        <div className="flex items-center gap-4 flex-1">
          <div className="relative w-72">
            <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-500">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-brand-primary focus:bg-surface transition-all text-gray-700"
            />
          </div>
          <span className="text-xs text-gray-500 font-medium">
            {totalResults} Results
          </span>
        </div>

        {/* Filters, Per Page, Pagination */}
        <div className="flex items-center gap-4 flex-wrap md:flex-nowrap">
          {/* Filter Button */}
          <button className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-gray-300 hover:bg-gray-50 rounded-lg text-xs font-semibold text-gray-600 transition-colors cursor-pointer">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filter</span>
          </button>

          {/* Per Page */}
          <div className="flex items-center gap-2">
            <select
              value={perPage}
              onChange={(e) => setPerPage(Number(e.target.value))}
              className="bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-brand-primary transition-colors"
            >
              {APP_SETTINGS.pagination.options.map(val => (
                <option key={val} value={val}>{val}</option>
              ))}
            </select>
            <span className="text-xs text-gray-500 font-medium">Per Page</span>
          </div>

          <div className="h-4 w-px bg-gray-200 hidden sm:block"></div>

          {/* Pagination */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 font-medium">
              {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
                className="p-1.5 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-transparent text-gray-500 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
                className="p-1.5 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-transparent text-gray-500 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-surface border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-300 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">ID</th>
                <th className="px-6 py-4 font-semibold">Name</th>
                <th className="px-6 py-4 font-semibold">Email</th>
                <th className="px-6 py-4 font-semibold">Role</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-gray-500 font-medium">
                    No users found
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors duration-150">
                    <td className="px-6 py-4 font-medium text-gray-500">{user.id}</td>
                    <td className="px-6 py-4 font-semibold text-gray-900">{user.name}</td>
                    <td className="px-6 py-4 text-gray-500">{user.email}</td>
                    <td className="px-6 py-4 text-gray-700 font-medium">
                      <span className="bg-brand-light text-indigo-700 px-2 py-0.5 rounded-md font-semibold text-[10px]">
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        user.status === "Active"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-250/20"
                          : "bg-gray-50 text-gray-500 border border-gray-300"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${user.status === "Active" ? "bg-emerald-500" : "bg-surface"}`}></span>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => void popupService.alert(`Tính năng sửa người dùng (ID: ${user.id}) đang được phát triển.`)}
                          className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 hover:text-brand-secondary transition-all cursor-pointer"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => void handleDelete(user.id)}
                          className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 hover:text-rose-600 transition-all cursor-pointer"
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
