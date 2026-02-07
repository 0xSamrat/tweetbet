"use client";

import { useState } from "react";
import type { MarketData } from "@/hooks/useMarkets";
import { TradeModal } from "@/components/TradeModal";

interface MarketCardProps {
  market: MarketData;
  onClick?: (market: MarketData) => void;
  onTradeSuccess?: () => void;
}

export function MarketCard({ market, onClick, onTradeSuccess }: MarketCardProps) {
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [tradeSide, setTradeSide] = useState<"yes" | "no">("yes");

  const handleClick = () => {
    if (onClick) onClick(market);
  };

  const handleYesClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTradeSide("yes");
    setShowTradeModal(true);
  };

  const handleNoClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTradeSide("no");
    setShowTradeModal(true);
  };

  const handleTradeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTradeSide("yes");
    setShowTradeModal(true);
  };

  // Status badge
  const getStatusBadge = () => {
    if (market.isResolved) {
      return (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          market.outcome 
            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
        }`}>
          {market.outcome ? "YES Won" : "NO Won"}
        </span>
      );
    }
    if (market.isOpen) {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
          Open
        </span>
      );
    }
    return (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
        Closed
      </span>
    );
  };

  // Probability bar color
  const getProbabilityColor = (prob: number) => {
    if (prob >= 70) return "bg-green-500";
    if (prob >= 50) return "bg-blue-500";
    if (prob >= 30) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div
      onClick={handleClick}
      className="group relative bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-lg transition-all cursor-pointer"
    >
      {/* Header: Status + Time */}
      <div className="flex items-center justify-between mb-3">
        {getStatusBadge()}
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {market.timeRemaining}
        </span>
      </div>

      {/* Question */}
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
        {market.description}
      </h3>

      {/* X Post Link */}
      {market.xPost && (
        <a
          href={market.xPost.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-blue-500 dark:text-zinc-400 dark:hover:text-blue-400 mb-4 transition-colors"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          <span>@{market.xPost.user}</span>
        </a>
      )}

      {/* Probability Display */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-zinc-600 dark:text-zinc-400">Probability</span>
          <span className="font-bold text-zinc-900 dark:text-white">
            {market.yesProbability}% YES
          </span>
        </div>
        <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full ${getProbabilityColor(market.yesProbability)} transition-all`}
            style={{ width: `${market.yesProbability}%` }}
          />
        </div>
      </div>

      {/* Stats Row */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          {/* Volume */}
          <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <span>{parseFloat(market.totalVolume).toFixed(4)} ETH</span>
          </div>
        </div>

        {/* Trade Button */}
        {market.isOpen && (
          <button
            onClick={handleTradeClick}
            className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-medium hover:from-blue-700 hover:to-purple-700 transition-all"
          >
            Trade
          </button>
        )}
      </div>

      {/* YES/NO Buttons for quick action */}
      {market.isOpen && (
        <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
          <button
            onClick={handleYesClick}
            className="py-2.5 rounded-xl bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400 font-semibold text-sm transition-colors"
          >
            Yes {market.yesProbability}%
          </button>
          <button
            onClick={handleNoClick}
            className="py-2.5 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 font-semibold text-sm transition-colors"
          >
            No {100 - market.yesProbability}%
          </button>
        </div>
      )}

      {/* Trade Modal */}
      <TradeModal
        isOpen={showTradeModal}
        onClose={() => setShowTradeModal(false)}
        market={market}
        initialSide={tradeSide}
        onSuccess={onTradeSuccess}
      />
    </div>
  );
}

// Skeleton loader for market cards
export function MarketCardSkeleton() {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="h-6 w-16 bg-zinc-200 dark:bg-zinc-700 rounded-full" />
        <div className="h-4 w-12 bg-zinc-200 dark:bg-zinc-700 rounded" />
      </div>

      {/* Question */}
      <div className="space-y-2 mb-4">
        <div className="h-5 w-full bg-zinc-200 dark:bg-zinc-700 rounded" />
        <div className="h-5 w-3/4 bg-zinc-200 dark:bg-zinc-700 rounded" />
      </div>

      {/* Probability */}
      <div className="mb-4">
        <div className="flex justify-between mb-2">
          <div className="h-4 w-20 bg-zinc-200 dark:bg-zinc-700 rounded" />
          <div className="h-4 w-16 bg-zinc-200 dark:bg-zinc-700 rounded" />
        </div>
        <div className="h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full" />
      </div>

      {/* Stats */}
      <div className="flex justify-between">
        <div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-700 rounded" />
        <div className="h-8 w-16 bg-zinc-200 dark:bg-zinc-700 rounded-lg" />
      </div>

      {/* Buttons */}
      <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
        <div className="h-10 bg-zinc-200 dark:bg-zinc-700 rounded-xl" />
        <div className="h-10 bg-zinc-200 dark:bg-zinc-700 rounded-xl" />
      </div>
    </div>
  );
}
