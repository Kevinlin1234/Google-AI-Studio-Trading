
import { CoinSymbol, CandleData } from '../types';

const BASE_URL = 'https://api.binance.com/api/v3';
const WS_URL = 'wss://stream.binance.com:9443/stream';

export const getBinanceSymbol = (symbol: CoinSymbol) => `${symbol}USDT`.toLowerCase();

// Fetch last 60 minutes of data for the chart
export const fetchHistoricalPrices = async (symbol: CoinSymbol, limit: number = 60): Promise<CandleData[] | null> => {
  try {
    // Binance Kline format: 
    // [
    //   0: Open Time,
    //   1: Open,
    //   2: High,
    //   3: Low,
    //   4: Close,
    //   5: Volume,
    //   ...
    // ]
    const response = await fetch(`${BASE_URL}/klines?symbol=${symbol}USDT&interval=1m&limit=${limit}`);
    
    if (!response.ok) {
      throw new Error('Binance API response not ok');
    }
    
    const data = await response.json();
    
    return data.map((item: any) => ({
      time: new Date(item[0]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      open: parseFloat(item[1]),
      high: parseFloat(item[2]),
      low: parseFloat(item[3]),
      close: parseFloat(item[4])
    }));
  } catch (error) {
    console.warn(`Failed to fetch history for ${symbol} (likely CORS). Using fallback.`, error);
    return null;
  }
};

export const subscribeToMarketData = (
  symbols: CoinSymbol[], 
  onUpdate: (data: { symbol: CoinSymbol, price: number, change24h: number }) => void
) => {
  // Subscribe to miniTicker for 24h change and price
  const streams = symbols.map(s => `${s.toLowerCase()}usdt@miniTicker`).join('/');
  const ws = new WebSocket(`${WS_URL}?streams=${streams}`);

  ws.onopen = () => {
    console.log('Connected to Binance WebSocket');
  };

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      // Stream structure: { stream: "btcusdt@miniTicker", data: { s: "BTCUSDT", c: "65000", p: "200", P: "2.5", ... } }
      if (message.data) {
        const ticker = message.data;
        const rawSymbol = ticker.s.replace('USDT', '');
        
        // Ensure symbol matches our CoinSymbol type
        if (symbols.includes(rawSymbol as CoinSymbol)) {
           onUpdate({
            symbol: rawSymbol as CoinSymbol,
            price: parseFloat(ticker.c), // Current price
            change24h: parseFloat(ticker.P) // 24h % change
          });
        }
      }
    } catch (e) {
      console.error("Error parsing WS message", e);
    }
  };

  ws.onerror = (err) => {
    console.error("Binance WS Error:", err);
  };

  return ws;
};

// Mock function for placing an order on Binance
export const placeBinanceOrder = async (
  apiKey: string, 
  apiSecret: string, 
  symbol: CoinSymbol, 
  side: 'BUY' | 'SELL', 
  quantity: number
) => {
    // In a real app, this would use crypto-js to sign the request with HMAC SHA256
    // and send a POST request to https://api.binance.com/api/v3/order
    
    console.log(`[Binance API] Executing ${side} ${quantity} ${symbol}USDT...`);
    
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                symbol: `${symbol}USDT`,
                orderId: Math.floor(Math.random() * 1000000),
                status: 'FILLED',
                transactTime: Date.now(),
                price: 'MARKET',
                origQty: quantity.toString(),
                executedQty: quantity.toString(),
                cummulativeQuoteQty: '0.00', // Would be real value
                side: side,
                type: 'MARKET'
            });
        }, 500);
    });
};
