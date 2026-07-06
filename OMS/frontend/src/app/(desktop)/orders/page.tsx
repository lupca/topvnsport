"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  api,
  Order,
  Customer,
  Channel,
  ProductSearchResult,
  OrderItemInput
} from "@/utils/api";
import { popupService, showConfirm } from "@/components/ui/popupService";

const orderSchema = z.object({
  customer_id: z.number().min(1, "Vui lòng chọn khách hàng"),
  channel_id: z.number().min(1, "Vui lòng chọn kênh bán hàng"),
  shipping_address: z.string().min(1, "Địa chỉ giao hàng là bắt buộc"),
  shipping_fee: z.number().min(0, "Phí giao hàng không được âm").default(0),
  note: z.string().optional()
});
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  X,
  AlertCircle,
  ShoppingCart,
  Users,
  MapPin,
  Calendar,
  DollarSign,
  FileText,
  Package
} from "lucide-react";

// Status to Badge color helper
const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case "DRAFT":
      return "bg-gray-100 text-gray-700 border-gray-300";
    case "CONFIRMED":
    case "PROCESSING":
    case "PICKING":
    case "PACKED":
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    case "SHIPPED":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "COMPLETED":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "CANCELLED":
      return "bg-rose-50 text-rose-700 border-rose-200";
    default:
      return "bg-gray-100 text-gray-600 border-gray-300";
  }
};

const ORDER_STATUS_STEPS = [
  "DRAFT",
  "CONFIRMED",
  "PROCESSING",
  "PICKING",
  "PACKED",
  "SHIPPED",
  "COMPLETED"
];

interface StockCheckResponse {
  sufficient: boolean;
  message: string;
}

function OrdersPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL State Synchronisation
  const paramView = searchParams.get("view") || "list";
  const paramId = searchParams.get("id");

  const [view, setView] = useState<string>(paramView);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(
    paramId ? parseInt(paramId, 10) : null
  );

  // Synchronise state with URL params
  useEffect(() => {
    setView(paramView);
    if (paramId) {
      setSelectedOrderId(parseInt(paramId, 10));
    } else {
      setSelectedOrderId(null);
    }
  }, [paramView, paramId]);

  const updateURL = (newView: string, id: number | null = null) => {
    const params = new URLSearchParams();
    params.set("view", newView);
    if (id) {
      params.set("id", id.toString());
    }
    router.push(`/orders?${params.toString()}`);
  };

  // --- LIST VIEW STATE ---
  const [orders, setOrders] = useState<Order[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [listLoading, setListLoading] = useState(true);
  
  // Filters
  const [filterSearch, setFilterSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterChannel, setFilterChannel] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [stockWarnings, setStockWarnings] = useState<Record<number, string>>({});

  // --- DETAIL VIEW STATE ---
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // --- FORM VIEW STATE ---
  const [formCustomer, setFormCustomer] = useState<Customer | null>(null);
  const [formChannelId, setFormChannelId] = useState<number | null>(null);
  const [formShippingAddress, setFormShippingAddress] = useState("");
  const [formShippingFee, setFormShippingFee] = useState(0);
  const [formNote, setFormNote] = useState("");

  const { register, handleSubmit, setValue, formState: { errors }, reset } = useForm({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      customer_id: 0,
      channel_id: 0,
      shipping_address: "",
      shipping_fee: 0,
      note: ""
    }
  });
  const [formItems, setFormItems] = useState<Array<{
    sku_code: string;
    product_name: string;
    variant_name?: string;
    quantity: number;
    price: number;
    image_url?: string;
  }>>([]);
  const [formError, setFormError] = useState<string | null>(null);

  // Modals inside Form
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);

  // Customer Modal state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newCustomerAddress, setNewCustomerAddress] = useState("");

  // Product Modal state
  const [productSearch, setProductSearch] = useState("");
  const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([]);
  const [productSearchLoading, setProductSearchLoading] = useState(false);

  // --- FETCHING ACTIONS ---

  const fetchOrders = async () => {
    try {
      setListLoading(true);
      let query = `/orders?page=${currentPage}&limit=10`;
      if (filterStatus) query += `&status=${filterStatus}`;
      if (filterChannel) query += `&channel_id=${filterChannel}`;
      if (filterDate) query += `&date=${filterDate}`;
      if (filterSearch) query += `&search=${encodeURIComponent(filterSearch)}`;

      const data = await api.get<{
        items: Order[];
        total: number;
        page: number;
        pages: number;
      }>(query);

      setOrders(data.items || []);
      setTotalPages(data.pages || 1);
      setTotalCount(data.total || 0);
      setStockWarnings((prev) => {
        const next: Record<number, string> = {};
        for (const order of data.items || []) {
          if (prev[order.id]) {
            next[order.id] = prev[order.id];
          }
        }
        return next;
      });
    } catch (err) {
      console.error("Failed to fetch orders:", err);
    } finally {
      setListLoading(false);
    }
  };

  const fetchChannels = async () => {
    try {
      const res = await api.get<any>("/channels?limit=100");
      setChannels(res.items || []);
    } catch (err) {
      console.error("Failed to fetch channels:", err);
    }
  };

  useEffect(() => {
    fetchChannels();
  }, []);

  useEffect(() => {
    if (view === "list") {
      fetchOrders();
    }
  }, [view, currentPage, filterStatus, filterChannel, filterDate, filterSearch]);

  // Load Order Details
  useEffect(() => {
    if ((view === "detail" || view === "edit") && selectedOrderId) {
      loadOrderDetails(selectedOrderId);
    }
  }, [view, selectedOrderId]);

  const loadOrderDetails = async (id: number) => {
    try {
      setDetailLoading(true);
      setFormError(null);
      const data = await api.get<Order>(`/orders/${id}`);
      let resolvedCustomer = data.customer || null;
      if (!resolvedCustomer && data.customer_id) {
        try {
          resolvedCustomer = await api.get<Customer>(`/customers/${data.customer_id}`);
        } catch {
          resolvedCustomer = null;
        }
      }

      let resolvedChannel = data.channel || null;
      if (!resolvedChannel && data.channel_id) {
        try {
          resolvedChannel = await api.get<Channel>(`/channels/${data.channel_id}`);
        } catch {
          resolvedChannel = null;
        }
      }

      setCurrentOrder({
        ...data,
        customer: resolvedCustomer || undefined,
        channel: resolvedChannel || undefined
      });
      
      if (view === "edit") {
        setFormCustomer(resolvedCustomer || null);
        setFormChannelId(data.channel_id);
        setFormShippingAddress(data.shipping_address);
        setFormShippingFee(Number(data.shipping_fee));
        setFormNote(data.note || "");

        setValue("customer_id", data.customer_id);
        setValue("channel_id", data.channel_id);
        setValue("shipping_address", data.shipping_address);
        setValue("shipping_fee", Number(data.shipping_fee));
        setValue("note", data.note || "");
        
        // Map OrderItems to form format
        const mapped = data.items.map((item) => ({
          sku_code: item.sku_code,
          product_name: item.product_name,
          variant_name: item.variant_name,
          quantity: item.quantity,
          price: Number(item.unit_price),
          image_url: item.image_url
        }));
        setFormItems(mapped);
      }
    } catch (err: any) {
      console.error("Failed to load order:", err);
      setFormError(err.message || "Không thể tải chi tiết đơn hàng.");
    } finally {
      setDetailLoading(false);
    }
  };

  // --- CUSTOMER LOOKUP ACTIONS ---
  const loadCustomers = async () => {
    try {
      const res = await api.get<any>("/customers?limit=100");
      setCustomers(res.items || []);
    } catch (err) {
      console.error("Failed to load customers:", err);
    }
  };

  useEffect(() => {
    if (isCustomerModalOpen) {
      loadCustomers();
    }
  }, [isCustomerModalOpen]);

  const handleSelectCustomer = (customer: Customer) => {
    setFormCustomer(customer);
    setFormShippingAddress(customer.address || "");
    setValue("customer_id", customer.id, { shouldValidate: true });
    setValue("shipping_address", customer.address || "", { shouldValidate: true });
    setIsCustomerModalOpen(false);
  };

  const handleCreateCustomerQuick = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName || !newCustomerPhone) {
      void popupService.alert("Vui lòng điền tên và số điện thoại.");
      return;
    }
    try {
      const newCust = await api.post<Customer>("/customers", {
        name: newCustomerName,
        phone: newCustomerPhone,
        email: newCustomerEmail || undefined,
        address: newCustomerAddress || undefined
      });
      setFormCustomer(newCust);
      setFormShippingAddress(newCust.address || "");
      setValue("customer_id", newCust.id, { shouldValidate: true });
      setValue("shipping_address", newCust.address || "", { shouldValidate: true });
      
      // Reset quick modal fields
      setNewCustomerName("");
      setNewCustomerPhone("");
      setNewCustomerEmail("");
      setNewCustomerAddress("");
      setIsNewCustomerModalOpen(false);
      setIsCustomerModalOpen(false);
    } catch (err: any) {
      void popupService.alert("Tạo nhanh khách hàng thất bại: " + err.message);
    }
  };

  // --- PRODUCT SEARCH ACTIONS ---
  const handleProductSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productSearch) return;
    try {
      setProductSearchLoading(true);
      const data = await api.get<ProductSearchResult[]>(
        `/products/search?q=${encodeURIComponent(productSearch)}&search=${encodeURIComponent(productSearch)}`
      );
      setSearchResults(data || []);
    } catch (err) {
      console.error("Failed to search products:", err);
    } finally {
      setProductSearchLoading(false);
    }
  };

  const handleAddProductItem = (
    skuCode: string,
    prodName: string,
    variantName: string | undefined,
    price: number,
    imageUrl: string | undefined
  ) => {
    // Check if product SKU already in items
    const existingIdx = formItems.findIndex((it) => it.sku_code === skuCode);
    if (existingIdx > -1) {
      const updated = [...formItems];
      updated[existingIdx].quantity += 1;
      setFormItems(updated);
    } else {
      setFormItems([
        ...formItems,
        {
          sku_code: skuCode,
          product_name: prodName,
          variant_name: variantName,
          quantity: 1,
          price: price,
          image_url: imageUrl
        }
      ]);
    }
    setIsProductModalOpen(false);
  };

  const handleRemoveItem = (skuCode: string) => {
    setFormItems(formItems.filter((item) => item.sku_code !== skuCode));
  };

  const handleQuantityChange = (skuCode: string, amount: number) => {
    setFormItems(
      formItems.map((item) => {
        if (item.sku_code === skuCode) {
          const newQty = Math.max(1, item.quantity + amount);
          return { ...item, quantity: newQty };
        }
        return item;
      })
    );
  };

  // Calculate totals
  const subtotal = formItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalAmount = subtotal + formShippingFee;

  // --- SUBMIT DRAFT ORDER ---
  const handleSaveOrder = async (data: any) => {
    if (formItems.length === 0) {
      setFormError("Vui lòng thêm ít nhất một sản phẩm.");
      return;
    }

    const itemInputs: OrderItemInput[] = formItems.map((it) => ({
      sku_code: it.sku_code,
      quantity: it.quantity
    }));

    try {
      setFormError(null);
      if (view === "create") {
        await api.post("/orders", {
          customer_id: data.customer_id,
          channel_id: data.channel_id,
          shipping_fee: data.shipping_fee,
          shipping_address: data.shipping_address,
          note: data.note || undefined,
          created_by: "OMS Desktop Client",
          items: itemInputs
        });
      } else if (view === "edit" && selectedOrderId) {
        await api.put(`/orders/${selectedOrderId}`, {
          customer_id: data.customer_id,
          channel_id: data.channel_id,
          shipping_fee: data.shipping_fee,
          shipping_address: data.shipping_address,
          note: data.note || undefined,
          items: itemInputs
        });
      }

      // Return to list view
      updateURL("list");
    } catch (err: any) {
      setFormError(err.message || "Lưu đơn hàng thất bại.");
    }
  };

  // --- TRANSITIONS ACTIONS ---
  const handleConfirmOrder = async (id: number) => {
    try {
      const stockCheck = await api.get<StockCheckResponse>(`/orders/${id}/stock-check`);
      if (!stockCheck.sufficient) {
        setStockWarnings((prev) => ({ ...prev, [id]: stockCheck.message }));
        await popupService.alert(`Không thể duyệt đơn: ${stockCheck.message}`);
        return;
      }
      setStockWarnings((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (err: any) {
      await popupService.alert("Không kiểm tra được tồn kho WMS: " + (err.message || "Lỗi không xác định"));
      return;
    }

    if (await showConfirm("Xác nhận duyệt đơn hàng này? Hệ thống sẽ tạo yêu cầu fulfillment sang WMS.")) {
      try {
        await api.post(`/orders/${id}/confirm`, {});
        loadOrderDetails(id);
      } catch (err: any) {
        void popupService.alert("Duyệt đơn thất bại: " + err.message);
      }
    }
  };

  const handleCancelOrder = async (id: number) => {
    if (await showConfirm("Xác nhận hủy đơn hàng này?")) {
      try {
        await api.post(`/orders/${id}/cancel`, {});
        loadOrderDetails(id);
      } catch (err: any) {
        void popupService.alert("Hủy đơn thất bại: " + err.message);
      }
    }
  };

  const handleDeleteOrder = async (id: number) => {
    if (await showConfirm("Xác nhận xóa vĩnh viễn đơn hàng Nháp này?")) {
      try {
        await api.delete(`/orders/${id}`);
        updateURL("list");
      } catch (err: any) {
        void popupService.alert("Xóa đơn thất bại: " + err.message);
      }
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(val);
  };

  // Filter local customers
  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.phone.includes(customerSearch)
  );

  // --- RENDER SECTIONS ---

  return (
    <div className="p-6 md:p-8 max-w-[96rem] mx-auto space-y-6 bg-gray-50 min-h-full text-gray-900">
      {/* 1. LIST VIEW */}
      {view !== "detail" && (
        <>
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-extrabold text-gray-900">Quản lý Đơn hàng (Orders)</h2>
              <p className="text-sm text-gray-600 mt-1">
                Lập đơn nháp, duyệt đơn hàng và kiểm tra lịch trình vận chuyển.
              </p>
            </div>
            <button
              onClick={() => {
                setFormCustomer(null);
                setFormChannelId(null);
                setFormShippingAddress("");
                setFormShippingFee(0);
                setFormNote("");
                setFormItems([]);
                setFormError(null);
                reset({
                  customer_id: 0,
                  channel_id: 0,
                  shipping_address: "",
                  shipping_fee: 0,
                  note: ""
                });
                updateURL("create");
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo Đơn hàng Nháp</span>
            </button>
          </div>

          {/* Filters Bar */}
          <div className="bg-slate-900 p-5 rounded-2xl border border-gray-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -trangray-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Số đơn, tên, SĐT..."
                className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-gray-300 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 transition-all"
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
              />
            </div>

            {/* Status Selector */}
            <select
              className="px-3.5 py-2 bg-slate-900 border border-gray-300 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">Trạng thái (Tất cả)</option>
              {ORDER_STATUS_STEPS.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
              <option value="CANCELLED">CANCELLED</option>
            </select>

            {/* Channel Selector */}
            <select
              className="px-3.5 py-2 bg-slate-900 border border-gray-300 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
              value={filterChannel}
              onChange={(e) => setFilterChannel(e.target.value)}
            >
              <option value="">Kênh bán hàng (Tất cả)</option>
              {channels.map((ch) => (
                <option key={ch.id} value={ch.id}>{ch.name}</option>
              ))}
            </select>

            {/* Date selector */}
            <input
              type="date"
              className="px-3.5 py-2 bg-slate-900 border border-gray-300 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
            />

            {/* Clear filters */}
            <button
              onClick={() => {
                setFilterSearch("");
                setFilterStatus("");
                setFilterChannel("");
                setFilterDate("");
                setCurrentPage(1);
              }}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm rounded-xl transition-all"
            >
              Xóa bộ lọc
            </button>
          </div>

          {/* Orders Table */}
          <div className="bg-slate-900 rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm text-gray-700">
                <thead className="bg-gray-100 border-b border-gray-200 font-bold uppercase text-gray-600">
                  <tr>
                    <th className="px-6 py-4">Mã đơn</th>
                    <th className="px-6 py-4">Khách hàng</th>
                    <th className="px-6 py-4">Kênh bán</th>
                    <th className="px-6 py-4">Tổng tiền</th>
                    <th className="px-6 py-4">Trạng thái</th>
                    <th className="px-6 py-4">Ngày tạo</th>
                    <th className="px-6 py-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {listLoading ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                        Đang tải danh sách đơn hàng...
                      </td>
                    </tr>
                  ) : orders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                        Không tìm thấy đơn hàng nào.
                      </td>
                    </tr>
                  ) : (
                    orders.map((order) => {
                      const isDraft = order.status === "DRAFT";
                      const isCancelable = !["SHIPPED", "CANCELLED", "COMPLETED"].includes(order.status);
                      return (
                        <tr key={order.id} className="hover:bg-gray-50 transition-colors align-top">
                          <td className="px-6 py-4 font-bold text-gray-900">{order.order_number}</td>
                          <td className="px-6 py-4">
                            <div className="font-semibold text-gray-900">{order.customer?.name || `Customer ID: ${order.customer_id}`}</div>
                            <div className="text-xs text-gray-500">{order.customer?.phone}</div>
                          </td>
                          <td className="px-6 py-4 font-medium text-gray-700">
                            {order.channel?.name || order.channel_id}
                          </td>
                          <td className="px-6 py-4 font-bold text-gray-900">
                            {formatCurrency(Number(order.total_amount))}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 border rounded text-[10px] font-extrabold tracking-wider ${getStatusBadgeClass(order.status)}`}>
                              {order.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-600">
                            {new Date(order.created_at).toLocaleDateString("vi-VN")}
                          </td>
                          <td className="px-6 py-4 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              onClick={() => updateURL("detail", order.id)}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 hover:bg-gray-700 border border-gray-300 text-gray-800 rounded-lg font-bold"
                            >
                              <Eye className="w-3.5 h-3.5 text-gray-600" />
                              <span>Xem</span>
                            </button>
                            {isDraft && (
                              <button
                                onClick={() => {
                                  setSelectedOrderId(order.id);
                                  updateURL("edit", order.id);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-950 border border-indigo-900 text-indigo-400 rounded-lg font-bold"
                              >
                                <Edit className="w-3.5 h-3.5" />
                                <span>Sửa</span>
                              </button>
                            )}
                            {isDraft && (
                              <button
                                onClick={() => handleConfirmOrder(order.id)}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                                <span>Duyệt</span>
                              </button>
                            )}
                            {isCancelable && (
                              <button
                                onClick={() => handleCancelOrder(order.id)}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-rose-950 border border-rose-900 text-rose-400 rounded-lg font-bold"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Hủy</span>
                              </button>
                            )}
                            {stockWarnings[order.id] && (
                              <div className="mt-2 text-left text-xs text-rose-600 font-semibold whitespace-normal max-w-xs ml-auto">
                                {stockWarnings[order.id]}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {!listLoading && totalCount > 0 && (
              <div className="px-6 py-4 bg-gray-100 border-t border-gray-200 flex items-center justify-between text-sm font-semibold text-gray-600">
                <span>
                  Hiển thị {orders.length} trên {totalCount} đơn hàng
                </span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    className="p-1.5 rounded-lg border border-gray-300 bg-slate-900 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4 text-gray-500" />
                  </button>
                  <span className="px-3 py-1 bg-slate-900 border border-gray-300 rounded-lg text-gray-900">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    className="p-1.5 rounded-lg border border-gray-300 bg-slate-900 disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* 2. FORM VIEW (Create/Edit Draft) */}
      {(view === "create" || view === "edit") && (
        <div className="fixed inset-0 z-40 bg-gray-900/30 backdrop-blur-[1px]">
          <div className="absolute inset-y-0 right-0 w-full max-w-5xl bg-transparent border-l border-gray-200 shadow-2xl overflow-y-auto p-6 md:p-8 space-y-6">
            <div className="flex items-center justify-between">
              <button
                onClick={() => updateURL("list")}
                className="px-4 py-2 bg-slate-900 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors font-bold text-sm shadow-sm"
              >
                ← Đóng form
              </button>
              <h2 className="text-sm font-extrabold text-gray-700 uppercase tracking-widest">
                {view === "create" ? "TẠO ĐƠN HÀNG NHÁP" : "CẬP NHẬT ĐƠN HÀNG NHÁP"}
              </h2>
            </div>

            {formError && (
              <div className="p-3.5 bg-rose-950/50 border border-rose-900/50 text-rose-400 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit(handleSaveOrder)} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left columns: fields */}
            <div className="lg:col-span-2 space-y-6 bg-slate-900 p-6 rounded-2xl border border-gray-200 shadow-sm">
              <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider pb-2 border-b border-gray-200">
                Thông tin khách hàng & vận chuyển
              </h3>

              {/* Customer Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                    Khách hàng <span className="text-rose-400">*</span>
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1 px-3.5 py-2 bg-slate-900 border border-gray-200 rounded-xl text-xs text-gray-800 font-semibold flex items-center justify-between min-h-[36px]">
                      {formCustomer ? (
                        <span>{formCustomer.name} ({formCustomer.phone})</span>
                      ) : (
                        <span className="text-gray-500">Chưa chọn khách hàng</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsCustomerModalOpen(true)}
                      className="px-3.5 bg-indigo-950 border border-indigo-900 text-indigo-400 text-xs rounded-xl font-bold hover:bg-indigo-950"
                    >
                      Tìm kiếm
                    </button>
                  </div>
                  {errors.customer_id && (
                    <p className="text-[10px] text-rose-400 font-bold">{errors.customer_id.message}</p>
                  )}
                </div>

                {/* Channel Selector */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                    Kênh bán hàng <span className="text-rose-400">*</span>
                  </label>
                  <select
                    className="w-full px-3.5 py-2 bg-slate-900 border border-gray-200 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-800 font-semibold"
                    value={formChannelId || ""}
                    onChange={(e) => {
                      const val = e.target.value ? parseInt(e.target.value, 10) : null;
                      setFormChannelId(val);
                      setValue("channel_id", val || 0, { shouldValidate: true });
                    }}
                  >
                    <option value="" className="bg-slate-900">-- Chọn kênh bán hàng --</option>
                    {channels.filter(ch => ch.is_active).map((ch) => (
                      <option key={ch.id} value={ch.id} className="bg-slate-900">{ch.name}</option>
                    ))}
                  </select>
                  {errors.channel_id && (
                    <p className="text-[10px] text-rose-400 font-bold">{errors.channel_id.message}</p>
                  )}
                </div>
              </div>

              {/* Shipping Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                    Địa chỉ giao hàng <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formShippingAddress}
                    onChange={(e) => {
                      setFormShippingAddress(e.target.value);
                      setValue("shipping_address", e.target.value, { shouldValidate: true });
                    }}
                    placeholder="Số nhà, tên đường, Phường, Quận, Thành phố"
                    className="w-full px-3.5 py-2 bg-slate-900 border border-gray-200 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                  />
                  {errors.shipping_address && (
                    <p className="text-[10px] text-rose-400 font-bold">{errors.shipping_address.message}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                    Phí vận chuyển (VND)
                  </label>
                  <input
                    type="number"
                    value={formShippingFee}
                    onChange={(e) => {
                      const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                      setFormShippingFee(val);
                      setValue("shipping_fee", val, { shouldValidate: true });
                    }}
                    className="w-full px-3.5 py-2 bg-slate-900 border border-gray-200 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                    min="0"
                  />
                  {errors.shipping_fee && (
                    <p className="text-[10px] text-rose-400 font-bold">{errors.shipping_fee.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                  Ghi chú đơn hàng
                </label>
                <textarea
                  value={formNote}
                  onChange={(e) => {
                    setFormNote(e.target.value);
                    setValue("note", e.target.value, { shouldValidate: true });
                  }}
                  placeholder="Ghi chú giao hàng, đóng gói..."
                  rows={2}
                  className="w-full px-3.5 py-2 bg-slate-900 border border-gray-200 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none text-gray-900"
                />
              </div>

              {/* Product items list */}
              <div className="space-y-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                    Danh sách sản phẩm ({formItems.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchResults([]);
                      setProductSearch("");
                      setIsProductModalOpen(true);
                    }}
                    className="px-3 py-1.5 bg-indigo-650 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow"
                  >
                    + Thêm sản phẩm
                  </button>
                </div>

                {/* Items table */}
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead className="bg-slate-900 border-b border-gray-200 text-gray-600 font-bold">
                      <tr>
                        <th className="px-4 py-3">Sản phẩm</th>
                        <th className="px-4 py-3">Mã SKU</th>
                        <th className="px-4 py-3">Đơn giá</th>
                        <th className="px-4 py-3">Số lượng</th>
                        <th className="px-4 py-3 text-right">Thành tiền</th>
                        <th className="px-4 py-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 text-gray-700">
                      {formItems.map((item) => (
                        <tr key={item.sku_code}>
                          <td className="px-4 py-3 font-semibold">
                            <div className="text-gray-800">{item.product_name}</div>
                            {item.variant_name && (
                              <div className="text-[10px] text-gray-600">{item.variant_name}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono">{item.sku_code}</td>
                          <td className="px-4 py-3 font-bold">{formatCurrency(item.price)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleQuantityChange(item.sku_code, -1)}
                                className="w-5 h-5 bg-gray-100 hover:bg-gray-700 rounded flex items-center justify-center font-bold text-gray-800"
                              >
                                -
                              </button>
                              <span className="w-6 text-center font-bold text-gray-800">{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() => handleQuantityChange(item.sku_code, 1)}
                                className="w-5 h-5 bg-gray-100 hover:bg-gray-700 rounded flex items-center justify-center font-bold text-gray-800"
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-bold text-right text-gray-800">
                            {formatCurrency(item.price * item.quantity)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.sku_code)}
                              className="text-rose-400 hover:text-rose-500"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {formItems.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                            Đơn hàng chưa có sản phẩm nào. Click &apos;Thêm sản phẩm&apos; để thêm hàng hóa.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right sidebar: Summary */}
            <div className="space-y-6">
              <div className="bg-slate-900 p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider pb-2 border-b border-gray-200">
                  Tóm tắt đơn hàng
                </h3>

                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between text-gray-600">
                    <span>Tạm tính ({formItems.reduce((acc, it) => acc + it.quantity, 0)} sản phẩm)</span>
                    <span className="font-bold text-gray-800">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Phí giao hàng</span>
                    <span className="font-bold text-gray-800">{formatCurrency(formShippingFee)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-gray-800 pt-2.5 border-t border-gray-200">
                    <span>TỔNG TIỀN</span>
                    <span className="text-indigo-400">{formatCurrency(totalAmount)}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-indigo-650 text-white font-bold text-xs rounded-xl shadow hover:bg-indigo-700 transition-all text-center"
                  >
                    Lưu đơn hàng Nháp
                  </button>
                  <button
                    type="button"
                    onClick={() => updateURL("list")}
                    className="w-full py-2.5 bg-gray-100 border border-gray-300 text-gray-800 font-bold text-xs rounded-xl hover:bg-gray-700 transition-all text-center"
                  >
                    Hủy bỏ
                  </button>
                </div>
              </div>
            </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. DETAIL VIEW */}
      {view === "detail" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => updateURL("list")}
              className="px-4 py-2 bg-slate-900 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors font-bold text-xs shadow-sm"
            >
              ← Quay lại danh sách
            </button>
            <span className="text-xs text-gray-600 uppercase font-bold tracking-wider">
              Chi tiết đơn hàng
            </span>
          </div>

          {detailLoading || !currentOrder ? (
            <div className="p-8 text-center text-gray-600 bg-slate-900 border border-gray-200 rounded-2xl shadow-sm">
              Đang tải chi tiết đơn hàng...
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column: Timeline, Items & Details */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Timeline */}
                <div className="bg-slate-900 p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
                  <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider pb-2 border-b border-gray-200">
                    Lộ trình trạng thái đơn hàng
                  </h3>

                  {/* Horizontal Timeline Track */}
                  <div className="flex items-center justify-between gap-2 overflow-x-auto pb-4 pt-2">
                    {ORDER_STATUS_STEPS.map((step, idx) => {
                      const isCompleted = currentOrder.status === "CANCELLED"
                        ? false
                        : ORDER_STATUS_STEPS.indexOf(currentOrder.status) >= idx;
                      const isCurrent = currentOrder.status === step;
                      
                      return (
                        <div key={step} className="flex-1 min-w-[70px] flex flex-col items-center relative text-center">
                          {/* Dot */}
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] border-2 transition-all duration-300 z-10 ${
                            isCurrent ? "bg-indigo-600 text-white border-indigo-600 scale-110 shadow-md shadow-indigo-600/20" :
                            isCompleted ? "bg-indigo-950 border-indigo-500 text-indigo-400" :
                            "bg-slate-900 border-gray-200 text-gray-500"
                          }`}>
                            {idx + 1}
                          </div>

                          {/* Line */}
                          {idx < ORDER_STATUS_STEPS.length - 1 && (
                            <div className={`absolute top-3.5 left-1/2 right-[-50%] h-[2px] z-0 ${
                              isCompleted && ORDER_STATUS_STEPS.indexOf(currentOrder.status) > idx
                                ? "bg-indigo-500"
                                : "bg-gray-100"
                            }`} />
                          )}

                          <span className={`text-xs font-bold mt-2 tracking-wide uppercase ${
                            isCurrent ? "text-indigo-400" : "text-gray-500"
                          }`}>{step}</span>
                        </div>
                      );
                    })}

                    {currentOrder.status === "CANCELLED" && (
                      <div className="px-4 py-2 bg-rose-950/50 border border-rose-900/50 rounded-xl flex items-center gap-2">
                        <XCircle className="w-5 h-5 text-rose-400" />
                        <div>
                          <div className="text-[10px] font-extrabold text-rose-400 uppercase">ĐÃ HỦY ĐƠN (CANCELLED)</div>
                          <div className="text-xs text-rose-500">Đơn hàng không được xử lý tiếp</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Items */}
                <div className="bg-slate-900 p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                  <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider pb-2 border-b border-gray-200">
                    Sản phẩm trong đơn hàng
                  </h3>

                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900 border-b border-gray-200 text-gray-600 font-bold">
                        <tr>
                          <th className="px-4 py-3">Sản phẩm</th>
                          <th className="px-4 py-3">Mã SKU</th>
                          <th className="px-4 py-3">Đơn giá</th>
                          <th className="px-4 py-3">Số lượng</th>
                          <th className="px-4 py-3 text-right">Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 text-gray-700 font-medium">
                        {currentOrder.items.map((item) => (
                          <tr key={item.id}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                {item.image_url && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={item.image_url} alt={item.product_name} className="w-8 h-8 rounded object-cover border border-gray-200" />
                                )}
                                <div>
                                  <div className="font-bold text-gray-800">{item.product_name}</div>
                                  {item.variant_name && (
                                    <div className="text-xs text-gray-600">{item.variant_name}</div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 font-mono">{item.sku_code}</td>
                            <td className="px-4 py-3">{formatCurrency(Number(item.unit_price))}</td>
                            <td className="px-4 py-3 font-bold">{item.quantity}</td>
                            <td className="px-4 py-3 font-bold text-right text-gray-800">
                              {formatCurrency(Number(item.subtotal))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Fulfillment Sync details */}
                {currentOrder.fulfillment_orders && currentOrder.fulfillment_orders.length > 0 && (
                  <div className="bg-slate-900 p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                    <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider pb-2 border-b border-gray-200 flex items-center gap-2">
                      <Package className="w-4 h-4 text-indigo-400" />
                      <span>Thông tin Fulfillment (WMS integration)</span>
                    </h3>

                    <div className="space-y-4">
                      {currentOrder.fulfillment_orders.map((fo) => (
                        <div key={fo.id} className="p-4 bg-slate-900 border border-gray-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                          <div>
                            <span className="text-gray-500 block">Mã vận vận (WMS ID):</span>
                            <strong className="text-gray-800">{fo.fulfillment_number}</strong>
                          </div>
                          <div>
                            <span className="text-gray-500 block">Mã kho gửi hàng:</span>
                            <strong className="text-gray-800">{fo.warehouse_code}</strong>
                          </div>
                          <div>
                            <span className="text-gray-500 block">Trạng thái WMS:</span>
                            <span className="px-2 py-0.5 bg-indigo-950/50 text-indigo-400 border border-indigo-900/50 rounded text-[10px] font-bold">{fo.status}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 block">Đơn vị vận chuyển:</span>
                            <strong className="text-gray-800">{fo.carrier_name || "Chưa cập nhật"}</strong>
                          </div>
                          {fo.tracking_number && (
                            <div className="sm:col-span-2">
                              <span className="text-gray-500 block">Mã vận đơn tracking:</span>
                              <strong className="text-indigo-400 font-mono">{fo.tracking_number}</strong>
                            </div>
                          )}
                          {fo.shipped_at && (
                            <div className="sm:col-span-2">
                              <span className="text-gray-500 block">Thời gian giao:</span>
                              <strong className="text-gray-700">
                                {new Date(fo.shipped_at).toLocaleString("vi-VN")}
                              </strong>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Actions & Details */}
              <div className="space-y-6">
                {/* Meta details */}
                <div className="bg-slate-900 p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                  <div className="pb-2 border-b border-gray-200 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-extrabold text-gray-800">{currentOrder.order_number}</h4>
                      <p className="text-[10px] text-gray-600">Ngày lập: {new Date(currentOrder.created_at).toLocaleString("vi-VN")}</p>
                    </div>
                    <span className={`px-2 py-0.5 border rounded text-[10px] font-bold ${getStatusBadgeClass(currentOrder.status)}`}>
                      {currentOrder.status}
                    </span>
                  </div>

                  <div className="space-y-3 text-xs">
                    {/* Customer */}
                    <div className="flex gap-2">
                      <Users className="w-4 h-4 text-gray-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-gray-800">{currentOrder.customer?.name}</div>
                        <div className="text-[10px] text-gray-600">SĐT: {currentOrder.customer?.phone}</div>
                        <div className="text-[10px] text-gray-600">Email: {currentOrder.customer?.email || "-"}</div>
                      </div>
                    </div>

                    {/* Address */}
                    <div className="flex gap-2 border-t border-gray-200 pt-3">
                      <MapPin className="w-4 h-4 text-gray-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-gray-500 text-[10px] uppercase font-bold tracking-wider">Địa chỉ nhận hàng</div>
                        <div className="text-gray-800 font-semibold">{currentOrder.shipping_address}</div>
                      </div>
                    </div>

                    {/* Channel */}
                    <div className="flex gap-2 border-t border-gray-200 pt-3">
                      <ShoppingCart className="w-4 h-4 text-gray-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-gray-500 text-[10px] uppercase font-bold tracking-wider">Kênh bán hàng</div>
                        <div className="text-gray-800 font-semibold">{currentOrder.channel?.name || `ID: ${currentOrder.channel_id}`}</div>
                      </div>
                    </div>

                    {/* Pricing summary */}
                    <div className="border-t border-gray-200 pt-3 space-y-2">
                      <div className="flex justify-between text-gray-600">
                        <span>Giá trị hàng hóa</span>
                        <span className="font-semibold text-gray-800">
                          {formatCurrency(Number(currentOrder.total_amount) - Number(currentOrder.shipping_fee))}
                        </span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>Phí giao hàng</span>
                        <span className="font-semibold text-gray-800">{formatCurrency(Number(currentOrder.shipping_fee))}</span>
                      </div>
                      <div className="flex justify-between font-bold text-gray-800 text-sm pt-2 border-t border-gray-200">
                        <span>TỔNG ĐƠN HÀNG</span>
                        <span className="text-indigo-400">{formatCurrency(Number(currentOrder.total_amount))}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions buttons */}
                  <div className="flex flex-col gap-2 pt-2 border-t border-gray-200">
                    {currentOrder.status === "DRAFT" && (
                      <button
                        onClick={() => handleConfirmOrder(currentOrder.id)}
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-500/10 flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>Duyệt đơn & Sync WMS</span>
                      </button>
                    )}
                    
                    {currentOrder.status === "DRAFT" && (
                      <button
                        onClick={() => {
                          setSelectedOrderId(currentOrder.id);
                          updateURL("edit", currentOrder.id);
                        }}
                        className="w-full py-2 bg-indigo-950 hover:bg-indigo-900 border border-indigo-900 text-indigo-400 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5"
                      >
                        <Edit className="w-4 h-4" />
                        <span>Chỉnh sửa đơn hàng</span>
                      </button>
                    )}

                    {!["SHIPPED", "CANCELLED", "COMPLETED"].includes(currentOrder.status) && (
                      <button
                        onClick={() => handleCancelOrder(currentOrder.id)}
                        className="w-full py-2 bg-rose-950 border border-rose-900 text-rose-400 rounded-xl font-bold text-xs hover:bg-rose-900 flex items-center justify-center gap-1.5"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Hủy bỏ đơn hàng</span>
                      </button>
                    )}

                    {currentOrder.status === "DRAFT" && (
                      <button
                        onClick={() => handleDeleteOrder(currentOrder.id)}
                        className="w-full py-2 bg-slate-900 border border-gray-200 text-rose-400 hover:text-rose-500 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Xóa vĩnh viễn đơn nháp</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- FLOATING MODALS --- */}

      {/* A. Customer Selection Modal */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-gray-900">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-100">
              <h2 className="text-sm font-bold text-gray-800">Chọn khách hàng</h2>
              <button
                onClick={() => setIsCustomerModalOpen(false)}
                className="p-2 text-gray-600 hover:text-gray-800 rounded-xl"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -trangray-y-1/2 w-4 h-4 text-gray-600" />
                  <input
                    type="text"
                    placeholder="Tìm theo tên hoặc số điện thoại..."
                    className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-gray-200 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setIsNewCustomerModalOpen(true)}
                  className="px-3.5 bg-indigo-650 text-white font-bold text-xs rounded-xl hover:bg-indigo-700"
                >
                  Tạo mới KH
                </button>
              </div>

              {/* List */}
              <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-200 text-xs bg-slate-900">
                {filteredCustomers.map((cust) => (
                  <div
                    key={cust.id}
                    onClick={() => handleSelectCustomer(cust)}
                    className="p-3 hover:bg-slate-900 cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-gray-800">{cust.name}</div>
                      <div className="text-gray-600 text-[10px]">SĐT: {cust.phone}</div>
                    </div>
                    <span className="text-[10px] text-indigo-400 font-bold">Chọn →</span>
                  </div>
                ))}
                {filteredCustomers.length === 0 && (
                  <div className="p-6 text-center text-gray-500">Không tìm thấy khách hàng nào.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* B. Quick Add Customer Modal */}
      {isNewCustomerModalOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-gray-900">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-100">
              <h2 className="text-sm font-bold text-gray-800">Thêm nhanh khách hàng mới</h2>
              <button
                onClick={() => setIsNewCustomerModalOpen(false)}
                className="p-2 text-gray-600 hover:text-gray-800 rounded-xl"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomerQuick} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">
                  Tên Khách hàng <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Nhập họ và tên"
                  className="w-full px-3.5 py-2 bg-slate-900 border border-gray-200 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">
                  Số điện thoại <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Nhập số điện thoại"
                  className="w-full px-3.5 py-2 bg-slate-900 border border-gray-200 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                  value={newCustomerPhone}
                  onChange={(e) => setNewCustomerPhone(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Email</label>
                <input
                  type="email"
                  placeholder="Nhập địa chỉ email"
                  className="w-full px-3.5 py-2 bg-slate-900 border border-gray-200 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                  value={newCustomerEmail}
                  onChange={(e) => setNewCustomerEmail(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Địa chỉ giao hàng</label>
                <textarea
                  placeholder="Nhập địa chỉ"
                  rows={2}
                  className="w-full px-3.5 py-2 bg-slate-900 border border-gray-200 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none text-gray-900"
                  value={newCustomerAddress}
                  onChange={(e) => setNewCustomerAddress(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewCustomerModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-800 rounded-xl font-bold hover:bg-gray-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-650 text-white rounded-xl font-bold hover:bg-indigo-700"
                >
                  Lưu & Chọn
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* C. Product Search Modal */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 rounded-3xl w-full max-w-2xl shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-gray-900">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-100">
              <h2 className="text-sm font-bold text-gray-800">Tìm kiếm & thêm sản phẩm từ PIM</h2>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="p-2 text-gray-600 hover:text-gray-800 rounded-xl"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <form onSubmit={handleProductSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -trangray-y-1/2 w-4 h-4 text-gray-600" />
                  <input
                    type="text"
                    placeholder="Nhập tên sản phẩm hoặc mã SKU..."
                    className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-gray-200 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 bg-indigo-650 text-white font-bold text-xs rounded-xl hover:bg-indigo-700"
                >
                  Tìm kiếm
                </button>
              </form>

              {/* Results */}
              <div className="max-h-80 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-200 text-xs bg-slate-900">
                {productSearchLoading ? (
                  <div className="p-6 text-center text-gray-500">Đang tìm kiếm sản phẩm...</div>
                ) : searchResults.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">Nhập từ khóa và bấm Tìm kiếm.</div>
                ) : (
                  searchResults.map((product) => {
                    const coverMedia = product.media?.find((m) => m.is_cover) || product.media?.[0];
                    return (
                      <div key={product.id} className="p-4 space-y-3">
                        <div className="flex gap-3">
                          {coverMedia && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={coverMedia.image_url} alt={product.name} className="w-10 h-10 rounded object-cover border border-gray-200 shrink-0" />
                          )}
                          <div>
                            <div className="font-bold text-gray-800">{product.name}</div>
                            <div className="text-gray-600 text-[10px]">Mã sản phẩm: {product.product_code}</div>
                          </div>
                        </div>

                        {/* Variants List */}
                        <div className="bg-slate-900 p-2 rounded-lg divide-y divide-gray-200 border border-gray-200">
                          {product.variants?.map((v) => {
                            const variantLabel = [v.tier_1_option, v.tier_2_option].filter(Boolean).join(" - ");
                            return (
                              <div key={v.id} className="py-2 px-1 flex items-center justify-between text-[11px]">
                                <div>
                                  <span className="font-bold text-gray-800">{variantLabel || "Mặc định"}</span>
                                  <span className="text-gray-600 ml-2 font-mono">({v.sku_code})</span>
                                  <div className="text-[10px] text-gray-600 mt-0.5">
                                    Kho hàng: <strong className={v.stock > 0 ? "text-emerald-400" : "text-rose-500"}>{v.stock}</strong> • Giá: <strong>{formatCurrency(v.price)}</strong>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleAddProductItem(
                                    v.sku_code,
                                    product.name,
                                    variantLabel || undefined,
                                    v.price,
                                    coverMedia?.image_url
                                  )}
                                  className="px-2 py-1 bg-gray-850 hover:bg-indigo-950 border border-gray-200 hover:border-indigo-900 text-indigo-400 font-bold rounded"
                                >
                                  Thêm +
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrdersPage() {
  return (
    <React.Suspense fallback={<div className="p-8 text-xs text-gray-450 font-semibold">Đang đồng bộ tuyến đường...</div>}>
      <OrdersPageContent />
    </React.Suspense>
  );
}
