
export type CoinSymbol = 'BTC' | 'ETH' | 'SOL' | 'DOGE';

export enum OrderSide {
  BUY = 'BUY',
  SELL = 'SELL'
}

export enum OrderStatus {
  PENDING = 'PENDING',
  FILLED = 'FILLED',
  CANCELLED = 'CANCELLED'
}

export interface Order {
  id: string;
  symbol: CoinSymbol;
  side: OrderSide;
  price: number;
  amount: number;
  total: number;
  timestamp: number;
  status: OrderStatus;
  isAiTriggered: boolean;
  reason?: string; // AI reasoning
}

export interface Asset {
  symbol: CoinSymbol;
  balance: number;
  averageEntryPrice: number;
}

export interface Portfolio {
  cashBalance: number;
  assets: Record<CoinSymbol, Asset>;
}

export interface CandleData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface MarketData {
  symbol: CoinSymbol;
  price: number;
  change24h: number; // percentage
  history: CandleData[];
}

export interface AiDecision {
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reason: string;
  suggestedAmount?: number;
}
