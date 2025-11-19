import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrainCircuit, DollarSign, Lock, Play, Pause, Wifi, Layout, RefreshCw, GripVertical, GripHorizontal } from 'lucide-react';
import { motion } from 'framer-motion';
import { SUPPORTED_COINS, INITIAL_CASH } from './constants';
import { CoinSymbol, MarketData, Order, Portfolio, OrderSide, OrderStatus, AiDecision } from './types';
import { analyzeMarket } from './services/geminiService';
import { fetchHistoricalPrices, subscribeToMarketData, placeBinanceOrder } from './services/binanceService';
import Chart from './components/Chart';
import OrderHistory from './components/OrderHistory';

const App: React.FC = () => {
  // --- State ---
  const [activeSymbol, setActiveSymbol] = useState<CoinSymbol>('BTC');
  const [marketData, setMarketData] = useState<Record<CoinSymbol, MarketData>>(() => {
    const initial: any = {};
    SUPPORTED_COINS.forEach(sym => {
      initial[sym] = {
        symbol: sym,
        price: 0,
        change24h: 0,
        history: []
      };
    });
    return initial;
  });

  const [portfolio, setPortfolio] = useState<Portfolio>({
    cashBalance: INITIAL_CASH,
    assets: SUPPORTED_COINS.reduce((acc, sym) => ({ ...acc, [sym]: { symbol: sym, balance: 0, averageEntryPrice: 0 } }), {} as any)
  });

  const [orders, setOrders] = useState<Order[]>([]);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiLogs, setAiLogs] = useState<{time: string, msg: string, sentiment: 'neutral' | 'positive' | 'negative'}[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const [isResizing, setIsResizing] = useState(false);

  // Layout State
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [chartHeightPercent, setChartHeightPercent] = useState(60);
  const [executionPanelWidthPercent, setExecutionPanelWidthPercent] = useState(40);

  // --- Refs for AI Loop State Access ---
  const marketDataRef = useRef(marketData);
  const portfolioRef = useRef(portfolio);
  const activeSymbolRef = useRef(activeSymbol);
  const aiIntervalRef = useRef<number | null>(null);

  // Keep refs synced with state
  useEffect(() => { marketDataRef.current = marketData; }, [marketData]);
  useEffect(() => { portfolioRef.current = portfolio; }, [portfolio]);
  useEffect(() => { activeSymbolRef.current = activeSymbol; }, [activeSymbol]);

  // --- Layout Resizing Handlers ---
  const startResizingSidebar = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const onMouseMove = (e: MouseEvent) => {
        const newWidth = Math.max(200, Math.min(500, startWidth + (e.clientX - startX)));
        setSidebarWidth(newWidth);
    };
    const onMouseUp = () => {
        setIsResizing(false);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [sidebarWidth]);

  const startResizingChart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const containerHeight = document.getElementById('main-content')?.clientHeight || 800;
    const startY = e.clientY;
    const startPercent = chartHeightPercent;

    const onMouseMove = (e: MouseEvent) => {
        const deltaY = e.clientY - startY;
        const deltaPercent = (deltaY / containerHeight) * 100;
        setChartHeightPercent(Math.max(20, Math.min(85, startPercent + deltaPercent)));
    };
    const onMouseUp = () => {
        setIsResizing(false);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [chartHeightPercent]);

  const startResizingBottomPanel = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const containerWidth = document.getElementById('bottom-panel')?.clientWidth || 1000;
    const startX = e.clientX;
    const startPercent = executionPanelWidthPercent;

    const onMouseMove = (e: MouseEvent) => {
        const deltaX = e.clientX - startX;
        const deltaPercent = (deltaX / containerWidth) * 100;
        setExecutionPanelWidthPercent(Math.max(20, Math.min(80, startPercent + deltaPercent)));
    };
    const onMouseUp = () => {
        setIsResizing(false);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [executionPanelWidthPercent]);

  const resetLayout = () => {
      setSidebarWidth(260);
      setChartHeightPercent(60);
      setExecutionPanelWidthPercent(40);
  };

  // --- Data Fetching ---
  useEffect(() => {
    const initData = async () => {
      setIsLoading(true);
      const newMarketData = { ...marketData };
      
      await Promise.all(SUPPORTED_COINS.map(async (sym) => {
        const history = await fetchHistoricalPrices(sym);
        if (history && history.length > 0) {
          newMarketData[sym] = {
            ...newMarketData[sym],
            price: history[history.length - 1].price,
            history: history
          };
        }
      }));
      
      setMarketData(newMarketData);
      setIsLoading(false);
    };

    initData();

    const ws = subscribeToMarketData(SUPPORTED_COINS, (update) => {
        setConnectionStatus('connected');
        setMarketData(prev => {
            const current = prev[update.symbol];
            const now = new Date();
            const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            let newHistory = [...current.history];
            const lastPoint = newHistory[newHistory.length - 1];

            if (lastPoint && lastPoint.time === timeStr) {
                newHistory[newHistory.length - 1] = { ...lastPoint, price: update.price };
            } else {
                newHistory.push({ time: timeStr, price: update.price });
                if (newHistory.length > 50) newHistory.shift();
            }

            if (newHistory.length === 0) {
                newHistory = [{ time: timeStr, price: update.price }];
            }

            return {
                ...prev,
                [update.symbol]: {
                    ...current,
                    price: update.price,
                    change24h: update.change24h,
                    history: newHistory
                }
            };
        });
    });

    ws.onclose = () => setConnectionStatus('disconnected');

    return () => {
        ws.close();
    };
  }, []);

  // --- Trading Logic ---
  const executeOrder = async (symbol: CoinSymbol, side: OrderSide, amount: number, price: number, isAi: boolean, reason?: string) => {
    const total = amount * price;
    const currentPortfolio = portfolioRef.current; 
    const userBalance = currentPortfolio.assets[symbol].balance;
    const cashBalance = currentPortfolio.cashBalance;

    if (side === OrderSide.BUY) {
      if (total > cashBalance) {
         if(!isAi) alert("Insufficient Funds");
         return;
      }
    } else {
      if (amount > userBalance) {
        if(!isAi) alert("Insufficient Asset Balance");
        return;
      }
    }

    await placeBinanceOrder('mock_key', 'mock_secret', symbol, side, amount);

    setPortfolio(prev => {
        let newPortfolio = { ...prev };
        if (side === OrderSide.BUY) {
            newPortfolio.cashBalance -= total;
            newPortfolio.assets = {
                ...newPortfolio.assets,
                [symbol]: {
                    ...newPortfolio.assets[symbol],
                    balance: newPortfolio.assets[symbol].balance + amount,
                    averageEntryPrice: (newPortfolio.assets[symbol].balance * newPortfolio.assets[symbol].averageEntryPrice + total) / (newPortfolio.assets[symbol].balance + amount)
                }
            };
        } else {
            newPortfolio.cashBalance += total;
            newPortfolio.assets = {
                ...newPortfolio.assets,
                [symbol]: {
                    ...newPortfolio.assets[symbol],
                    balance: newPortfolio.assets[symbol].balance - amount
                }
            };
        }
        return newPortfolio;
    });

    const newOrder: Order = {
      id: Math.random().toString(36).substr(2, 9),
      symbol,
      side,
      price,
      amount,
      total,
      timestamp: Date.now(),
      status: OrderStatus.FILLED,
      isAiTriggered: isAi,
      reason
    };

    setOrders(prev => [newOrder, ...prev]);
    if(isAi) addAiLog(`${side} ${symbol} @ $${price.toFixed(2)}`, side === OrderSide.BUY ? 'positive' : 'negative');
  };

  const executeOrderRef = useRef(executeOrder);
  useEffect(() => { executeOrderRef.current = executeOrder; });

  // --- AI Agent ---
  const addAiLog = (msg: string, sentiment: 'neutral' | 'positive' | 'negative' = 'neutral') => {
    setAiLogs(prev => [{time: new Date().toLocaleTimeString(), msg, sentiment}, ...prev].slice(0, 50));
  };

  useEffect(() => {
    if (aiEnabled) {
      addAiLog("AI Agent Activated. Monitoring real-time feeds...", 'neutral');
      
      const runAiCycle = async () => {
        const currentSymbol = activeSymbolRef.current;
        const data = marketDataRef.current[currentSymbol];
        const currentPortfolio = portfolioRef.current;

        if (!data || !data.history.length) return;

        const prices = data.history.map(h => h.price);
        
        addAiLog(`Analyzing ${currentSymbol} market structure...`, 'neutral');
        
        const decision: AiDecision = await analyzeMarket(
            currentSymbol, 
            data.price, 
            prices, 
            currentPortfolio.cashBalance
        );

        if (decision.action !== 'HOLD' && decision.confidence > 65) {
            let amount = 0;
            if (decision.action === 'BUY') {
                const budget = currentPortfolio.cashBalance * 0.10;
                amount = budget / data.price;
            } else {
                const holding = currentPortfolio.assets[currentSymbol].balance;
                amount = holding * 0.5;
            }

            if (amount * data.price > 5) {
                 executeOrderRef.current(currentSymbol, decision.action as OrderSide, amount, data.price, true, decision.reason);
            } else {
                addAiLog(`Signal ${decision.action} but low balance/volume.`, 'neutral');
            }
        } else {
            addAiLog(`Holding ${currentSymbol}. ${decision.reason}`, 'neutral');
        }
      };

      runAiCycle();
      aiIntervalRef.current = window.setInterval(runAiCycle, 6000);
    } else {
      if (aiIntervalRef.current) {
        clearInterval(aiIntervalRef.current);
        aiIntervalRef.current = null;
      }
      addAiLog("AI Agent Deactivated.", 'neutral');
    }
    return () => {
      if (aiIntervalRef.current) clearInterval(aiIntervalRef.current);
    };
  }, [aiEnabled]);

  const currentAsset = marketData[activeSymbol];
  const userAsset = portfolio.assets[activeSymbol];
  const portfolioValue = portfolio.cashBalance + SUPPORTED_COINS.reduce((sum, sym) => sum + (portfolio.assets[sym].balance * marketData[sym].price), 0);
  const totalPnL = portfolioValue - INITIAL_CASH;
  const pnlPercent = (totalPnL / INITIAL_CASH) * 100;
  const isUp = currentAsset.change24h >= 0;

  return (
    <div className={`min-h-screen bg-background text-zinc-100 font-sans selection:bg-primary selection:text-white overflow-hidden flex flex-col ${isResizing ? 'resizing cursor-col-resize' : ''}`}>
      
      {/* Header */}
      <header className="border-b border-zinc-800 bg-surface/50 backdrop-blur-md px-6 py-3 flex items-center justify-between sticky top-0 z-50 h-16 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <BrainCircuit className="text-white" size={18} />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight leading-none">NeuroTrade</h1>
            <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-primary font-mono">BETA v2.1</span>
                <span className="text-[10px] text-zinc-600">•</span>
                <div className="flex items-center gap-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${connectionStatus === 'connected' ? 'bg-success animate-pulse' : 'bg-danger'}`}></div>
                    <span className="text-[10px] text-zinc-500 uppercase">{connectionStatus === 'connected' ? 'Binance Live' : 'Connecting'}</span>
                </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
           <div className="flex flex-col items-end">
              <span className="text-xs text-zinc-500 uppercase font-medium tracking-wider">Portfolio Value</span>
              <div className="flex items-center gap-2">
                 <span className="font-mono font-bold text-lg">${portfolioValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                 <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${pnlPercent >= 0 ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                    {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
                 </span>
              </div>
           </div>
           
           <div className="flex items-center gap-2">
               <button onClick={resetLayout} className="p-2 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200 transition-colors" title="Reset Layout">
                    <Layout size={16} />
               </button>
               <div className="flex items-center gap-2 px-3 py-1.5 rounded border border-zinc-700 bg-zinc-900 text-zinc-400 cursor-help" title="Simulating Order Execution">
                   <Lock size={14} />
                   <span className="text-xs font-bold text-zinc-300">Sandboxed</span>
               </div>
           </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex overflow-hidden relative">
        
        {/* Sidebar */}
        <aside style={{ width: sidebarWidth }} className="flex flex-col border-r border-zinc-800 bg-surface/30 shrink-0 relative">
           <div className="p-4 flex-1 overflow-y-auto">
              <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Markets</h2>
              <div className="space-y-1">
                 {SUPPORTED_COINS.map(sym => {
                    const data = marketData[sym];
                    const symIsUp = data.change24h >= 0;
                    return (
                       <button 
                         key={sym}
                         onClick={() => setActiveSymbol(sym)}
                         className={`w-full flex items-center justify-between p-3 rounded-lg transition-all ${activeSymbol === sym ? 'bg-primary/10 border border-primary/20' : 'hover:bg-zinc-800/50 border border-transparent'}`}
                       >
                          <div className="flex items-center gap-3 overflow-hidden">
                             <div className={`w-8 h-8 rounded-full flex shrink-0 items-center justify-center text-xs font-bold ${sym === 'BTC' ? 'bg-orange-500/20 text-orange-500' : sym === 'ETH' ? 'bg-indigo-500/20 text-indigo-500' : sym === 'SOL' ? 'bg-purple-500/20 text-purple-500' : 'bg-yellow-500/20 text-yellow-500'}`}>
                                {sym[0]}
                             </div>
                             <div className="text-left truncate">
                                <div className="font-bold text-sm">{sym}</div>
                                <div className="text-xs text-zinc-500">PERP</div>
                             </div>
                          </div>
                          <div className="text-right shrink-0">
                             <div className="font-mono text-sm font-medium">
                                {data.price > 0 ? `$${data.price.toLocaleString()}` : <span className="animate-pulse">...</span>}
                             </div>
                             <div className={`text-xs ${symIsUp ? 'text-success' : 'text-danger'}`}>
                                {symIsUp ? '+' : ''}{data.change24h.toFixed(2)}%
                             </div>
                          </div>
                       </button>
                    );
                 })}
              </div>
           </div>

           <div className="p-4 border-t border-zinc-800 shrink-0">
               <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Wallet Assets</h2>
               <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-400 truncate mr-2">USDT</span>
                    <span className="font-mono text-sm text-white">${portfolio.cashBalance.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-400 truncate mr-2">{activeSymbol}</span>
                    <span className="font-mono text-sm text-white">{userAsset.balance.toFixed(4)}</span>
                  </div>
               </div>
           </div>

           {/* Sidebar Resize Handle */}
           <div 
             className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-50 group flex items-center justify-center"
             onMouseDown={startResizingSidebar}
           >
                <div className="h-8 w-1 rounded-full bg-zinc-700 group-hover:bg-primary opacity-0 group-hover:opacity-100 transition-opacity"></div>
           </div>
        </aside>

        {/* Right Content Area */}
        <div id="main-content" className="flex-1 flex flex-col min-w-0 bg-background/50 h-full relative">
           
           {/* Chart Section (Top) */}
           <div style={{ height: `${chartHeightPercent}%` }} className="flex flex-col border-b border-zinc-800 p-4 min-h-[200px] relative">
               {/* Header Row */}
               <div className="flex justify-between items-start mb-4 shrink-0">
                   <div className="min-w-0">
                      <div className="flex items-baseline gap-3 flex-wrap">
                         {currentAsset.price > 0 ? (
                             <h2 className="text-2xl md:text-3xl font-bold tracking-tight font-mono whitespace-nowrap">
                                {currentAsset.price.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })}
                             </h2>
                         ) : (
                             <div className="h-9 w-48 bg-zinc-800 rounded animate-pulse"></div>
                         )}
                         <span className={`text-sm font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${isUp ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>
                            {isUp ? '+' : ''}{currentAsset.change24h.toFixed(2)}%
                         </span>
                      </div>
                      <p className="text-zinc-500 text-sm mt-1 flex items-center gap-1 whitespace-nowrap">
                         <Wifi size={14} className={connectionStatus === 'connected' ? 'text-success' : 'text-zinc-600'} /> 
                         {connectionStatus === 'connected' ? 'Real-time' : 'Connecting...'}
                      </p>
                   </div>
                   
                   {/* AI Toggle */}
                   <div className={`flex items-center gap-3 p-1.5 rounded-lg border shrink-0 ${aiEnabled ? 'bg-accent/10 border-accent/30' : 'bg-zinc-900 border-zinc-700'}`}>
                      <div className="px-3 text-right hidden sm:block">
                        <span className={`block text-xs font-bold ${aiEnabled ? 'text-accent' : 'text-zinc-400'}`}>AI AUTO-TRADER</span>
                        <span className="text-[10px] text-zinc-500">{aiEnabled ? 'Gemini 2.5' : 'Standby'}</span>
                      </div>
                      <button 
                        onClick={() => setAiEnabled(!aiEnabled)}
                        className={`w-9 h-9 rounded flex items-center justify-center transition-all ${aiEnabled ? 'bg-accent text-white shadow-[0_0_15px_rgba(139,92,246,0.4)]' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                      >
                         {aiEnabled ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
                      </button>
                   </div>
               </div>

               <div className="flex-1 w-full relative bg-zinc-900/30 rounded-xl border border-zinc-800/50 overflow-hidden">
                  {isLoading && currentAsset.history.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-xs text-zinc-500">Loading data...</span>
                        </div>
                    </div>
                  ) : (
                    <div className="absolute inset-0 pt-4 pr-2 pb-2 pl-0">
                        <Chart data={currentAsset} />
                    </div>
                  )}
               </div>

                {/* Chart Resize Handle */}
               <div 
                 className="absolute bottom-0 left-0 right-0 h-1 cursor-row-resize hover:bg-primary/50 transition-colors z-50 group flex items-center justify-center"
                 onMouseDown={startResizingChart}
               >
                    <div className="w-16 h-1 rounded-full bg-zinc-700 group-hover:bg-primary opacity-0 group-hover:opacity-100 transition-opacity"></div>
               </div>
           </div>

           {/* Lower Panel: Trade & Logs */}
           <div id="bottom-panel" className="flex-1 flex min-h-0 relative overflow-hidden">
              
              {/* Execution Panel */}
              <div style={{ width: `${executionPanelWidthPercent}%` }} className="border-r border-zinc-800 p-4 overflow-y-auto min-w-[200px] relative shrink-0">
                 <h3 className="text-sm font-bold text-zinc-400 uppercase mb-4 flex items-center gap-2 whitespace-nowrap">
                    <DollarSign size={16} /> <span className="hidden sm:inline">Execution Panel</span>
                 </h3>
                 
                 <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 mb-6">
                    <button 
                       disabled={currentAsset.price === 0}
                       onClick={() => executeOrder(activeSymbol, OrderSide.BUY, (portfolio.cashBalance * 0.1) / currentAsset.price, currentAsset.price, false)}
                       className="flex flex-col items-center justify-center py-3 rounded-xl bg-success/10 border border-success/20 hover:bg-success/20 text-success transition-all group disabled:opacity-50 disabled:cursor-not-allowed min-h-[80px]"
                    >
                       <span className="text-xs font-bold uppercase mb-1 opacity-70 group-hover:opacity-100">Buy</span>
                       <span className="text-lg font-black">LONG</span>
                    </button>
                    <button 
                       disabled={currentAsset.price === 0}
                       onClick={() => executeOrder(activeSymbol, OrderSide.SELL, userAsset.balance * 0.5, currentAsset.price, false)}
                       className="flex flex-col items-center justify-center py-3 rounded-xl bg-danger/10 border border-danger/20 hover:bg-danger/20 text-danger transition-all group disabled:opacity-50 disabled:cursor-not-allowed min-h-[80px]"
                    >
                       <span className="text-xs font-bold uppercase mb-1 opacity-70 group-hover:opacity-100">Sell</span>
                       <span className="text-lg font-black">SHORT</span>
                    </button>
                 </div>
                 
                 <div className="space-y-4">
                    <div className="bg-zinc-900/50 p-3 rounded-lg border border-zinc-800">
                       <div className="flex justify-between text-xs text-zinc-500 mb-1">
                          <span>Power</span>
                          <span>{portfolio.cashBalance.toFixed(0)}</span>
                       </div>
                       <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-zinc-600 h-full" style={{width: '100%'}}></div>
                       </div>
                    </div>
                    <div className="bg-zinc-900/50 p-3 rounded-lg border border-zinc-800">
                       <div className="flex justify-between text-xs text-zinc-500 mb-1">
                          <span>Pos</span>
                          <span>{userAsset.balance.toFixed(3)}</span>
                       </div>
                       <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-primary h-full" style={{width: `${Math.min((userAsset.balance * currentAsset.price / portfolioValue) * 100, 100)}%`}}></div>
                       </div>
                    </div>
                 </div>

                 {/* Panel Resize Handle */}
                 <div 
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-50 group flex items-center justify-center"
                    onMouseDown={startResizingBottomPanel}
                 >
                     <div className="h-8 w-1 rounded-full bg-zinc-700 group-hover:bg-primary opacity-0 group-hover:opacity-100 transition-opacity"></div>
                 </div>
              </div>

              {/* Logs & History */}
              <div className="flex-1 flex flex-col min-w-0">
                 <div className="border-b border-zinc-800 p-2 flex gap-4 shrink-0 overflow-x-auto">
                    <div className="text-xs font-bold px-3 py-1.5 text-white border-b-2 border-primary whitespace-nowrap">AI Reasoning</div>
                    <div className="text-xs font-bold px-3 py-1.5 text-zinc-500 whitespace-nowrap">Order History</div>
                 </div>

                 <div className="flex-1 flex flex-col min-h-0">
                    {/* AI Logs Half */}
                    <div className="flex-1 overflow-y-auto p-4 border-b border-zinc-800/50 font-mono text-xs space-y-1.5 scroll-smooth min-h-0">
                       {aiLogs.length === 0 && (
                         <div className="h-full flex flex-col items-center justify-center text-zinc-600 opacity-50">
                             <BrainCircuit size={24} className="mb-2" />
                             <span>AI Engine Idle</span>
                         </div>
                       )}
                       {aiLogs.map((log, idx) => (
                          <motion.div 
                            key={idx}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex gap-3"
                          >
                             <span className="text-zinc-600 select-none shrink-0">[{log.time}]</span>
                             <span className={`break-words ${log.sentiment === 'positive' ? 'text-success' : log.sentiment === 'negative' ? 'text-danger' : 'text-zinc-300'}`}>
                                {log.msg}
                             </span>
                          </motion.div>
                       ))}
                    </div>

                    {/* Order History Half */}
                    <div className="h-1/2 bg-surface/20 flex flex-col min-h-[100px]">
                       <div className="px-4 py-2 bg-zinc-900/50 text-[10px] text-zinc-500 uppercase font-bold tracking-wider border-b border-zinc-800 flex justify-between shrink-0">
                           <span>Recent Transactions</span>
                           <span>Synced</span>
                       </div>
                       <div className="flex-1 min-h-0">
                           <OrderHistory orders={orders} />
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </main>
    </div>
  );
};

export default App;