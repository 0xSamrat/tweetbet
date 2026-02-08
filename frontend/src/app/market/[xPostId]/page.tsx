"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createPublicClient, http } from "viem";
import { arcTestnet } from "viem/chains";
import { Header } from "@/components/Header";
import { AddLiquidityModal } from "@/components/AddLiquidityModal";
import { getMarketByXPostId } from "@/services/marketService";
import { useMarketFactory } from "@/hooks/useMarketFactory";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/contexts/ToastContext";
import type { MarketRecord } from "@/services/marketService";
import Link from "next/link";

interface PoolState {
  yesBalance: bigint;
  noBalance: bigint;
  k: bigint;
  totalLiquidity: bigint;
  pYesNum: bigint;
  pYesDen: bigint;
}

interface PricePoint {
  timestamp: number;
  yesPrice: number;
  noPrice: number;
}

export default function MarketPage() {
  const params = useParams();
  const xPostId = params.xPostId as string;
  
  const wallet = useWallet();
  const { addToast, updateToast } = useToast();
  const { buyYes, buyNo, isLoading: txLoading } = useMarketFactory();
  
  const [market, setMarket] = useState<MarketRecord | null>(null);
  const [poolState, setPoolState] = useState<PoolState | null>(null);
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Trade form state
  const [tradeAmount, setTradeAmount] = useState("5");
  const [tradeType, setTradeType] = useState<"yes" | "no">("yes");
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [tradeSuccess, setTradeSuccess] = useState<string | null>(null);
  const [showLiquidityModal, setShowLiquidityModal] = useState(false);
  const [isTweetExpanded, setIsTweetExpanded] = useState(false);

  // Fetch market data from MongoDB
  useEffect(() => {
    async function fetchMarket() {
      try {
        setLoading(true);
        console.log("Fetching market with xPostId:", xPostId);
        const marketData = await getMarketByXPostId(xPostId);
        console.log("Market data from MongoDB:", marketData);
        if (!marketData) {
          setError(`Market not found for xPostId: ${xPostId}`);
          return;
        }
        setMarket(marketData);
        
        // Generate mock price history (in production, fetch from indexer/subgraph)
        const now = Date.now();
        const mockHistory: PricePoint[] = [];
        let yesPrice = 0.5;
        for (let i = 24; i >= 0; i--) {
          const change = (Math.random() - 0.5) * 0.1;
          yesPrice = Math.max(0.01, Math.min(0.99, yesPrice + change));
          mockHistory.push({
            timestamp: now - i * 3600000,
            yesPrice: yesPrice,
            noPrice: 1 - yesPrice,
          });
        }
        setPriceHistory(mockHistory);
        
      } catch (err) {
        console.error("Failed to fetch market:", err);
        setError("Failed to load market");
      } finally {
        setLoading(false);
      }
    }
    
    if (xPostId) {
      fetchMarket();
    }
  }, [xPostId]);

  // Fetch pool state from contract
  useEffect(() => {
    async function fetchPoolState() {
      if (!market?.marketId) return;
      
      try {
        const client = createPublicClient({
          chain: arcTestnet,
          transport: http(),
        });

        const MARKET_FACTORY_ADDRESS = process.env.NEXT_PUBLIC_MARKET_FACTORY_ADDRESS as `0x${string}`;
        
        const marketFactoryAbi = [
          {
            name: "getPoolState",
            type: "function",
            stateMutability: "view",
            inputs: [
              { name: "marketId", type: "uint256" },
              { name: "feeOrHook", type: "uint256" },
            ],
            outputs: [
              { name: "rYes", type: "uint256" },
              { name: "rNo", type: "uint256" },
              { name: "pYesNum", type: "uint256" },
              { name: "pYesDen", type: "uint256" },
            ],
          },
        ] as const;
        
        const feeBps = BigInt(30);
        
        const result = await client.readContract({
          address: MARKET_FACTORY_ADDRESS,
          abi: marketFactoryAbi,
          functionName: "getPoolState",
          args: [BigInt(market.marketId), feeBps],
        });
        
        setPoolState({
          yesBalance: result[0],
          noBalance: result[1],
          k: BigInt(0),
          totalLiquidity: result[0] + result[1],
          pYesNum: result[2],
          pYesDen: result[3],
        });
      } catch (err) {
        console.error("Failed to fetch pool state:", err);
      }
    }
    
    fetchPoolState();
  }, [market?.marketId]);

  const yesProbability = poolState 
    ? Number(poolState.pYesNum) / Number(poolState.pYesDen) * 100
    : 50;
  const noProbability = 100 - yesProbability;
  
  const yesPrice = yesProbability / 100;
  const noPrice = noProbability / 100;

  const handleTrade = async () => {
    if (!market?.marketId || !wallet.isConnected) {
      setTradeError("Please connect your wallet");
      return;
    }

    if (!poolState) {
      setTradeError("Market not found on-chain. The market may not exist or you may be on the wrong network.");
      return;
    }
    
    setTradeError(null);
    setTradeSuccess(null);
    
    // Show pending toast
    const toastId = addToast({
      type: "pending",
      title: `Buying ${tradeType.toUpperCase()} tokens...`,
      message: `Processing ${tradeAmount} USDC trade`,
    });
    
    try {
      const marketId = BigInt(market.marketId);
      
      let result;
      if (tradeType === "yes") {
        result = await buyYes({ marketId, amount: tradeAmount });
      } else {
        result = await buyNo({ marketId, amount: tradeAmount });
      }
      
      // Update toast to success with tx hash
      updateToast(toastId, {
        type: "success",
        title: "Trade Successful!",
        message: `Bought ${tradeType.toUpperCase()} tokens for ${tradeAmount} USDC`,
        txHash: result.txHash,
      });
      
      setTradeSuccess(`Successfully bought ${tradeType.toUpperCase()} tokens!`);
      
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    } catch (err) {
      console.error("Trade failed:", err);
      const errorMessage = err instanceof Error ? err.message : "Trade failed";
      
      // Update toast to error
      updateToast(toastId, {
        type: "error",
        title: "Trade Failed",
        message: errorMessage.length > 100 ? errorMessage.slice(0, 100) + "..." : errorMessage,
      });
      
      if (errorMessage.includes("reverted")) {
        setTradeError("Transaction failed. This could mean: 1) Market doesn't exist on-chain, 2) Wrong network, or 3) Insufficient funds.");
      } else {
        setTradeError(errorMessage);
      }
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTimeRemaining = (closeTime: number) => {
    const now = Date.now() / 1000;
    const diff = closeTime - now;
    if (diff <= 0) return "Closed";
    
    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);
    
    if (days > 0) return `${days}d ${hours}h left`;
    if (hours > 0) return `${hours}h left`;
    return "< 1h left";
  };

  const isMarketClosed = market ? market.closeTime * 1000 < Date.now() : false;

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950">
        <Header />
        <div className="max-w-7xl mx-auto px-4 py-20">
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-4 border-zinc-800"></div>
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-purple-500 animate-spin"></div>
            </div>
            <p className="text-zinc-400 animate-pulse">Loading market...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !market) {
    return (
      <div className="min-h-screen bg-zinc-950">
        <Header />
        <div className="max-w-7xl mx-auto px-4 py-20">
          <div className="max-w-md mx-auto text-center">
            <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-3">Market Not Found</h1>
            <p className="text-zinc-400 mb-8">{error || "This market doesn't exist or has been removed."}</p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium hover:from-purple-700 hover:to-blue-700 transition-all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Markets
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
        {/* Back Button */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-zinc-400 hover:text-white mb-6 transition-colors group"
        >
          <svg className="w-5 h-5 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Back to Markets</span>
        </Link>

        {/* Hero Section */}
        <div className="relative mb-8 p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 border border-zinc-800 overflow-hidden">
          {/* Background Glow */}
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl"></div>
          
          <div className="relative flex flex-col lg:flex-row gap-6 lg:gap-12 items-start lg:items-center">
            {/* Probability Ring */}
            <div className="relative flex-shrink-0">
              <svg className="w-32 h-32 sm:w-40 sm:h-40 -rotate-90" viewBox="0 0 120 120">
                {/* Background circle */}
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="12"
                  className="text-zinc-800"
                />
                {/* YES progress */}
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="none"
                  stroke="url(#yesGradient)"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={`${yesProbability * 3.14} 314`}
                  className="transition-all duration-1000"
                />
                <defs>
                  <linearGradient id="yesGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#22c55e" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl sm:text-4xl font-bold text-white">{yesProbability.toFixed(0)}%</span>
                <span className="text-xs text-zinc-400 uppercase tracking-wider">YES</span>
              </div>
            </div>
            
            {/* Market Info */}
            <div className="flex-1 min-w-0">
              {/* Status Badge */}
              <div className="flex items-center gap-3 mb-3">
                {isMarketClosed ? (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-zinc-700 text-zinc-300">
                    Closed
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                    Active
                  </span>
                )}
                <span className="text-sm text-zinc-500">
                  {getTimeRemaining(market.closeTime)}
                </span>
              </div>
              
              {/* Question */}
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-3 leading-tight">
                {market.question}
              </h1>
              
              {/* Description */}
              {market.description && (
                <p className="text-zinc-400 text-sm sm:text-base mb-4 line-clamp-2">
                  {market.description}
                </p>
              )}
              
              {/* Quick Stats */}
              <div className="flex flex-wrap gap-4 sm:gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500">Volume</div>
                    <div className="text-sm font-medium text-white">
                      {poolState ? (Number(poolState.totalLiquidity) / 1e18).toFixed(2) : "0"} ETH
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500">Closes</div>
                    <div className="text-sm font-medium text-white">
                      {formatDate(market.closeTime)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Side - Charts & Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Price Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="relative p-5 rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/5 border border-green-500/20 overflow-hidden group hover:border-green-500/40 transition-colors">
                <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 rounded-full blur-2xl group-hover:bg-green-500/10 transition-colors"></div>
                <div className="relative">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <span className="text-sm font-medium text-green-400">YES</span>
                  </div>
                  <div className="text-3xl sm:text-4xl font-bold text-white mb-1">
                    ${yesPrice.toFixed(2)}
                  </div>
                  <div className="text-sm text-zinc-400">
                    {yesProbability.toFixed(1)}% probability
                  </div>
                </div>
              </div>
              
              <div className="relative p-5 rounded-xl bg-gradient-to-br from-red-500/10 to-rose-500/5 border border-red-500/20 overflow-hidden group hover:border-red-500/40 transition-colors">
                <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-2xl group-hover:bg-red-500/10 transition-colors"></div>
                <div className="relative">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                    <span className="text-sm font-medium text-red-400">NO</span>
                  </div>
                  <div className="text-3xl sm:text-4xl font-bold text-white mb-1">
                    ${noPrice.toFixed(2)}
                  </div>
                  <div className="text-sm text-zinc-400">
                    {noProbability.toFixed(1)}% probability
                  </div>
                </div>
              </div>
            </div>

            {/* Price Chart */}
            <div className="p-6 rounded-xl bg-zinc-900 border border-zinc-800">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-white">Price History</h2>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <span className="text-xs text-zinc-400">YES</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                    <span className="text-xs text-zinc-400">NO</span>
                  </div>
                </div>
              </div>
              
              {/* Chart Container */}
              <div className="relative h-48 sm:h-64">
                {/* Grid Lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                  {[100, 75, 50, 25, 0].map((val) => (
                    <div key={val} className="flex items-center gap-2">
                      <span className="text-xs text-zinc-600 w-8">{val}%</span>
                      <div className="flex-1 border-t border-zinc-800/50"></div>
                    </div>
                  ))}
                </div>
                
                {/* Chart Bars */}
                <div className="absolute left-10 right-0 top-0 bottom-6 flex items-end justify-between gap-0.5 sm:gap-1">
                  {priceHistory.map((point, index) => (
                    <div key={index} className="flex-1 flex flex-col items-center group relative">
                      {/* Tooltip */}
                      <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                        <div className="bg-zinc-800 rounded-lg px-3 py-2 text-xs whitespace-nowrap shadow-xl border border-zinc-700">
                          <div className="text-green-400">YES: {(point.yesPrice * 100).toFixed(1)}%</div>
                          <div className="text-red-400">NO: {(point.noPrice * 100).toFixed(1)}%</div>
                        </div>
                      </div>
                      {/* Bar */}
                      <div
                        className="w-full rounded-t bg-gradient-to-t from-green-600 to-green-400 opacity-80 hover:opacity-100 transition-all cursor-pointer"
                        style={{ height: `${point.yesPrice * 100}%` }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Market Details */}
            <div className="p-6 rounded-xl bg-zinc-900 border border-zinc-800">
              <h2 className="text-lg font-semibold text-white mb-6">Market Details</h2>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
                <div className="p-4 rounded-lg bg-zinc-800/50">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-xs text-zinc-500">Close Time</span>
                  </div>
                  <div className="text-sm font-medium text-white">{formatDate(market.closeTime)}</div>
                </div>
                
                <div className="p-4 rounded-lg bg-zinc-800/50">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span className="text-xs text-zinc-500">Initial Liquidity</span>
                  </div>
                  <div className="text-sm font-medium text-white">{market.initialLiquidity} ETH</div>
                </div>
                
                {poolState && (
                  <div className="p-4 rounded-lg bg-zinc-800/50">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                      <span className="text-xs text-zinc-500">Total Liquidity</span>
                    </div>
                    <div className="text-sm font-medium text-white">
                      {(Number(poolState.totalLiquidity) / 1e18).toFixed(4)} ETH
                    </div>
                  </div>
                )}
                
                <div className="p-4 rounded-lg bg-zinc-800/50">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                    </svg>
                    <span className="text-xs text-zinc-500">Market ID</span>
                  </div>
                  <div className="text-sm font-medium text-white font-mono" title={market.marketId}>
                    #{market.marketId.length > 10 
                      ? `${market.marketId.slice(0, 6)}...${market.marketId.slice(-4)}`
                      : market.marketId}
                  </div>
                </div>
                
                <div className="p-4 rounded-lg bg-zinc-800/50">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                    <span className="text-xs text-zinc-500">Network</span>
                  </div>
                  <div className="text-sm font-medium text-white">Arc Testnet</div>
                </div>
                
                {market.ammAddress && (
                  <div className="p-4 rounded-lg bg-zinc-800/50">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      <span className="text-xs text-zinc-500">AMM Contract</span>
                    </div>
                    <div className="text-sm font-medium text-white font-mono">
                      {market.ammAddress.slice(0, 6)}...{market.ammAddress.slice(-4)}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Tweet Source */}
              {market.tweetContent && (
                <div className="mt-6 pt-6 border-t border-zinc-800">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-zinc-400" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-white">@{market.tweetAuthor}</span>
                        <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M8.52 3.59a6.04 6.04 0 0 1 6.96 0l.8.56.97-.12a6.04 6.04 0 0 1 4.92 4.92l-.12.97.56.8a6.04 6.04 0 0 1 0 6.96l-.56.8.12.97a6.04 6.04 0 0 1-4.92 4.92l-.97-.12-.8.56a6.04 6.04 0 0 1-6.96 0l-.8-.56-.97.12a6.04 6.04 0 0 1-4.92-4.92l.12-.97-.56-.8a6.04 6.04 0 0 1 0-6.96l.56-.8-.12-.97a6.04 6.04 0 0 1 4.92-4.92l.97.12.8-.56zm7.38 6.71a1 1 0 0 0-1.41-1.41L10 13.38l-1.79-1.79a1 1 0 0 0-1.41 1.41l2.5 2.5a1 1 0 0 0 1.41 0l5.5-5.5z" />
                        </svg>
                      </div>
                      <p className="text-zinc-300 text-sm leading-relaxed">
                        &ldquo;{market.tweetContent && market.tweetContent.length > 200 && !isTweetExpanded
                          ? market.tweetContent.slice(0, 200)
                          : market.tweetContent}&rdquo;
                        {market.tweetContent && market.tweetContent.length > 200 && (
                          <button
                            onClick={() => setIsTweetExpanded(!isTweetExpanded)}
                            className="ml-1 text-blue-400 hover:text-blue-300 font-medium"
                          >
                            {isTweetExpanded ? "show less" : "...read more"}
                          </button>
                        )}
                      </p>
                      {market.xPostUrl && (
                        <a
                          href={market.xPostUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 mt-3 text-blue-400 hover:text-blue-300 text-sm transition-colors"
                        >
                          View original post
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Side - Trade Panel */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-4">
              {/* Trade Card */}
              <div className="p-6 rounded-xl bg-gradient-to-b from-zinc-900 to-zinc-900/50 border border-zinc-800 backdrop-blur">
                <h2 className="text-lg font-semibold text-white mb-5 flex items-center gap-2">
                  <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  Trade
                </h2>
                
                {isMarketClosed ? (
                  <div className="text-center py-10">
                    <div className="w-16 h-16 mx-auto mb-4 bg-zinc-800 rounded-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <p className="text-zinc-400 font-medium">Market Closed</p>
                    <p className="text-zinc-500 text-sm mt-1">Trading is no longer available</p>
                  </div>
                ) : (
                  <>
                    {/* Trade Type Selection */}
                    <div className="grid grid-cols-2 gap-2 mb-5">
                      <button
                        onClick={() => setTradeType("yes")}
                        className={`py-3.5 px-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                          tradeType === "yes"
                            ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/25"
                            : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        YES
                      </button>
                      <button
                        onClick={() => setTradeType("no")}
                        className={`py-3.5 px-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                          tradeType === "no"
                            ? "bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-lg shadow-red-500/25"
                            : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        NO
                      </button>
                    </div>
                    
                    {/* Amount Input */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-zinc-400 mb-2">Amount</label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={tradeAmount}
                          onChange={(e) => setTradeAmount(e.target.value)}
                          className="w-full px-4 py-3.5 pr-16 rounded-xl border border-zinc-700 bg-zinc-800/50 text-white text-lg font-medium focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                          disabled={txLoading}
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 font-medium">USDC</span>
                      </div>
                    </div>
                    
                    {/* Quick Amounts */}
                    <div className="grid grid-cols-4 gap-2 mb-5">
                      {["1", "5", "10", "20"].map((amount) => (
                        <button
                          key={amount}
                          onClick={() => setTradeAmount(amount)}
                          className={`py-2 text-sm font-medium rounded-lg transition-all ${
                            tradeAmount === amount
                              ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                              : "border border-zinc-700 hover:bg-zinc-800 text-zinc-400"
                          }`}
                        >
                          {amount}
                        </button>
                      ))}
                    </div>
                    
                    {/* Trade Summary */}
                    <div className="p-4 rounded-xl bg-zinc-800/30 border border-zinc-700/50 mb-5 space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">You pay</span>
                        <span className="text-white font-medium">{tradeAmount} USDC</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">Price per share</span>
                        <span className="text-white font-medium">
                          ${tradeType === "yes" ? yesPrice.toFixed(3) : noPrice.toFixed(3)}
                        </span>
                      </div>
                      <div className="pt-3 border-t border-zinc-700/50 flex justify-between">
                        <span className="text-zinc-400">Est. shares</span>
                        <span className={`text-lg font-bold ${tradeType === "yes" ? "text-green-400" : "text-red-400"}`}>
                          ~{(parseFloat(tradeAmount) / (tradeType === "yes" ? yesPrice : noPrice)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                    
                    {/* Messages */}
                    {tradeError && (
                      <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                        <div className="flex items-start gap-3">
                          <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="text-sm text-red-400">{tradeError}</p>
                        </div>
                      </div>
                    )}
                    {tradeSuccess && (
                      <div className="mb-4 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                        <div className="flex items-start gap-3">
                          <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="text-sm text-green-400">{tradeSuccess}</p>
                        </div>
                      </div>
                    )}
                    
                    {/* Trade Button */}
                    <button
                      onClick={handleTrade}
                      disabled={txLoading || !wallet.isConnected}
                      className={`w-full py-4 px-6 rounded-xl font-bold text-white transition-all ${
                        tradeType === "yes"
                          ? "bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 shadow-lg shadow-green-500/20"
                          : "bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 shadow-lg shadow-red-500/20"
                      } disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none`}
                    >
                      {txLoading ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Processing...
                        </span>
                      ) : !wallet.isConnected ? (
                        "Connect Wallet to Trade"
                      ) : (
                        `Buy ${tradeType.toUpperCase()} for ${tradeAmount} USDC`
                      )}
                    </button>
                  </>
                )}
              </div>
              
              {/* Add Liquidity Card */}
              {!isMarketClosed && (
                <div className="p-5 rounded-xl bg-gradient-to-br from-purple-500/5 to-blue-500/5 border border-purple-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">Provide Liquidity</h3>
                      <p className="text-xs text-zinc-400">Earn fees from trades</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowLiquidityModal(true)}
                    disabled={!wallet.isConnected}
                    className="w-full py-3 px-4 rounded-lg font-medium text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    Add Liquidity
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      
      {/* Add Liquidity Modal */}
      <AddLiquidityModal
        isOpen={showLiquidityModal}
        onClose={() => setShowLiquidityModal(false)}
        market={{
          marketId: market.marketId,
          question: market.question,
          yesProbability: yesProbability,
          totalVolume: poolState ? (Number(poolState.totalLiquidity) / 1e18).toFixed(4) : "0",
        }}
        onSuccess={() => {
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        }}
      />
    </div>
  );
}
