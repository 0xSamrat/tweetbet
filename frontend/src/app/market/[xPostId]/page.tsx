"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createPublicClient, http } from "viem";
import { arcTestnet } from "viem/chains";
import { Header } from "@/components/Header";
import { getMarketByXPostId } from "@/services/marketService";
import { useMarketFactory } from "@/hooks/useMarketFactory";
import { useWallet } from "@/contexts/WalletContext";
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
  const { buyYes, buyNo, isLoading: txLoading } = useMarketFactory();
  
  const [market, setMarket] = useState<MarketRecord | null>(null);
  const [poolState, setPoolState] = useState<PoolState | null>(null);
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Trade form state
  const [tradeAmount, setTradeAmount] = useState("0.1");
  const [tradeType, setTradeType] = useState<"yes" | "no">("yes");
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [tradeSuccess, setTradeSuccess] = useState<string | null>(null);

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

  // Fetch pool state from contract - use marketId to get pool state from MarketFactory
  useEffect(() => {
    async function fetchPoolState() {
      if (!market?.marketId) return;
      
      try {
        const client = createPublicClient({
          chain: arcTestnet,
          transport: http(),
        });

        const MARKET_FACTORY_ADDRESS = process.env.NEXT_PUBLIC_MARKET_FACTORY_ADDRESS as `0x${string}`;
        
        // Use getPoolState from MarketFactory (takes marketId and feeOrHook)
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
        
        const feeBps = BigInt(30); // 0.3% fee - same as used when creating markets
        
        console.log("Fetching pool state for marketId:", market.marketId);
        
        const result = await client.readContract({
          address: MARKET_FACTORY_ADDRESS,
          abi: marketFactoryAbi,
          functionName: "getPoolState",
          args: [BigInt(market.marketId), feeBps],
        });
        
        console.log("Pool state result:", result);
        
        setPoolState({
          yesBalance: result[0],
          noBalance: result[1],
          k: BigInt(0), // Not returned by getPoolState
          totalLiquidity: result[0] + result[1], // Approximate
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

    // Check if pool state was fetched (meaning market exists on-chain)
    if (!poolState) {
      setTradeError("Market not found on-chain. The market may not exist or you may be on the wrong network.");
      return;
    }
    
    setTradeError(null);
    setTradeSuccess(null);
    
    try {
      const marketId = BigInt(market.marketId);
      console.log("Trading on market:", marketId.toString(), "Amount:", tradeAmount, "Type:", tradeType);
      
      if (tradeType === "yes") {
        await buyYes({ marketId, amount: tradeAmount });
      } else {
        await buyNo({ marketId, amount: tradeAmount });
      }
      
      setTradeSuccess(`Successfully bought ${tradeType.toUpperCase()} tokens!`);
      
      // Refresh pool state after trade
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      console.error("Trade failed:", err);
      const errorMessage = err instanceof Error ? err.message : "Trade failed";
      // Provide more helpful error message
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
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isMarketClosed = market ? market.closeTime * 1000 < Date.now() : false;

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950">
        <Header />
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !market) {
    return (
<div className="min-h-screen bg-zinc-950">
        <Header />
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white mb-4">
              Market Not Found
            </h1>
            <p className="text-zinc-400 mb-6">
              {error || "This market does not exist."}
            </p>
            <Link
              href="/"
              className="inline-flex items-center px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              ← Back to Markets
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Back Button */}
        <Link
          href="/"
          className="inline-flex items-center text-zinc-400 hover:text-zinc-200 mb-6 transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Markets
        </Link>

        {/* Market Title */}
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-6">
          {market.description}
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Side - Price Chart */}
          <div className="lg:col-span-2">
            <div className="bg-zinc-900 rounded-md border border-zinc-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">
                Price History
              </h2>
              
              {/* Simple Chart Visualization */}
              <div className="relative h-64 bg-zinc-800/50 rounded-md p-4">
                <div className="absolute inset-4 flex items-end justify-between gap-1">
                  {priceHistory.map((point, index) => (
                    <div
                      key={index}
                      className="flex-1 flex flex-col items-center gap-1"
                    >
                      <div
                        className="w-full bg-green-500 rounded-t transition-all"
                        style={{ height: `${point.yesPrice * 200}px` }}
                        title={`YES: ${(point.yesPrice * 100).toFixed(1)}%`}
                      />
                    </div>
                  ))}
                </div>
                
                {/* Y-axis labels */}
                <div className="absolute left-0 top-4 bottom-4 flex flex-col justify-between text-xs text-zinc-400">
                  <span>100%</span>
                  <span>50%</span>
                  <span>0%</span>
                </div>
              </div>
              
              {/* Chart Legend */}
              <div className="flex items-center gap-6 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-zinc-400">YES Price</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-sm text-zinc-400">NO Price</span>
                </div>
              </div>
              
              {/* Current Prices */}
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="bg-green-900/20 rounded-md p-4 border border-green-900/30">
                  <div className="text-sm text-green-400 mb-1">YES Price</div>
                  <div className="text-2xl font-bold text-green-300">
                    ${yesPrice.toFixed(2)}
                  </div>
                  <div className="text-sm text-green-400">
                    {yesProbability.toFixed(1)}% chance
                  </div>
                </div>
                <div className="bg-red-900/20 rounded-md p-4 border border-red-900/30">
                  <div className="text-sm text-red-400 mb-1">NO Price</div>
                  <div className="text-2xl font-bold text-red-300">
                    ${noPrice.toFixed(2)}
                  </div>
                  <div className="text-sm text-red-400">
                    {noProbability.toFixed(1)}% chance
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Trade Panel */}
          <div className="lg:col-span-1">
            <div className="bg-zinc-900 rounded-md border border-zinc-800 p-6 sticky top-24">
              <h2 className="text-lg font-semibold text-white mb-4">
                Trade
              </h2>
              
              {isMarketClosed ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <p className="text-zinc-400">
                    This market has closed
                  </p>
                </div>
              ) : (
                <>
                  {/* Trade Type Selection */}
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <button
                      onClick={() => setTradeType("yes")}
                      className={`py-3 px-4 rounded-md font-semibold transition-all ${
                        tradeType === "yes"
                          ? "bg-green-500 text-white"
                          : "bg-zinc-800 text-zinc-400 hover:bg-green-900/20"
                      }`}
                    >
                      Buy YES
                    </button>
                    <button
                      onClick={() => setTradeType("no")}
                      className={`py-3 px-4 rounded-md font-semibold transition-all ${
                        tradeType === "no"
                          ? "bg-red-500 text-white"
                          : "bg-zinc-800 text-zinc-400 hover:bg-red-900/20"
                      }`}
                    >
                      Buy NO
                    </button>
                  </div>
                  
                  {/* Amount Input */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      Amount (USDC)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={tradeAmount}
                      onChange={(e) => setTradeAmount(e.target.value)}
                      className="w-full px-4 py-3 rounded-md border border-zinc-700 bg-zinc-800 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={txLoading}
                    />
                  </div>
                  
                  {/* Quick Amounts */}
                  <div className="flex gap-2 mb-6">
                    {["0.1", "0.5", "1", "5"].map((amount) => (
                      <button
                        key={amount}
                        onClick={() => setTradeAmount(amount)}
                        className="flex-1 py-2 text-sm font-medium rounded-md border border-zinc-700 hover:bg-zinc-800 text-zinc-400 transition-colors"
                      >
                        {amount}
                      </button>
                    ))}
                  </div>
                  
                  {/* Trade Summary */}
                  <div className="bg-zinc-800/50 rounded-md p-4 mb-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-zinc-400">You pay</span>
                      <span className="text-white font-medium">
                        {tradeAmount} USDC
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-zinc-400">Price per share</span>
                      <span className="text-white font-medium">
                        ${tradeType === "yes" ? yesPrice.toFixed(3) : noPrice.toFixed(3)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-400">Est. shares</span>
                      <span className="text-white font-medium">
                        ~{(parseFloat(tradeAmount) / (tradeType === "yes" ? yesPrice : noPrice)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Error/Success Messages */}
                  {tradeError && (
                    <div className="mb-4 p-3 bg-red-900/20 rounded-md border border-red-900/30">
                      <p className="text-sm text-red-400">{tradeError}</p>
                    </div>
                  )}
                  {tradeSuccess && (
                    <div className="mb-4 p-3 bg-green-900/20 rounded-md border border-green-900/30">
                      <p className="text-sm text-green-400">{tradeSuccess}</p>
                    </div>
                  )}
                  
                  {/* Trade Button */}
                  <button
                    onClick={handleTrade}
                    disabled={txLoading || !wallet.isConnected}
                    className={`w-full py-4 px-6 rounded-md font-bold text-white transition-all ${
                      tradeType === "yes"
                        ? "bg-green-500 hover:bg-green-600"
                        : "bg-red-500 hover:bg-red-600"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
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
          </div>
        </div>

        {/* Market Info Section */}
        <div className="mt-8 bg-zinc-900 rounded-md border border-zinc-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-6">
            Market Information
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Close Time */}
            <div>
              <div className="text-sm text-zinc-400 mb-1">Closes</div>
              <div className="text-white font-medium">
                {formatDate(market.closeTime)}
              </div>
            </div>
            
            {/* Initial Liquidity */}
            <div>
              <div className="text-sm text-zinc-400 mb-1">Initial Liquidity</div>
              <div className="text-white font-medium">
                {market.initialLiquidity} USDC
              </div>
            </div>
            
            {/* Total Liquidity */}
            {poolState && (
              <div>
                <div className="text-sm text-zinc-400 mb-1">Total Liquidity</div>
                <div className="text-white font-medium">
                  {(Number(poolState.totalLiquidity) / 1e18).toFixed(4)} USDC
                </div>
              </div>
            )}
            
            {/* AMM Address */}
            {market.ammAddress && (
              <div>
                <div className="text-sm text-zinc-400 mb-1">AMM Contract</div>
                <div className="text-white font-mono text-sm">
                  {market.ammAddress.slice(0, 6)}...{market.ammAddress.slice(-4)}
                </div>
              </div>
            )}
            
            {/* Market ID */}
            <div>
              <div className="text-sm text-zinc-400 mb-1">Market ID</div>
              <div className="text-white font-mono text-sm" title={`#${market.marketId}`}>
                #{market.marketId.length > 12 
                  ? `${market.marketId.slice(0, 4)}...${market.marketId.slice(-4)}`
                  : market.marketId}
              </div>
            </div>
            
            {/* Chain */}
            <div>
              <div className="text-sm text-zinc-400 mb-1">Chain</div>
              <div className="text-white font-medium">
                Citrea Testnet
              </div>
            </div>
          </div>
          
          {/* AI Context */}
          {market.aiContext && (
            <div className="mt-6 pt-6 border-t border-zinc-700">
              <div className="text-sm text-zinc-400 mb-2">AI Context</div>
              <p className="text-zinc-300">
                {market.aiContext}
              </p>
            </div>
          )}
          
          {/* Tweet Content */}
          {market.tweetContent && (
            <div className="mt-6 pt-6 border-t border-zinc-700">
              <div className="text-sm text-zinc-400 mb-2">
                Source Tweet by @{market.tweetAuthor}
              </div>
              <p className="text-zinc-300 italic">
                &ldquo;{market.tweetContent}&rdquo;
              </p>
              {market.xPostUrl && (
                <a
                  href={market.xPostUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 mt-3 text-blue-400 hover:text-blue-300 text-sm"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  View on X
                </a>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
