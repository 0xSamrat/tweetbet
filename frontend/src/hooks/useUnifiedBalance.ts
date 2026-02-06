"use client";

import * as React from "react";
import {
  createPublicClient,
  formatUnits,
  erc20Abi,
  http,
  type Address,
} from "viem";
import { arcTestnet, baseSepolia } from "viem/chains";

// Constants
const USDC_DECIMALS = 6;

// USDC addresses per chain
const USDC_ADDRESSES = {
  [arcTestnet.id]: "0x3600000000000000000000000000000000000000" as Address,
  [baseSepolia.id]: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as Address,
};

// Chain info
const CHAINS = [
  { 
    id: arcTestnet.id, 
    name: "ARC Testnet", 
    icon: "🔵", 
    chain: arcTestnet,
    usdcAddress: USDC_ADDRESSES[arcTestnet.id],
  },
  { 
    id: baseSepolia.id, 
    name: "Base Sepolia", 
    icon: "🔷", 
    chain: baseSepolia,
    usdcAddress: USDC_ADDRESSES[baseSepolia.id],
  },
];

// Create public clients for each chain
const publicClients = {
  [arcTestnet.id]: createPublicClient({
    chain: arcTestnet,
    transport: http(),
  }),
  [baseSepolia.id]: createPublicClient({
    chain: baseSepolia,
    transport: http(),
  }),
};

export interface ChainBalance {
  chainId: number;
  chainName: string;
  chainIcon: string;
  balance: string;
  balanceRaw: bigint;
}

export interface UnifiedBalanceState {
  totalBalance: string;
  totalBalanceRaw: bigint;
  chainBalances: ChainBalance[];
  isLoading: boolean;
  error: string | null;
}

export interface UnifiedBalanceActions {
  fetchUnifiedBalance: () => Promise<void>;
}

export interface UseUnifiedBalanceReturn extends UnifiedBalanceState, UnifiedBalanceActions {}

export function useUnifiedBalance(address: Address | undefined): UseUnifiedBalanceReturn {
  const [totalBalance, setTotalBalance] = React.useState<string>("0");
  const [totalBalanceRaw, setTotalBalanceRaw] = React.useState<bigint>(BigInt(0));
  const [chainBalances, setChainBalances] = React.useState<ChainBalance[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetchUnifiedBalance = React.useCallback(async () => {
    if (!address) {
      setChainBalances([]);
      setTotalBalance("0");
      setTotalBalanceRaw(BigInt(0));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch balances from all chains in parallel
      const balancePromises = CHAINS.map(async (chainInfo) => {
        try {
          const client = publicClients[chainInfo.id as keyof typeof publicClients];
          const balance = await client.readContract({
            address: chainInfo.usdcAddress,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [address],
          });

          return {
            chainId: chainInfo.id,
            chainName: chainInfo.name,
            chainIcon: chainInfo.icon,
            balance: formatUnits(balance, USDC_DECIMALS),
            balanceRaw: balance,
          };
        } catch (err) {
          console.error(`Failed to fetch balance from ${chainInfo.name}:`, err);
          // Return zero balance if fetch fails
          return {
            chainId: chainInfo.id,
            chainName: chainInfo.name,
            chainIcon: chainInfo.icon,
            balance: "0",
            balanceRaw: BigInt(0),
          };
        }
      });

      const balances = await Promise.all(balancePromises);
      
      // Calculate total
      const total = balances.reduce((sum, b) => sum + b.balanceRaw, BigInt(0));
      
      setChainBalances(balances);
      setTotalBalanceRaw(total);
      setTotalBalance(formatUnits(total, USDC_DECIMALS));
    } catch (err) {
      console.error("Failed to fetch unified balance:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch balance");
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  // Auto-fetch when address changes
  React.useEffect(() => {
    if (address) {
      fetchUnifiedBalance();
    }
  }, [address, fetchUnifiedBalance]);

  return {
    totalBalance,
    totalBalanceRaw,
    chainBalances,
    isLoading,
    error,
    fetchUnifiedBalance,
  };
}
