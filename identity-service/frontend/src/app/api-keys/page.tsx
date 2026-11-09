"use client";

import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  Ban,
  Check,
  Copy,
  KeyRound,
  Loader2,
  Plus,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ApiKeyForm, { API_KEY_SCOPES, ApiKeyCreatePayload } from "@/components/api-keys/ApiKeyForm";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { apiClient } from "@/utils/apiClient";
import { useToast } from "@/components/ui/Toast";

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  last4: string;
  seller_id: string;
  seller_name: string | null;
  scopes: string[];
  created_by_username: string | null;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  expires_at: string | null;
  status: "active" | "revoked" | "expired";
}

interface CreatedApiKey extends ApiKey {
  key: string;
}

interface Seller {
  id: string;
  name: string;
  tax_code: string;
  is_active: boolean;
}

// Backend timestamps are naive UTC.
const formatDate = (value: string | null) =>
  value ? new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`).toLocaleString("vi-VN") : null;

const scopeLabel = (scope: string) =>
  API_KEY_SCOPES.find((s) => s.value === scope)?.label || scope;

function StatusBadge({ status }: { status: ApiKey["status"] }) {
  const styles = {
    active: "bg-green-100 text-green-800 border-green-200",
    revoked: "bg-red-100 text-red-800 border-red-200",
    expired: "bg-gray-100 text-gray-600 border-gray-200",
  };
  const labels = { active: "Đang hoạt động", revoked: "Đã thu hồi", expired: "Đã hết hạn" };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

export default function ApiKeysPage() {
  const { toast } = useToast();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<CreatedApiKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState<ApiKey | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [keysData, sellersData] = await Promise.all([
        apiClient.get("/api-keys/"),
        apiClient.get("/sellers/"),
      ]);
      setApiKeys(Array.isArray(keysData) ? keysData : []);
      setSellers(Array.isArray(sellersData) ? sellersData : []);
    } catch (err: any) {
      toast(err.message || "Không thể tải danh sách API key", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (payload: ApiKeyCreatePayload) => {
    const created: CreatedApiKey = await apiClient.post("/api-keys/", payload);
    const { key: _secret, ...listed } = created;
    setApiKeys((prev) => [listed as ApiKey, ...prev]);
    setIsCreateOpen(false);
    setCopied(false);
    setCreatedKey(created);
  };

  const handleCopy = async () => {
    if (!createdKey) return;
    try {
      await navigator.clipboard.writeText(createdKey.key);
      setCopied(true);
      toast("Đã sao chép API key", "success");
    } catch {
      toast("Không thể sao chép tự động, hãy chọn và sao chép thủ công", "warning");
    }
  };

  const closeCreatedKey = () => {
    if (!copied && !window.confirm("Bạn chưa sao chép API key. Sau khi đóng sẽ không thể xem lại. Vẫn đóng?")) {
      return;
    }
    setCreatedKey(null);
    setCopied(false);
  };

  const handleRevoke = async () => {
    if (!revoking) return;
    setIsRevoking(true);
    try {
      const updated: ApiKey = await apiClient.post(`/api-keys/${revoking.id}/revoke`);
      setApiKeys((prev) => prev.map((k) => (k.id === updated.id ? updated : k)));
      toast(`Đã thu hồi API key "${revoking.name}"`, "success");
      setRevoking(null);
    } catch (err: any) {
      toast(err.message || "Không thể thu hồi API key", "error");
    } finally {
      setIsRevoking(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex flex-col gap-1 text-left">
            <h1 className="text-xl font-bold text-gray-900">API key</h1>
            <p className="text-xs text-gray-500 font-semibold">
              Cấp khoá truy cập theo từng nhà bán hàng cho ứng dụng bên ngoài (ví dụ VOMA Insights). Chỉ quản trị viên tenant được thao tác.
            </p>
          </div>
          <Button
            variant="primary"
            leftIcon={<Plus className="w-4 h-4" />}
            className="w-full sm:w-auto"
            onClick={() => setIsCreateOpen(true)}
            disabled={isLoading}
          >
            Tạo API key
          </Button>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
            <span className="text-xs text-gray-400 font-bold">Đang tải danh sách API key...</span>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {apiKeys.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tên / Mã nhận diện</TableHead>
                    <TableHead>Nhà bán hàng</TableHead>
                    <TableHead>Quyền</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Dùng lần cuối</TableHead>
                    <TableHead>Tạo lúc</TableHead>
                    <TableHead className="text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiKeys.map((apiKey) => (
                    <TableRow key={apiKey.id}>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold text-gray-800">{apiKey.name}</span>
                          <code className="text-[10px] text-gray-400 font-medium">
                            {apiKey.prefix}…{apiKey.last4}
                          </code>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-700 font-medium">{apiKey.seller_name || apiKey.seller_id}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {apiKey.scopes.map((scope) => (
                            <span
                              key={scope}
                              className="inline-flex w-fit items-center px-2 py-0.5 rounded-lg bg-brand-primary/10 text-brand-primary text-[10px] font-bold"
                            >
                              {scopeLabel(scope)}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <StatusBadge status={apiKey.status} />
                          {apiKey.expires_at && apiKey.status === "active" && (
                            <span className="text-[10px] text-gray-400">Hết hạn: {formatDate(apiKey.expires_at)}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-400 text-xs">
                          {formatDate(apiKey.last_used_at) || "Chưa sử dụng"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5 text-xs text-gray-400">
                          <span>{formatDate(apiKey.created_at)}</span>
                          {apiKey.created_by_username && <span>bởi {apiKey.created_by_username}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {apiKey.status !== "revoked" && (
                          <Button
                            variant="danger"
                            size="sm"
                            leftIcon={<Ban className="w-3.5 h-3.5" />}
                            onClick={() => setRevoking(apiKey)}
                          >
                            Thu hồi
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="py-12 flex flex-col items-center text-gray-400 gap-2">
                <KeyRound className="w-8 h-8" />
                <span className="text-xs font-semibold">Chưa có API key nào</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Tạo API key mới">
        {sellers.length === 0 ? (
          <p className="text-xs text-gray-500 font-semibold">
            Tenant của bạn chưa có nhà bán hàng nào nên chưa thể tạo API key.
          </p>
        ) : (
          <ApiKeyForm sellers={sellers} onSubmit={handleCreate} onCancel={() => setIsCreateOpen(false)} />
        )}
      </Modal>

      {/* One-time display of the full key */}
      <Modal
        isOpen={createdKey !== null}
        onClose={closeCreatedKey}
        closeOnOverlayClick={false}
        title="API key đã được tạo"
        footer={
          <Button variant="primary" onClick={closeCreatedKey}>
            Tôi đã lưu key
          </Button>
        }
      >
        {createdKey && (
          <div className="space-y-4">
            <div className="flex gap-3 p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-xs font-semibold leading-relaxed">
                Đây là lần DUY NHẤT key được hiển thị đầy đủ. Hãy sao chép và lưu vào nơi an toàn
                (ví dụ trang Kết nối của VOMA Insights) ngay bây giờ. Hệ thống chỉ lưu bản băm nên không thể
                xem lại; nếu làm mất, hãy thu hồi và tạo key mới. Không gửi key qua chat/email.
              </p>
            </div>
            <div>
              <label htmlFor="created-api-key" className="block text-xs font-bold text-gray-700 mb-1.5">
                API key cho &quot;{createdKey.name}&quot;
              </label>
              <div className="flex gap-2">
                <input
                  id="created-api-key"
                  readOnly
                  value={createdKey.key}
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 min-w-0 px-3 py-2.5 text-xs font-mono rounded-xl border border-gray-300 bg-gray-50 text-gray-900"
                />
                <Button
                  variant={copied ? "secondary" : "primary"}
                  leftIcon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  onClick={handleCopy}
                >
                  {copied ? "Đã sao chép" : "Sao chép"}
                </Button>
              </div>
            </div>
            <p className="text-[11px] text-gray-500">
              Gửi kèm header <code>X-API-Key</code> khi gọi Gateway. Quyền:{" "}
              {createdKey.scopes.map(scopeLabel).join(", ")}.
            </p>
          </div>
        )}
      </Modal>

      {/* Revoke confirmation */}
      <Modal
        isOpen={revoking !== null}
        onClose={() => setRevoking(null)}
        size="sm"
        title="Thu hồi API key"
        footer={
          <>
            <Button variant="outline" onClick={() => setRevoking(null)} disabled={isRevoking}>
              Huỷ
            </Button>
            <Button variant="danger" onClick={handleRevoke} isLoading={isRevoking}>
              Thu hồi
            </Button>
          </>
        }
      >
        {revoking && (
          <p className="text-xs font-semibold text-gray-700">
            Thu hồi key &quot;{revoking.name}&quot; ({revoking.prefix}…{revoking.last4})? Mọi ứng dụng đang dùng key
            này sẽ bị từ chối ngay lập tức. Thao tác không thể hoàn tác.
          </p>
        )}
      </Modal>
    </DashboardLayout>
  );
}
