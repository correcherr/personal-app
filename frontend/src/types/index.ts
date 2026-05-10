export const VERSION = "1.0.0";

export interface Article {
  id: number
  name: string
  category?: string
  purchase_price: number | null
  recommended_price: number | null
  date: string
  image_url: string | null
}

export interface OrderItemSale {
  id: number
  order_item_id: number
  sell_price: number | null
  sold_at: string | null
}

export interface OrderItem {
  id: number
  order_id: number
  article_id: number | null
  name: string
  buy_price: number
  quantity: number
  article: Article | null
  sales: OrderItemSale[]
}

export interface Order {
  id: number;
  name: string;
  platform?: string;
  date: string;
  updated_at?: string;
  items: OrderItem[];
}
