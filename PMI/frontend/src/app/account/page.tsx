"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Camera, ChevronUp, ChevronDown, Check } from "lucide-react";

export default function AccountPage() {
  const [name, setName] = useState("Example");
  const [email, setEmail] = useState("admin@example.com");
  const [uiLocale, setUiLocale] = useState("en_US");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [isPasswordCollapsed, setIsPasswordCollapsed] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
    }, 3000);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-700/60 pb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">My Account</h1>
          <p className="text-xs text-slate-400 mt-1">Manage your account information and preferences</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-slate-300 hover:text-slate-900 bg-slate-800 hover:bg-slate-200/80 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </Link>
          <button
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-750 text-white text-xs font-semibold rounded-lg shadow-md shadow-indigo-600/10 hover:shadow-indigo-500/20 transition-all duration-200 active:scale-95"
          >
            {isSaved ? (
              <>
                <Check className="w-3.5 h-3.5 animate-bounce" />
                <span>Saved Successfully</span>
              </>
            ) : (
              <span>Save Account</span>
            )}
          </button>
        </div>
      </div>

      {/* Main Grid Forms */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* General Settings Column */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-sm p-6 space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h2 className="text-sm font-bold text-slate-100 tracking-wide">General</h2>
          </div>

          <form onSubmit={handleSave} className="space-y-5">
            {/* Avatar Section */}
            <div className="space-y-2">
              <div className="w-28 h-28 border-2 border-dashed border-slate-700 rounded-xl flex flex-col items-center justify-center bg-slate-950/50 hover:bg-slate-950 cursor-pointer transition-colors group relative overflow-hidden">
                <Camera className="w-5 h-5 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                <span className="text-[10px] font-bold text-slate-400 mt-1.5 group-hover:text-indigo-500 transition-colors">Add Image</span>
                <span className="text-[8px] text-slate-400 mt-0.5">png, jpeg, jpg</span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">Upload a Profile Image (110px x 110px)</p>
            </div>

            {/* Name Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-slate-950/30 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-slate-900 transition-all"
              />
            </div>

            {/* Email Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400">Email *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-slate-950/30 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-slate-900 transition-all"
              />
            </div>

            {/* UI Locale Select */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400">UI Locale *</label>
              <select
                value={uiLocale}
                onChange={(e) => setUiLocale(e.target.value)}
                className="w-full bg-slate-950/30 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 focus:bg-slate-900 transition-all"
              >
                <option value="en_US">English (United States)</option>
                <option value="vi_VN">Tiếng Việt (Việt Nam)</option>
              </select>
            </div>

            {/* Timezone Select */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400">Timezone *</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full bg-slate-950/30 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 focus:bg-slate-900 transition-all"
              >
                <option value="Asia/Kolkata">Asia/Kolkata (+05:30)</option>
                <option value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh (+07:00)</option>
                <option value="UTC">UTC (Coordinated Universal Time)</option>
              </select>
            </div>
          </form>
        </div>

        {/* Change Password Column */}
        <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-sm overflow-hidden">
          <button
            onClick={() => setIsPasswordCollapsed(!isPasswordCollapsed)}
            className="w-full px-6 py-5 flex items-center justify-between border-b border-slate-800 bg-slate-950/30 hover:bg-slate-950 transition-colors"
          >
            <h2 className="text-sm font-bold text-slate-100 tracking-wide text-left">Change Password</h2>
            {isPasswordCollapsed ? (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {!isPasswordCollapsed && (
            <div className="p-6 space-y-5 animate-in slide-in-from-top-2 duration-200">
              {/* Current Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400">Current Password *</label>
                <input
                  type="password"
                  placeholder="Current Password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full bg-slate-950/30 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-slate-900 transition-all"
                />
              </div>

              {/* New Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400">Password</label>
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950/30 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-slate-900 transition-all"
                />
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400">Confirm Password</label>
                <input
                  type="password"
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-950/30 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-slate-900 transition-all"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
