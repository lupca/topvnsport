import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi, beforeEach } from "vitest";
import AuditLogPage from "@/app/settings/audit/page";

const mockPush = vi.fn();

// Mock next/navigation at the top level
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
    vi.restoreAllMocks();
    mockPush.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/audit-logs")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockAuditLogs)
          });
        }
        return Promise.reject(new Error("Unknown URL: " + url));
      })
    );
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
    try {
      const AuditPage = await getAuditPage();
      render(React.createElement(AuditPage, { userRole: "admin" }));
      await waitFor(() => {
        expect(screen.getByText("Lịch sử hoạt động")).toBeInTheDocument();
      });
    } catch (e: any) {
      expect.fail(e.message);
    }
  });

  test("37. Non-admin role (e.g. Staff) does not see the sidebar link", async () => {
    try {
      const Sidebar = await getSidebar();
      render(React.createElement(Sidebar, { userRole: "staff" }));
      expect(screen.queryByText("Lịch sử hoạt động")).not.toBeInTheDocument();
    } catch (e: any) {
      expect.fail(e.message);
    }
  });

  test("38. Table displays columns: Timestamp, Actor, Action, Entity, Changes", async () => {
    try {
      const AuditPage = await getAuditPage();
      render(React.createElement(AuditPage));
      await waitFor(() => {
        expect(screen.getByText("Thời gian")).toBeInTheDocument();
        expect(screen.getByText("Tác nhân")).toBeInTheDocument();
        expect(screen.getByText("Hành động")).toBeInTheDocument();
        expect(screen.getByText("Đối tượng")).toBeInTheDocument();
        expect(screen.getByText("Thay đổi")).toBeInTheDocument();
      });
    } catch (e: any) {
      expect.fail(e.message);
    }
  });

  test("39. Table displays server-side paginated logs correctly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/audit-logs")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ ...mockAuditLogs, total: 100 })
          });
        }
        return Promise.reject(new Error("Unknown URL: " + url));
      })
    );
    const fetchSpy = vi.spyOn(global, "fetch");
    try {
      const AuditPage = await getAuditPage();
      render(React.createElement(AuditPage));
      
      // Verify pagination component exists and triggers new fetch
      await waitFor(() => {
        expect(screen.getByText("Trang sau")).toBeInTheDocument();
      });

      // Clear previous calls before clicking pagination
      fetchSpy.mockClear();
      
      await userEvent.click(screen.getByText("Trang sau"));

      // Check if ANY fetch call contains page=2 (more resilient)
      await waitFor(() => {
        const calledWithPage2 = fetchSpy.mock.calls.some(([input]) =>
          String(input).includes("page=2")
        );
        expect(calledWithPage2).toBe(true);
      });
    } finally {
      fetchSpy.mockRestore();
    }
  });

  test("40. Table renders semantic diffs (before/after changes) cleanly", async () => {
    try {
      const AuditPage = await getAuditPage();
      render(React.createElement(AuditPage));
      await waitFor(() => {
        expect(screen.getByText("Old Name")).toBeInTheDocument();
        expect(screen.getByText("New Name")).toBeInTheDocument();
      });
    } catch (e: any) {
      expect.fail(e.message);
    }
  });

  test("76. Direct URL access to /settings/audit by non-admin redirects to /", async () => {
    try {
      const AuditPage = await getAuditPage();
      render(React.createElement(AuditPage, { userRole: "staff" }));
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/");
      });
    } catch (e: any) {
      expect.fail(e.message);
    }
  });

  test("77. Empty log state displays correct empty state placeholder", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [], total: 0 })
        })
      )
    );
    try {
      const AuditPage = await getAuditPage();
      render(React.createElement(AuditPage));
      await waitFor(() => {
        expect(screen.getByText("Không có lịch sử hoạt động nào")).toBeInTheDocument();
      });
    } catch (e: any) {
      expect.fail(e.message);
    }
  });

  test("78. Filters update query params and trigger log re-fetching", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    try {
      const AuditPage = await getAuditPage();
      render(React.createElement(AuditPage));
      await waitFor(() => {
        expect(screen.getByPlaceholderText("Lọc theo tác nhân...")).toBeInTheDocument();
      });
      await userEvent.type(screen.getByPlaceholderText("Lọc theo tác nhân..."), "john");
      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining("actor=john"), expect.any(Object));
      });
    } catch (e: any) {
      expect.fail(e.message);
    }
  });

  test("79. Row selection opens detailed view showing raw JSON changes", async () => {
    try {
      const AuditPage = await getAuditPage();
      render(React.createElement(AuditPage));
      await waitFor(() => {
        expect(screen.getByText("admin")).toBeInTheDocument();
      });
      await userEvent.click(screen.getByText("admin"));
      await waitFor(() => {
        expect(screen.getByText(/"correlation_id": "uuid-1"/)).toBeInTheDocument();
      });
    } catch (e: any) {
      expect.fail(e.message);
    }
  });

  test("80. Network failure displays user-friendly error toast", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => Promise.reject(new Error("Network Error")))
    );
    try {
      const AuditPage = await getAuditPage();
      render(React.createElement(AuditPage));
      await waitFor(() => {
        expect(screen.getByText("Không thể tải lịch sử hoạt động")).toBeInTheDocument();
      });
    } catch (e: any) {
      expect.fail(e.message);
    }
  });

  test("81a. Polling for updates silently every 1.5 seconds triggers background fetches", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    try {
      const AuditPage = await getAuditPage();
      render(React.createElement(AuditPage, { userRole: "admin" }));
      
      await waitFor(() => {
        expect(screen.getByText("Thời gian")).toBeInTheDocument();
      });

      // Clear the initial fetch calls
      fetchSpy.mockClear();

      // Wait 1.6 seconds for real polling check
      await new Promise((resolve) => setTimeout(resolve, 1600));

      // Verify that fetch was called again silently
      expect(fetchSpy).toHaveBeenCalled();
    } finally {
      // no cleanup
    }
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

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/audit-logs")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(customAuditLogs)
          });
        }
        return Promise.reject(new Error("Unknown URL: " + url));
      })
    );

    try {
      const AuditPage = await getAuditPage();
      render(React.createElement(AuditPage));

      await waitFor(() => {
        expect(screen.getByText("Custom manual modification")).toBeInTheDocument();
        expect(screen.getByText("Không có thay đổi dữ liệu")).toBeInTheDocument();
      });
    } catch (e: any) {
      expect.fail(e.message);
    }
  });
});

