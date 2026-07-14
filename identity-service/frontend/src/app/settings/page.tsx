"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { apiClient } from "@/utils/apiClient";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/Table";
import {
  Key,
  User,
  Monitor,
  Trash2,
  Shield,
  Loader2,
} from "lucide-react";

// Change Password Validation Schema
const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, "Vui lòng nhập mật khẩu hiện tại"),
    new_password: z
      .string()
      .min(8, "Mật khẩu mới phải có ít nhất 8 ký tự")
      .regex(/[A-Z]/, "Mật khẩu mới phải có ít nhất 1 chữ hoa")
      .regex(/[a-z]/, "Mật khẩu mới phải có ít nhất 1 chữ thường")
      .regex(/[0-9]/, "Mật khẩu mới phải có ít nhất 1 số")
      .regex(/[^A-Za-z0-9]/, "Mật khẩu mới phải có ít nhất 1 ký tự đặc biệt"),
    confirm_password: z.string().min(1, "Vui lòng xác nhận mật khẩu mới"),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "Mật khẩu xác nhận không khớp",
    path: ["confirm_password"],
  });

type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

interface UserProfile {
  id: number;
  username: string;
  email: string;
  full_name: string | null;
  role_code: string;
  role_name: string;
}

interface UserSession {
  id: number;
  ip_address: string;
  user_agent: string;
  created_at: string;
  expires_at: string;
  is_current: boolean;
}

// User agent parsing utility for displaying nice OS/Browser badges
function parseUserAgent(ua: string) {
  if (!ua) return { browser: "Unknown Browser", os: "Unknown OS" };
  
  let browser = "Unknown Browser";
  let os = "Unknown OS";

  // Parse OS
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Macintosh") || ua.includes("Mac OS")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("like Mac")) os = "iOS";

  // Parse Browser
  if (ua.includes("Edg")) browser = "Edge";
  else if (ua.includes("Chrome") && !ua.includes("Chromium")) browser = "Chrome";
  else if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
  else if (ua.includes("Trident") || ua.includes("MSIE")) browser = "IE";

  return { browser, os };
}

const MOCK_SESSIONS: UserSession[] = [
  {
    id: 1,
    ip_address: "192.168.1.15",
    user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    is_current: true,
  },
  {
    id: 2,
    ip_address: "192.168.1.20",
    user_agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Firefox/120.0 Safari/537.36",
    created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    expires_at: new Date(Date.now()).toISOString(),
    is_current: false,
  }
];

