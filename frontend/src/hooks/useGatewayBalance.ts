"use client";

import * as React from "react";
import { createPublicClient, http, formatUnits, erc20Abi, type Address } from "viem";
import { arcTestnet, baseSepolia } from "viem/chains";
import { 
  GATEWAY_API_URL,
  USDC_ADDRESSES, 
  DOMAIN_IDS,
} from "@/config/gateway";

// Chain display info
const CHAIN_INFO: Record<string, { name: string; symbol: string; chain: typeof arcTestnet | typeof baseSepolia; usdc: Address }> = {
  arcTestnet: { 
    name: "ARC Testnet", 
    symbol: "🔵", 
    chain: arcTestnet,
    usdc: USDC_ADDRESSES.arcTestnet as Address,
  },
  baseSepolia: { 
    name: "Base Sepolia", 
    symbol: "🔷", 
    chain: baseSepolia,
    usdc: USDC_ADDRESSES.baseSepolia as Address,
  },
};

const SUPPORTED_CHAIN_KEYS = ["arcTestnet", "baseSepolia"] as const;

export interface ChainBalance {
  chain: string;           // Display name (e.g., "ARC Testnet")
  chainKey: "arcTestnet" | "baseSepolia";
  chainId: number;         // Chain ID (e.g., 1637450)
  domain: number;          // Gateway domain ID (e.g., 26)
  symbol: string;          // Emoji icon
  walletBalance: string;   // USDC in user's wallet (NOT deposited)
  gatewayBalance: string;  // USDC deposited in Gateway (unified balance)
}

interface GatewayBalanceResponse {
  balances: Array<{
    domain: number;
    balance: string;
  }>;
}

interface UseGatewayBalanceReturn {
  totalGatewayBalance: string;    // Total unified balance across all chains
  totalWalletBalance: string;     // Total USDC in wallet (not deposited)
  chainBalances: ChainBalance[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useGatewayBalance(
  address: Address | undefined
): UseGatewayBalanceReturn {
  const [totalGatewayBalance, setTotalGatewayBalance] = React.useState("0");
  const [totalWalletBalance, setTotalWalletBalance] = React.useState("0");
  const [chainBalances, setChainBalances] = React.useState<ChainBalance[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetchBalances = React.useCallback(async () => {
    if (!address) return;

    setIsLoading(true);
    setError(null);

    console.log("=".repeat(50));
    console.log("Fetching Gateway Balances via API");
    console.log("=".repeat(50));
    console.log(`Depositor Address: ${address}`);

    try {
      // Step 1: Fetch Gateway balances from Circle API
      const gatewayBalances = await fetchGatewayBalancesFromAPI(address);
      
      // Step 2: Fetch wallet balances (USDC not deposited in Gateway)
      const walletBalances = await fetchWalletBalances(address);

      // Step 3: Combine into chain balances
      const balances: ChainBalance[] = SUPPORTED_CHAIN_KEYS.map((chainKey) => {
        const info = CHAIN_INFO[chainKey];
        const domain = DOMAIN_IDS[chainKey];
        const gatewayBal = gatewayBalances[domain] || "0";
        const walletBal = walletBalances[chainKey] || "0";

        return {
          chain: info.name,
          chainKey,
          chainId: info.chain.id,
          domain,
          symbol: info.symbol,
          walletBalance: walletBal,
          gatewayBalance: gatewayBal,
        };
      });

      setChainBalances(balances);

      // Calculate totals
      const totalGateway = balances.reduce(
        (sum, b) => sum + parseFloat(b.gatewayBalance),
        0
      );
      const totalWallet = balances.reduce(
        (sum, b) => sum + parseFloat(b.walletBalance),
        0
      );

      console.log("\n" + "=".repeat(50));
      console.log(`Total Gateway Balance: ${totalGateway.toFixed(6)} USDC`);
      console.log(`Total Wallet Balance: ${totalWallet.toFixed(6)} USDC`);
      console.log("=".repeat(50));

      setTotalGatewayBalance(totalGateway.toFixed(2));
      setTotalWalletBalance(totalWallet.toFixed(2));
    } catch (err) {
      console.error("Failed to fetch gateway balances:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch balances");
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  React.useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  return {
    totalGatewayBalance,
    totalWalletBalance,
    chainBalances,
    isLoading,
    error,
    refetch: fetchBalances,
  };
}

// Helper: Fetch Gateway balances from Circle API
async function fetchGatewayBalancesFromAPI(
  depositor: Address
): Promise<Record<number, string>> {
  const sources = Object.values(DOMAIN_IDS).map((domain) => ({
    domain,
    depositor,
  }));

  console.log("Requesting Gateway balances for sources:", sources);

  const body = {
    token: "USDC",
    sources,
  };

  const res = await fetch(`${GATEWAY_API_URL}/balances`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Gateway API error: ${res.status} ${res.statusText}`);
  }

  const data: GatewayBalanceResponse = await res.json();
  console.log("Gateway API Response:", data);

  // Map domain -> balance string (formatted in USDC units)
  const balancesByDomain: Record<number, string> = {};
  for (const item of data.balances) {
    // Balance is already returned as a string in USDC units (e.g., "8.000000")
    const formatted = item.balance.toString();
    balancesByDomain[item.domain] = formatted;
    console.log(`  Domain ${item.domain}: ${formatted} USDC`);
  }

  return balancesByDomain;
}

// Helper: Fetch wallet USDC balances (NOT deposited in Gateway)
async function fetchWalletBalances(
  address: Address
): Promise<Record<string, string>> {
  const results: Record<string, string> = {};

  await Promise.all(
    SUPPORTED_CHAIN_KEYS.map(async (chainKey) => {
      const info = CHAIN_INFO[chainKey];
      const client = createPublicClient({
        chain: info.chain,
        transport: http(),
      });

      try {
        const balance = await client.readContract({
          address: info.usdc,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [address],
        });
        results[chainKey] = formatUnits(balance, 6);
        console.log(`Wallet balance on ${info.name}: ${results[chainKey]} USDC`);
      } catch (e) {
        console.warn(`Failed to fetch wallet balance on ${info.name}:`, e);
        results[chainKey] = "0";
      }
    })
  );

  return results;
}
