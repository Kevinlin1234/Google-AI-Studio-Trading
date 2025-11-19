import React from 'react';
import { Order, OrderSide } from '../types';
import { Bot, User } from 'lucide-react';

interface OrderHistoryProps {
  orders: Order[];
}

const OrderHistory: React.FC<OrderHistoryProps> = ({ orders }) => {
  // Sort by latest
  const sortedOrders = [...orders].sort((a, b) => b.timestamp - a.timestamp);

  if (sortedOrders.length === 0) {
    return <div className="text-zinc-500 text-sm text-center py-4">No recent orders</div>;
  }

  return (
    <div className="w-full h-full overflow-hidden flex flex-col">
      <div className="overflow-auto flex-1 w-full">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="text-xs text-zinc-500 sticky top-0 bg-[#18181b] z-10 uppercase shadow-sm">
            <tr>
              <th className="px-3 py-2 font-medium bg-[#18181b]">Time</th>
              <th className="px-3 py-2 font-medium bg-[#18181b]">Pair</th>
              <th className="px-3 py-2 font-medium bg-[#18181b]">Side</th>
              <th className="px-3 py-2 font-medium bg-[#18181b]">Price</th>
              <th className="px-3 py-2 font-medium bg-[#18181b] text-right">Total</th>
              <th className="px-3 py-2 font-medium bg-[#18181b] text-center">Via</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {sortedOrders.map((order) => (
              <tr key={order.id} className="group hover:bg-zinc-800/50 transition-colors">
                <td className="px-3 py-2 text-zinc-400 font-mono text-xs">
                  {new Date(order.timestamp).toLocaleTimeString()}
                </td>
                <td className="px-3 py-2 font-bold text-zinc-200">{order.symbol}/USDT</td>
                <td className={`px-3 py-2 font-bold ${order.side === OrderSide.BUY ? 'text-success' : 'text-danger'}`}>
                  {order.side}
                </td>
                <td className="px-3 py-2 font-mono text-zinc-300">${order.price.toFixed(order.symbol === 'DOGE' ? 5 : 2)}</td>
                <td className="px-3 py-2 text-right font-mono text-zinc-300">${order.total.toFixed(2)}</td>
                <td className="px-3 py-2 text-center">
                  {order.isAiTriggered ? (
                    <div className="flex items-center justify-center text-accent" title={order.reason}>
                       <Bot size={14} />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center text-zinc-500">
                      <User size={14} />
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OrderHistory;