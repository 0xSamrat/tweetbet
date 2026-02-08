"use client";

import { useState } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { Header } from "@/components/Header";
import { MarketCard, MarketCardSkeleton } from "@/components/MarketCard";
import { useMarkets, type MarketData } from "@/hooks/useMarkets";
import { arcTestnet } from "viem/chains";

export default function Home() {
  const { isConnected, isReady, chainId } = useWallet();
  const { markets, isLoading, error, hasMore, refreshMarkets } = useMarkets(chainId || arcTestnet.id);

  const handleMarketClick = (market: MarketData) => {
    console.log("Market clicked:", market.marketId.toString());
    // TODO: Navigate to market detail page or open trading modal
  };

  return (
    <div className="min-h-screen bg-[#09090b]">
      <Header />
      
      {/* Main content with padding for fixed header */}
      <main className="pt-16">
        {/* Not logged in - show welcome + markets */}
        {!isConnected && (
          <>
            {/* Hero Section */}
            <div className="bg-gradient-to-b from-blue-600/10 to-transparent py-16 px-4">
              <div className="max-w-4xl mx-auto text-center space-y-6">
                <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  TweetBet
                </h1>
                <p className="text-xl text-zinc-400 max-w-md mx-auto">
                  Predict outcomes from tweets with gasless transactions
                </p>
                <div className="flex items-center justify-center gap-4 text-sm text-zinc-400">
                  <span className="flex items-center gap-2">
                    <span className="text-green-500">✓</span> No gas fees
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-green-500">✓</span> Passkey secured
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-green-500">✓</span> MetaMask support
                  </span>
                </div>
              </div>
            </div>

            {/* Markets Section */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
              <MarketsSection
                markets={markets}
                isLoading={isLoading}
                error={error}
                onRefresh={refreshMarkets}
                onMarketClick={handleMarketClick}
              />
            </div>
          </>
        )}

        {/* Loading account */}
        {isConnected && !isReady && (
          <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
            <div className="text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
              <p className="mt-4 text-zinc-400">
                Loading account...
              </p>
            </div>
          </div>
        )}

        {/* Logged in - show markets */}
        {isConnected && isReady && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <MarketsSection
              markets={markets}
              isLoading={isLoading}
              error={error}
              onRefresh={refreshMarkets}
              onMarketClick={handleMarketClick}
            />
          </div>
        )}
      </main>
    </div>
  );
}

// Markets Section Component
interface MarketsSectionProps {
  markets: MarketData[];
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  onMarketClick: (market: MarketData) => void;
}

type MarketTab = "open" | "closed";

function MarketsSection({ markets, isLoading, error, onRefresh, onMarketClick }: MarketsSectionProps) {
  const [activeTab, setActiveTab] = useState<MarketTab>("open");
  
  // Filter markets by status
  const openMarkets = markets.filter(m => m.isOpen && !m.isResolved);
  const closedMarkets = markets.filter(m => !m.isOpen || m.isResolved);
  
  // Get markets for current tab
  const displayedMarkets = activeTab === "open" ? openMarkets : closedMarkets;

  return (
    <div>
      {/* Section Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">
            Prediction Markets
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            {markets.length} markets • {openMarkets.length} open • {closedMarkets.length} closed
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-colors disabled:opacity-50"
        >
          <svg
            className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab("open")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "open"
              ? "bg-green-600 text-white shadow-lg shadow-green-900/30"
              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300"
          }`}
        >
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Open Markets
            <span className={`px-1.5 py-0.5 rounded text-xs ${
              activeTab === "open" ? "bg-green-700" : "bg-zinc-700"
            }`}>
              {openMarkets.length}
            </span>
          </span>
        </button>
        <button
          onClick={() => setActiveTab("closed")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "closed"
              ? "bg-zinc-600 text-white shadow-lg shadow-zinc-900/30"
              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300"
          }`}
        >
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-zinc-500" />
            Closed / Resolved
            <span className={`px-1.5 py-0.5 rounded text-xs ${
              activeTab === "closed" ? "bg-zinc-700" : "bg-zinc-700"
            }`}>
              {closedMarkets.length}
            </span>
          </span>
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-8 p-4 rounded-xl bg-red-900/20 border border-red-800">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-red-400">
                Failed to load markets
              </p>
              <p className="text-xs text-red-500 mt-0.5">
                {error}
              </p>
            </div>
            <button
              onClick={onRefresh}
              className="ml-auto text-sm text-red-400 hover:text-red-300 font-medium"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && markets.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <MarketCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && displayedMarkets.length === 0 && !error && (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-800 flex items-center justify-center">
            <svg className="w-8 h-8 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">
            {activeTab === "open" ? "No open markets" : "No closed markets"}
          </h3>
          <p className="text-zinc-400 max-w-sm mx-auto">
            {activeTab === "open" 
              ? "Be the first to create a prediction market! Click the + button in the header to get started."
              : "No markets have been closed or resolved yet."}
          </p>
        </div>
      )}

      {/* Markets Grid */}
      {displayedMarkets.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedMarkets.map((market) => (
            <MarketCard
              key={market.marketId.toString()}
              market={market}
              onClick={onMarketClick}
              onTradeSuccess={onRefresh}
            />
          ))}
        </div>
      )}

      {/* Stats Footer */}
      {markets.length > 0 && (
        <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            label="Total Markets"
            value={markets.length.toString()}
            icon="📊"
          />
          <StatCard
            label="Open Markets"
            value={openMarkets.length.toString()}
            icon="🟢"
          />
          <StatCard
            label="Closed / Resolved"
            value={closedMarkets.length.toString()}
            icon="🔴"
          />
          <StatCard
            label="Total Volume"
            value={`${markets.reduce((acc, m) => acc + parseFloat(m.totalVolume), 0).toFixed(2)} USDC`}
            icon="💰"
          />
        </div>
      )}
    </div>
  );
}

// Stat Card Component
interface StatCardProps {
  label: string;
  value: string;
  icon: string;
}

function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className="text-xs text-zinc-400">{label}</p>
          <p className="text-lg font-bold text-white">{value}</p>
        </div>
      </div>
    </div>
  );
}
