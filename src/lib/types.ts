export type Role = "customer" | "driver" | "admin";
export type OrderStatus = "pending" | "accepted" | "picked_up" | "on_the_way" | "delivered" | "cancelled";

export type Profile = {
  id: string;
  display_name: string;
  role: Role;
  created_at: string;
};
export type Order = {
  id: string;
  tracking_code: string;
  customer_id: string;
  driver_id: string | null;
  pickup_address: string;
  delivery_address: string;
  item_description: string;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
};
export type ChatMessage = {
  id: string;
  order_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};
export type DriverLocation = {
  order_id: string;
  driver_id: string;
  latitude: number;
  longitude: number;
  updated_at: string;
};
export const statusLabel: Record<OrderStatus, string> = {
  pending: "Menunggu", accepted: "Diterima", picked_up: "Paket dijemput",
  on_the_way: "Dalam perjalanan", delivered: "Selesai", cancelled: "Dibatalkan"
};
export const statusTone: Record<OrderStatus, string> = {
  pending: "amber", accepted: "blue", picked_up: "purple",
  on_the_way: "lime", delivered: "green", cancelled: "muted"
};
export const stepAfter: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: "accepted", accepted: "picked_up", picked_up: "on_the_way", on_the_way: "delivered"
};