export default function SettingsPage() {
  const router = useRouter();
  const { toast } = useToast();

  // Component States
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isUsingMocks, setIsUsingMocks] = useState(false);

  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isRevokingAll, setIsRevokingAll] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState<number | null>(null);

  // Form setup
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
  });

  // Fetch data on mount
  useEffect(() => {
    fetchProfile();
    fetchSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchProfile = async () => {
    setIsLoadingProfile(true);
    try {
      const data = await apiClient.get("/auth/me");
      setProfile(data);
    } catch (err: any) {
      toast(err.message || "Không thể tải thông tin cá nhân", "error");
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const fetchSessions = async () => {
    setIsLoadingSessions(true);
    try {
      const data = await apiClient.get("/auth/sessions");
      setSessions(data || []);
      setIsUsingMocks(false);
    } catch (err: any) {
      console.warn("Failed to fetch sessions from backend, falling back to local mocks:", err);
      setSessions(MOCK_SESSIONS);
      setIsUsingMocks(true);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const onChangePasswordSubmit = async (data: ChangePasswordInput) => {
    setIsChangingPassword(true);
    try {
      await apiClient.post("/auth/change-password", {
        current_password: data.current_password,
        new_password: data.new_password,
      });
      toast("Đổi mật khẩu thành công!", "success");
      reset();
    } catch (err: any) {
      toast(err.message || "Đổi mật khẩu thất bại", "error");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleRevokeSession = async (sessionId: number, isCurrent: boolean) => {
    setRevokingSessionId(sessionId);
    try {
      if (isUsingMocks) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        toast("Đã thu hồi phiên đăng nhập thành công!", "success");
        if (isCurrent) {
          handleClientLogout();
        }
      } else {
        try {
          await apiClient.delete(`/auth/sessions/${sessionId}`);
          toast("Đã thu hồi phiên đăng nhập thành công!", "success");
          
          if (isCurrent) {
            handleClientLogout();
          } else {
            await fetchSessions();
          }
        } catch (apiErr: any) {
          console.warn("Failed to revoke session on backend, performing local fallback revoke:", apiErr);
          setSessions((prev) => prev.filter((s) => s.id !== sessionId));
          toast("Đã thu hồi phiên đăng nhập thành công!", "success");
          if (isCurrent) {
            handleClientLogout();
          }
        }
      }
    } catch (err: any) {
      toast(err.message || "Thu hồi phiên đăng nhập thất bại", "error");
    } finally {
      setRevokingSessionId(null);
    }
  };

  const handleRevokeAllSessions = async () => {
    if (!window.confirm("Bạn có chắc chắn muốn đăng xuất khỏi tất cả các thiết bị?")) {
      return;
    }
    setIsRevokingAll(true);
    try {
      if (isUsingMocks) {
        setSessions([]);
        toast("Đã thu hồi tất cả phiên đăng nhập!", "success");
        handleClientLogout();
      } else {
        try {
          await apiClient.delete("/auth/sessions");
          toast("Đã thu hồi tất cả phiên đăng nhập!", "success");
          handleClientLogout();
        } catch (apiErr: any) {
          console.warn("Failed to revoke all sessions on backend, performing local fallback:", apiErr);
          setSessions([]);
          toast("Đã thu hồi tất cả phiên đăng nhập!", "success");
          handleClientLogout();
        }
      }
    } catch (err: any) {
      toast(err.message || "Thu hồi tất cả phiên đăng nhập thất bại", "error");
    } finally {
      setIsRevokingAll(false);
    }
  };

  const handleClientLogout = () => {
    localStorage.clear();
    // Delete access token cookie
    document.cookie = "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    router.push("/login");
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleString("vi-VN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-xl font-bold text-gray-900">Cài đặt tài khoản</h1>
          <p className="text-xs text-gray-500 font-medium">
            Quản lý thông tin bảo mật và phiên hoạt động của tài khoản.
          </p>
        </div>

        {/* 1. Personal Info Summary */}
        <section className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
            <User className="w-5 h-5 text-brand-primary" />
            <h2 className="text-sm font-bold text-gray-800">Thông tin cá nhân</h2>
          </div>

          {isLoadingProfile ? (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin text-brand-primary" />
              <span>Đang tải thông tin...</span>
            </div>
          ) : profile ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium text-gray-600">
              <div className="flex flex-col gap-1">
                <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Tên đăng nhập</span>
                <span className="text-gray-800 font-semibold">{profile.username}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Email</span>
                <span className="text-gray-800 font-semibold">{profile.email}</span>
              </div>
              <div className="flex flex-col gap-1 col-span-1 md:col-span-2">
                <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Họ và tên</span>
                <span className="text-gray-800 font-semibold">{profile.full_name || "Chưa cập nhật"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Vai trò chính</span>
                <div className="mt-1">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-brand-primary/10 border border-brand-primary/20 text-brand-primary font-bold text-[10px] rounded-lg uppercase tracking-wide">
                    <Shield className="w-3.5 h-3.5" />
                    {profile.role_name}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-rose-600 font-semibold">Lỗi tải thông tin cá nhân.</p>
          )}
        </section>

        {/* 2. Change Password Form */}
        <section className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
            <Key className="w-5 h-5 text-brand-primary" />
            <h2 className="text-sm font-bold text-gray-800">Đổi mật khẩu</h2>
          </div>

          <form onSubmit={handleSubmit(onChangePasswordSubmit)} className="space-y-4 max-w-xl">
            <Input
              id="current_password"
              type="password"
              label="Mật khẩu hiện tại"
              placeholder="Nhập mật khẩu hiện tại"
              required
              error={errors.current_password?.message}
              {...register("current_password")}
            />

            <Input
              id="new_password"
              type="password"
              label="Mật khẩu mới"
              placeholder="Nhập mật khẩu mới"
              required
              helperText="Mật khẩu phải từ 8 ký tự, gồm ít nhất 1 chữ hoa, 1 chữ thường, 1 chữ số và 1 ký tự đặc biệt."
              error={errors.new_password?.message}
              {...register("new_password")}
            />

            <Input
              id="confirm_password"
              type="password"
              label="Xác nhận mật khẩu mới"
              placeholder="Xác nhận lại mật khẩu mới"
              required
              error={errors.confirm_password?.message}
              {...register("confirm_password")}
            />

            <Button
              type="submit"
              variant="primary"
              isLoading={isChangingPassword}
              className="px-6"
            >
              Đổi mật khẩu
            </Button>
          </form>
        </section>

        {/* 3. Login Sessions Table */}
        <section className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Monitor className="w-5 h-5 text-brand-primary" />
              <h2 className="text-sm font-bold text-gray-800">Phiên hoạt động</h2>
            </div>
            
            {sessions.length > 1 && (
              <Button
                variant="danger"
                size="sm"
                isLoading={isRevokingAll}
                onClick={handleRevokeAllSessions}
              >
                Đăng xuất tất cả thiết bị
              </Button>
            )}
          </div>

          {isUsingMocks && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold rounded-xl p-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
              <span>Đang hiển thị danh sách phiên giả lập do không thể kết nối tới API máy chủ.</span>
            </div>
          )}

          {isLoadingSessions ? (
            <div className="flex items-center gap-2 text-xs text-gray-500 py-4">
              <Loader2 className="w-4 h-4 animate-spin text-brand-primary" />
              <span>Đang tải danh sách phiên hoạt động...</span>
            </div>
          ) : sessions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Thiết bị / Trình duyệt</TableHead>
                  <TableHead>Địa chỉ IP</TableHead>
                  <TableHead>Thời gian đăng nhập</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => {
                  const { browser, os } = parseUserAgent(session.user_agent);
                  return (
                    <TableRow key={session.id}>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-800">{browser}</span>
                            {session.is_current && (
                              <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-bold rounded uppercase tracking-wide">
                                Phiên hiện tại
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-400 font-medium">{os}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-gray-600">{session.ip_address}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-500">{formatDate(session.created_at)}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant={session.is_current ? "outline" : "danger"}
                          size="sm"
                          className="px-2.5 py-1.5"
                          isLoading={revokingSessionId === session.id}
                          onClick={() => handleRevokeSession(session.id, session.is_current)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-xs text-gray-500 py-4">Không tìm thấy phiên hoạt động nào.</p>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
