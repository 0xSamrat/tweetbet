"use client";

import * as React from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  parseEther,
  type Address,
  type Hex,
  type TransactionReceipt,
} from "viem";
import { arcTestnet, baseSepolia } from "viem/chains";
import { MARKET_FACTORY_ADDRESS, marketFactoryAbi } from "@/contracts";

// ============================================
// TYPES
// ============================================

export interface CreateMarketParams {
  /** Market question/description */
  description: string;
  /** Resolver address (who can resolve the market). Defaults to creator */
  resolver?: Address;
  /** Collateral token address. Use address(0) or undefined for ETH */
  collateral?: Address;
  /** Close timestamp (when resolution is allowed) */
  closeTime: bigint;
  /** Whether resolver can early-close the market */
  canClose?: boolean;
  /** Encoded X post reference (optional) */
  xPost?: Hex;
  /** Initial liquidity amount in ETH (as string, e.g., "1.5") */
  liquidityAmount: string;
  /** Pool fee in basis points (default 30 = 0.3%) */
  feeBps?: bigint;
}

export interface CreateMarketResult {
  /** Transaction hash */
  txHash: Hex;
  /** Transaction receipt (after confirmation) */
  receipt: TransactionReceipt;
  /** Market ID (YES token ID) */
  marketId: bigint;
  /** NO token ID */
  noId: bigint;
  /** LP tokens minted */
  liquidity: bigint;
}

export interface UseMarketFactoryState {
  isLoading: boolean;
  error: string | null;
  lastTxHash: Hex | null;
}

export interface UseMarketFactoryActions {
  /** Create a new market with initial liquidity */
  createMarketAndSeed: (params: CreateMarketParams) => Promise<CreateMarketResult>;
  /** Clear any error */
  clearError: () => void;
}

export interface UseMarketFactoryReturn
  extends UseMarketFactoryState,
    UseMarketFactoryActions {}

// ============================================
// SUPPORTED CHAINS
// ============================================

const SUPPORTED_CHAINS = {
  [arcTestnet.id]: arcTestnet,
  [baseSepolia.id]: baseSepolia,
  31337: {
    id: 31337,
    name: "Anvil",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
      default: { http: ["http://127.0.0.1:8545"] },
    },
  },
} as const;

type SupportedChainId = keyof typeof SUPPORTED_CHAINS;

// ============================================
// HOOK
// ============================================

export function useMarketFactory(): UseMarketFactoryReturn {
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastTxHash, setLastTxHash] = React.useState<Hex | null>(null);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  /**
   * Create a new prediction market with initial liquidity
   */
  const createMarketAndSeed = React.useCallback(
    async (params: CreateMarketParams): Promise<CreateMarketResult> => {
      // Validate contract address
      if (!MARKET_FACTORY_ADDRESS) {
        throw new Error(
          "MARKET_FACTORY_ADDRESS not configured. Add NEXT_PUBLIC_MARKET_FACTORY_ADDRESS to .env"
        );
      }

      // Check for MetaMask
      if (typeof window === "undefined" || !window.ethereum) {
        throw new Error("MetaMask not found. Please install MetaMask.");
      }

      setIsLoading(true);
      setError(null);

      try {
        // Create wallet client
        const walletClient = createWalletClient({
          transport: custom(window.ethereum),
        });

        // Get accounts and chain
        const [account] = await walletClient.getAddresses();
        if (!account) {
          throw new Error("No account connected. Please connect MetaMask.");
        }

        // Get current chain
        const chainIdHex = await window.ethereum.request({
          method: "eth_chainId",
        });
        const chainId = parseInt(chainIdHex as string, 16) as SupportedChainId;

        // Get chain config
        const chain = SUPPORTED_CHAINS[chainId];
        if (!chain) {
          throw new Error(
            `Unsupported chain (${chainId}). Please switch to ARC Testnet, Base Sepolia, or Anvil.`
          );
        }

        // Parse parameters
        const {
          description,
          resolver = account, // Default to creator
          collateral = "0x0000000000000000000000000000000000000000" as Address, // ETH
          closeTime,
          canClose = true,
          xPost = "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex,
          liquidityAmount,
          feeBps = BigInt(30), // 0.3% fee
        } = params;

        // Parse ETH amount
        const ethValue = parseEther(liquidityAmount);

        // Calculate deadline (1 hour from now)
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

        console.log("Creating market with params:", {
          description,
          resolver,
          collateral,
          closeTime: closeTime.toString(),
          canClose,
          xPost,
          liquidityAmount,
          feeBps: feeBps.toString(),
          deadline: deadline.toString(),
        });

        // Send transaction
        const txHash = await walletClient.writeContract({
          address: MARKET_FACTORY_ADDRESS,
          abi: marketFactoryAbi,
          functionName: "createMarketAndSeed",
          args: [
            description,
            resolver,
            collateral,
            closeTime,
            canClose,
            xPost,
            BigInt(0), // collateralIn (0 = use msg.value for ETH)
            feeBps,
            BigInt(0), // minLiquidity
            account, // LP tokens recipient
            deadline,
          ],
          value: ethValue,
          account,
          chain,
        });

        console.log("Transaction sent:", txHash);
        setLastTxHash(txHash);

        // Wait for confirmation
        const publicClient = createPublicClient({
          chain,
          transport: http(),
        });

        const receipt = await publicClient.waitForTransactionReceipt({
          hash: txHash,
        });

        console.log("Transaction confirmed:", receipt);

        if (receipt.status === "reverted") {
          throw new Error("Transaction reverted");
        }

        // Parse logs to extract marketId, noId, and liquidity
        // The Created event is the first log
        const createdLog = receipt.logs[0];
        if (!createdLog) {
          throw new Error("Could not find Created event in transaction logs");
        }

        // Market ID is topic[1], NO ID is topic[2] (indexed params)
        const marketId = BigInt(createdLog.topics[1] || "0");
        const noId = BigInt(createdLog.topics[2] || "0");

        // Liquidity is from the LiquidityAdded event (we'll get a rough estimate from Split event)
        // For now, estimate as initial ETH value (proper parsing would decode all events)
        const liquidity = ethValue;

        return {
          txHash,
          receipt,
          marketId,
          noId,
          liquidity,
        };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown error occurred";
        console.error("createMarketAndSeed error:", err);
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return {
    isLoading,
    error,
    lastTxHash,
    createMarketAndSeed,
    clearError,
  };
}
