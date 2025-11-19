
import React, { useEffect, useRef, memo } from 'react';
import { CoinSymbol } from '../types';

declare global {
  interface Window {
    TradingView: any;
  }
}

interface TradingViewChartProps {
  symbol: CoinSymbol;
}

const TradingViewChart: React.FC<TradingViewChartProps> = memo(({ symbol }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const containerId = `tradingview_widget_${Math.random().toString(36).substring(7)}`;
    
    if (containerRef.current) {
        containerRef.current.id = containerId;
        containerRef.current.innerHTML = ""; 
    }

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.onload = () => {
      if (typeof window.TradingView !== 'undefined' && containerRef.current) {
        new window.TradingView.widget({
          "autosize": true,
          "symbol": `BINANCE:${symbol}USDT`,
          "interval": "1",
          "timezone": "Etc/UTC",
          "theme": "dark",
          "style": "1", // Candles
          "locale": "en",
          "toolbar_bg": "#09090b", 
          "enable_publishing": false,
          "hide_top_toolbar": false,
          "hide_side_toolbar": false, 
          "allow_symbol_change": false,
          "save_image": false,
          "container_id": containerId,
          "studies": [
             // "RSI@tv-basicstudies" // Kept clean by default, user can add
          ],
          "overrides": {
            // Main Background
            "paneProperties.background": "#09090b", 
            "paneProperties.vertGridProperties.color": "#18181b",
            "paneProperties.horzGridProperties.color": "#18181b",
            
            // Scales
            "scalesProperties.textColor": "#71717a",
            "scalesProperties.lineColor": "#27272a",
            
            // Candles - Green (Success)
            "mainSeriesProperties.candleStyle.upColor": "#10b981",
            "mainSeriesProperties.candleStyle.borderUpColor": "#10b981",
            "mainSeriesProperties.candleStyle.wickUpColor": "#10b981",
            
            // Candles - Red (Danger)
            "mainSeriesProperties.candleStyle.downColor": "#ef4444",
            "mainSeriesProperties.candleStyle.borderDownColor": "#ef4444",
            "mainSeriesProperties.candleStyle.wickDownColor": "#ef4444",

            // Hollow Candles (if user switches)
            "mainSeriesProperties.hollowCandleStyle.upColor": "#10b981",
            "mainSeriesProperties.hollowCandleStyle.borderUpColor": "#10b981",
            "mainSeriesProperties.hollowCandleStyle.wickUpColor": "#10b981",
            "mainSeriesProperties.hollowCandleStyle.downColor": "#ef4444",
            "mainSeriesProperties.hollowCandleStyle.borderDownColor": "#ef4444",
            "mainSeriesProperties.hollowCandleStyle.wickDownColor": "#ef4444",
          }
        });
      }
    };
    document.head.appendChild(script);

    return () => {
      // Cleanup usually handled by iframe removal
    };
  }, [symbol]);

  return (
    <div className="w-full h-full relative bg-[#09090b]">
       <div ref={containerRef} className="w-full h-full" />
    </div>
  );
});

export default TradingViewChart;
