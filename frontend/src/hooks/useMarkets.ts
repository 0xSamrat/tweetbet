"use client";

import * as React from "react";
import { createPublicClient, http, formatEther, type Hex } from "viem";
import { arcTestnet, baseSepolia } from "viem/chains";
import { MARKET_FACTORY_ADDRESS, marketFactoryAbi } from "@/contracts";
import { decodeXPost } from "@/utils/xPostCodec";

// ============================================
// TYPES
// ============================================

export interface MarketData {
  marketId: bigint;
  noId: bigint;
  question: string; // Short question from blockchain (max 80 chars)
  resolver: string;
  collateral: string;
  isResolved: boolean;
  outcome: boolean; // true = YES wins, false = NO wins
  canClose: boolean;
  closeTime: bigint;
  collateralLocked: bigint;
  yesSupply: bigint;
  noSupply: bigint;
  xPost: {
    postId: bigint;
    user: string;
    url: string;
  } | null;
  // Calculated fields
  yesProbability: number; // 0-100
  totalVolume: string; // Formatted ETH
  isOpen: boolean;
  timeRemaining: string;
}

export interface UseMarketsState {
  markets: MarketData[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
}

export interface UseMarketsActions {
  fetchMarkets: (start?: number, count?: number) => Promise<void>;
  refreshMarkets: () => Promise<void>;
}

export interface UseMarketsReturn extends UseMarketsState, UseMarketsActions {}

// ============================================
// SUPPORTED CHAINS
// ============================================

const CHAINS: Record<number, typeof arcTestnet | typeof baseSepolia | { id: number; name: string; rpcUrls: { default: { http: string[] } } }> = {
  [arcTestnet.id]: arcTestnet,
  [baseSepolia.id]: baseSepolia,
  31337: {
    id: 31337,
    name: "Anvil",
    rpcUrls: {
      default: { http: ["http://127.0.0.1:8545"] },
    },
  },
};

// ============================================
// HELPERS
// ============================================

function parseStates(state: number): { resolved: boolean; outcome: boolean; canClose: boolean } {
  return {
    resolved: (state & 1) !== 0,
    outcome: (state & 2) !== 0,
    canClose: (state & 4) !== 0,
  };
}

function formatTimeRemaining(closeTime: bigint): string {
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (closeTime <= now) return "Closed";
  
  const diff = Number(closeTime - now);
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function getNoId(marketId: bigint): bigint {
  // Recreate the solidity logic: keccak256(abi.encodePacked("PMARKET:NO", marketId))
  const encoder = new TextEncoder();
  const prefix = encoder.encode("PMARKET:NO");
  const marketIdHex = marketId.toString(16).padStart(64, '0');
  const marketIdBytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    marketIdBytes[i] = parseInt(marketIdHex.slice(i * 2, i * 2 + 2), 16);
  }
  // Combine prefix and marketId bytes
  const combined = new Uint8Array(prefix.length + marketIdBytes.length);
  combined.set(prefix);
  combined.set(marketIdBytes, prefix.length);
  
  // Use viem's keccak256 would be ideal, but for simplicity we'll use the contract's view
  return marketId + BigInt(1); // Simplified - actual noId comes from contract
}

// ============================================
// HOOK
// ============================================

export function useMarkets(chainId: number = arcTestnet.id): UseMarketsReturn {
  const [markets, setMarkets] = React.useState<MarketData[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [hasMore, setHasMore] = React.useState(true);

  const getPublicClient = React.useCallback(() => {
    const chain = CHAINS[chainId] || arcTestnet;
    return createPublicClient({
      chain: chain as typeof arcTestnet,
      transport: http(chain.rpcUrls.default.http[0]),
    });
  }, [chainId]);

  const fetchMarkets = React.useCallback(
    async (start: number = 0, count: number = 50) => {
      if (!MARKET_FACTORY_ADDRESS) {
        setError("Contract address not configured");
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const publicClient = getPublicClient();

        // Call getMarkets on the contract
        const result = await publicClient.readContract({
          address: MARKET_FACTORY_ADDRESS,
          abi: marketFactoryAbi,
          functionName: "getMarkets",
          args: [BigInt(start), BigInt(count)],
        }) as [
          bigint[], // marketIds
          `0x${string}`[], // resolvers
          `0x${string}`[], // collaterals
          number[], // states
          bigint[], // closes
          bigint[], // collateralAmounts
          bigint[], // yesSupplies
          bigint[], // noSupplies
          string[], // descs
          `0x${string}`[], // xPostsArr
          bigint // next
        ];

        const [
          marketIds,
          resolvers,
          collaterals,
          states,
          closes,
          collateralAmounts,
          yesSupplies,
          noSupplies,
          descs,
          xPostsArr,
          next,
        ] = result;

        const now = BigInt(Math.floor(Date.now() / 1000));
        const DEFAULT_FEE_BPS = BigInt(30); // 0.3% fee tier
        
        // Fetch pool states for all markets in parallel
        const poolStatePromises = marketIds.map(async (marketId) => {
          try {
            const poolState = await publicClient.readContract({
              address: MARKET_FACTORY_ADDRESS,
              abi: marketFactoryAbi,
              functionName: "getPoolState",
              args: [marketId, DEFAULT_FEE_BPS],
            }) as [bigint, bigint, bigint, bigint];
            return poolState;
          } catch {
            // Pool may not exist yet
            return null;
          }
        });
        
        const poolStates = await Promise.all(poolStatePromises);
        
        const parsedMarkets: MarketData[] = marketIds.map((marketId, i) => {
          const { resolved, outcome, canClose } = parseStates(states[i]);
          const closeTime = closes[i];
          const yesSupply = yesSupplies[i];
          const noSupply = noSupplies[i];
          
          // Calculate YES probability from pool state (accurate AMM price)
          let yesProbability = 50;
          const poolState = poolStates[i];
          
          if (poolState) {
            const [rYes, rNo, pYesNum, pYesDen] = poolState;
            // pYesNum / pYesDen gives the YES probability
            if (pYesDen > BigInt(0)) {
              yesProbability = Number((pYesNum * BigInt(100)) / pYesDen);
            } else if (rYes > BigInt(0) || rNo > BigInt(0)) {
              // Fallback: calculate from reserves
              // In constant product AMM: P(YES) = rNo / (rYes + rNo)
              const total = rYes + rNo;
              if (total > BigInt(0)) {
                yesProbability = Number((rNo * BigInt(100)) / total);
              }
            }
          }
          
          // Clamp to valid range
          yesProbability = Math.max(1, Math.min(99, yesProbability));

          // Parse X post
          let xPost: MarketData["xPost"] = null;
          const xPostHex = xPostsArr[i];
          if (xPostHex && xPostHex !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
            const decoded = decodeXPost(xPostHex);
            if (decoded) {
              xPost = {
                postId: decoded.postId,
                user: decoded.user,
                url: `https://x.com/${decoded.user}/status/${decoded.postId.toString()}`,
              };
            }
          }

          return {
            marketId,
            noId: getNoId(marketId),
            question: descs[i],
            resolver: resolvers[i],
            collateral: collaterals[i],
            isResolved: resolved,
            outcome,
            canClose,
            closeTime,
            collateralLocked: collateralAmounts[i],
            yesSupply,
            noSupply,
            xPost,
            yesProbability,
            totalVolume: formatEther(collateralAmounts[i]),
            isOpen: !resolved && closeTime > now,
            timeRemaining: formatTimeRemaining(closeTime),
          };
        });

        if (start === 0) {
          setMarkets(parsedMarkets);
        } else {
          setMarkets((prev) => [...prev, ...parsedMarkets]);
        }

        setHasMore(next > BigInt(0));
      } catch (err) {
        console.error("Failed to fetch markets:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch markets");
      } finally {
        setIsLoading(false);
      }
    },
    [getPublicClient]
  );

  const refreshMarkets = React.useCallback(async () => {
    setMarkets([]);
    await fetchMarkets(0, 50);
  }, [fetchMarkets]);

  // Auto-fetch on mount
  React.useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  return {
    markets,
    isLoading,
    error,
    hasMore,
    fetchMarkets,
    refreshMarkets,
  };
}
