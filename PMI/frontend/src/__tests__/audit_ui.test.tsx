import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi, beforeEach } from "vitest";

const { mockFetchWithAuth, mockApiClient } = vi.hoisted(() => ({
  mockFetchWithAuth: vi.fn(),
  mockApiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/utils/apiClient", () => ({
  fetchWithAuth: mockFetchWithAuth,
  apiClient: mockApiClient,
}));

import AuditLogPage from "@/app/settings/audit/page";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({}),
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => "/settings/audit",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/ui/popupService", () => ({
  popupService: {
    alert: vi.fn(),
    toast: vi.fn(),
  },
}));

const mockAuditLogs = {
  data: [
    {
      id: 1,
      timestamp: "2026-07-12T10:00:00Z",
      actor_username: "admin",
      actor_type: "USER",
      action: "UPDATE",
      entity_name: "Product",
      entity_id: "123",
      changes: { name: ["Old Name", "New Name"] },
      ip_address: "127.0.0.1",
      correlation_id: "uuid-1"
    }
  ],
  total: 1,
  page: 1,
  limit: 10
};

describe("Audit Log UI Component Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockClear();

    mockFetchWithAuth.mockImplementation((url: string) => {
      if (/audit-logs/.test(url)) {
        return Promise.resolve(mockAuditLogs);
      }
      return Promise.resolve([]);
    });
  });

  const getAuditPage = async () => {
    return AuditLogPage;
  };

  const getSidebar = async () => {
    const sidebarPath = "@/components/layout/Sidebar";
    const mod = await import(/* @vite-ignore */ sidebarPath);
    return mod.default;
  };

  test("36. Admin role user sees 'Lịch sử hoạt động' sidebar link and page", async () => {
    const AuditPage = await getAuditPage();
    render(React.createElement(AuditPage, { userRole: "admin" }));
    await waitFor(() => {
      expect(screen.getByText("Lịch sử hoạt động")).toBeInTheDocument();
    });
  });

  test("37. Non-admin role (e.g. Staff) does not see the sidebar link", async () => {
    const Sidebar = await getSidebar();
    render(React.createElement(Sidebar, { userRole: "staff" }));
    expect(screen.queryByText("Lịch sử hoạt động")).not.toBeInTheDocument();
  });

  test("38. Table displays columns: Timestamp, Actor, Action, Entity, Changes", async () => {
    const AuditPage = await getAuditPage();
    render(React.createElement(AuditPage));
    await waitFor(() => {
      expect(screen.getByText("Thời gian")).toBeInTheDocument();
      expect(screen.getByText("Tác nhân")).toBeInTheDocument();
      expect(screen.getByText("Hành động")).toBeInTheDocument();
      expect(screen.getByText("Đối tượng")).toBeInTheDocument();
      expect(screen.getByText("Thay đổi")).toBeInTheDocument();
    });
  });

  test("39. Table displays server-side paginated logs correctly", async () => {
    mockFetchWithAuth.mockImplementation((url: string) => {
      if (/audit-logs/.test(url)) {
        return Promise.resolve({ ...mockAuditLogs, total: 100 });
      }
      return Promise.resolve([]);
    });

    const AuditPage = await getAuditPage();
    render(React.createElement(AuditPage));

    await waitFor(() => {
      expect(screen.getByText("Trang sau")).toBeInTheDocument();
    });

    mockFetchWithAuth.mockClear();

    await userEvent.click(screen.getByText("Trang sau"));

    await waitFor(() => {
      const calledWithPage2 = mockFetchWithAuth.mock.calls.some(([input]) =>
        String(input).includes("page=2")
      );
      expect(calledWithPage2).toBe(true);
    });
  });

  test("40. Table renders semantic diffs (before/after changes) cleanly", async () => {
    const AuditPage = await getAuditPage();
    render(React.createElement(AuditPage));
    await waitFor(() => {
      expect(screen.getByText("Old Name")).toBeInTheDocument();
      expect(screen.getByText("New Name")).toBeInTheDocument();
    });
  });

  test("76. Direct URL access to /settings/audit by non-admin redirects to /", async () => {
    const AuditPage = await getAuditPage();
    render(React.createElement(AuditPage, { userRole: "staff" }));
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });

  test("77. Empty log state displays correct empty state placeholder", async () => {
    mockFetchWithAuth.mockImplementation(() =>
      Promise.resolve({ data: [], total: 0 })
    );

    const AuditPage = await getAuditPage();
    render(React.createElement(AuditPage));
    await waitFor(() => {
      expect(screen.getByText("Không có lịch sử hoạt động nào")).toBeInTheDocument();
    });
  });

  test("78. Filters update query params and trigger log re-fetching", async () => {
    const AuditPage = await getAuditPage();
    render(React.createElement(AuditPage));
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Lọc theo tác nhân...")).toBeInTheDocument();
    });
    await userEvent.type(screen.getByPlaceholderText("Lọc theo tác nhân..."), "john");
    await waitFor(() => {
      expect(mockFetchWithAuth).toHaveBeenCalledWith(expect.stringContaining("actor=john"));
    });
  });

  test("79. Row selection opens detailed view showing raw JSON changes", async () => {
    const AuditPage = await getAuditPage();
    render(React.createElement(AuditPage));
    await waitFor(() => {
      expect(screen.getByText("admin")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText("admin"));
    await waitFor(() => {
      expect(screen.getByText(/"correlation_id": "uuid-1"/)).toBeInTheDocument();
    });
  });

  test("80. Network failure displays user-friendly error toast", async () => {
    mockFetchWithAuth.mockImplementation(() => Promise.reject(new Error("Network Error")));

    const AuditPage = await getAuditPage();
    render(React.createElement(AuditPage));
    await waitFor(() => {
      expect(screen.getByText("Không thể tải lịch sử hoạt động")).toBeInTheDocument();
    });
  });

  test("81a. Polling for updates silently every 1.5 seconds triggers background fetches", async () => {
    const AuditPage = await getAuditPage();
    render(React.createElement(AuditPage, { userRole: "admin" }));

    await waitFor(() => {
      expect(screen.getByText("Thời gian")).toBeInTheDocument();
    });

    mockFetchWithAuth.mockClear();

    await new Promise((resolve) => setTimeout(resolve, 1600));

    expect(mockFetchWithAuth).toHaveBeenCalled();
  });

  test("81e. Table renderChanges handles different detail format inputs gracefully", async () => {
    const customAuditLogs = {
      data: [
        {
          id: 101,
          timestamp: "2026-07-12T10:00:00Z",
          actor_username: "admin",
          action: "UPDATE",
          entity_name: "Product",
          changes: null,
        },
        {
          id: 102,
          timestamp: "2026-07-12T10:00:00Z",
          actor_username: "admin",
          action: "UPDATE",
          entity_name: "Product",
          changes: { raw_details: "Custom manual modification" },
        },
        {
          id: 103,
          timestamp: "2026-07-12T10:00:00Z",
          actor_username: "admin",
          action: "UPDATE",
          entity_name: "Product",
          changes: { before: { name: "Old" }, after: { name: "Old" } },
        }
      ],
      total: 3,
      page: 1,
      limit: 10
    };

    mockFetchWithAuth.mockImplementation((url: string) => {
      if (/audit-logs/.test(url)) {
        return Promise.resolve(customAuditLogs);
      }
      return Promise.resolve([]);
    });

    const AuditPage = await getAuditPage();
    render(React.createElement(AuditPage));

    await waitFor(() => {
      expect(screen.getByText("Custom manual modification")).toBeInTheDocument();
      expect(screen.getByText("Không có thay đổi dữ liệu")).toBeInTheDocument();
    });
  });
});
