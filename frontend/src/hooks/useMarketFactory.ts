"use client";

import * as React from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  parseEther,
  encodeFunctionData,
  parseGwei,
  decodeEventLog,
  keccak256,
  toHex,
  type Address,
  type Hex,
  type TransactionReceipt,
} from "viem";
import { arcTestnet, baseSepolia } from "viem/chains";
import { MARKET_FACTORY_ADDRESS, marketFactoryAbi } from "@/contracts";
import { useWallet } from "@/contexts/WalletContext";
import { bundlerClient } from "./usePasskeyWallet";

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
  /** Transaction hash for convenience */
  transactionHash: Hex;
}

export interface BuyParams {
  /** Market ID */
  marketId: bigint;
  /** Amount of ETH to spend (as string, e.g., "0.01") */
  amount: string;
  /** Pool fee in basis points (default 30 = 0.3%) */
  feeBps?: bigint;
  /** Minimum output shares (slippage protection, default 0) */
  minOut?: bigint;
}

export interface BuyResult {
  /** Transaction hash */
  txHash: Hex;
  /** Transaction receipt */
  receipt: TransactionReceipt;
  /** Amount of shares received */
  sharesOut: bigint;
}

export interface AddLiquidityParams {
  /** Market ID */
  marketId: bigint;
  /** Amount of collateral (ETH) to add (as string, e.g., "0.1") */
  amount: string;
  /** Pool fee in basis points (default 30 = 0.3%) */
  feeBps?: bigint;
  /** Minimum liquidity tokens to receive (slippage protection, default 0) */
  minLiquidity?: bigint;
}

export interface AddLiquidityResult {
  /** Transaction hash */
  txHash: Hex;
  /** Transaction receipt */
  receipt: TransactionReceipt;
  /** Amount of LP tokens received */
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
  /** Buy YES shares with ETH */
  buyYes: (params: BuyParams) => Promise<BuyResult>;
  /** Buy NO shares with ETH */
  buyNo: (params: BuyParams) => Promise<BuyResult>;
  /** Add liquidity to an existing market */
  addLiquidity: (params: AddLiquidityParams) => Promise<AddLiquidityResult>;
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

  // Get unified wallet context
  const wallet = useWallet();

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

      // Check wallet connection
      if (!wallet.isConnected || !wallet.address) {
        throw new Error("No wallet connected. Please connect a wallet first.");
      }

      setIsLoading(true);
      setError(null);

      try {
        const account = wallet.address;
        
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
          walletType: wallet.walletType,
        });

        let txHash: Hex;
        let receipt: TransactionReceipt;

        if (wallet.walletType === "passkey") {
          // Use passkey wallet (account abstraction)
          const passkeyAccount = wallet.passkeyWallet.account;
          if (!passkeyAccount) {
            throw new Error("Passkey account not ready");
          }

          // Encode the function call
          const callData = encodeFunctionData({
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
          });

          // Send via bundler
          const userOpHash = await bundlerClient.sendUserOperation({
            account: passkeyAccount,
            calls: [
              {
                to: MARKET_FACTORY_ADDRESS,
                data: callData,
                value: ethValue,
              },
            ],
            paymaster: true,
            maxPriorityFeePerGas: parseGwei("1"),
            maxFeePerGas: parseGwei("50"),
          });

          console.log("UserOp sent:", userOpHash);

          const { receipt: userOpReceipt } = await bundlerClient.waitForUserOperationReceipt({
            hash: userOpHash,
          });

          txHash = userOpReceipt.transactionHash;
          receipt = userOpReceipt;
        } else {
          // Use EOA wallet (MetaMask)
          if (typeof window === "undefined" || !window.ethereum) {
            throw new Error("MetaMask not found. Please install MetaMask.");
          }

          const walletClient = createWalletClient({
            transport: custom(window.ethereum),
          });

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

          // Send transaction
          txHash = await walletClient.writeContract({
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

          // Wait for confirmation
          const publicClient = createPublicClient({
            chain,
            transport: http(),
          });

          receipt = await publicClient.waitForTransactionReceipt({
            hash: txHash,
          });
        }

        setLastTxHash(txHash);
        console.log("Transaction confirmed:", receipt);

        if (receipt.status === "reverted") {
          throw new Error("Transaction reverted");
        }

        // Parse logs to extract marketId, noId from the Created event
        // Created event signature: Created(uint256 indexed marketId, uint256 indexed noId, string description, address resolver, address collateral, uint64 close, bool canClose, bytes32 xPost)
        const createdEventSignature = keccak256(toHex("Created(uint256,uint256,string,address,address,uint64,bool,bytes32)"));
        
        console.log("Looking for Created event with signature:", createdEventSignature);
        console.log("Transaction logs:", receipt.logs.length, "logs found");
        
        // Find the Created event log
        const createdLog = receipt.logs.find(
          (log) => log.topics[0] === createdEventSignature
        );
        
        if (!createdLog) {
          // Log all event signatures for debugging
          console.log("Available event signatures:", receipt.logs.map(l => l.topics[0]));
          throw new Error("Could not find Created event in transaction logs");
        }

        // Decode the Created event
        let marketId: bigint;
        let noId: bigint;
        
        try {
          const decoded = decodeEventLog({
            abi: marketFactoryAbi,
            data: createdLog.data,
            topics: createdLog.topics,
          });
          
          console.log("Decoded Created event:", decoded);
          
          // Extract marketId and noId from decoded args
          const args = decoded.args as unknown as { marketId: bigint; noId: bigint };
          marketId = args.marketId;
          noId = args.noId;
        } catch (decodeError) {
          console.error("Failed to decode event, falling back to raw topic parsing:", decodeError);
          // Fallback: parse directly from topics
          marketId = BigInt(createdLog.topics[1] || "0");
          noId = BigInt(createdLog.topics[2] || "0");
        }
        
        console.log("Parsed marketId:", marketId.toString());
        console.log("Parsed noId:", noId.toString());

        // Liquidity is from the LiquidityAdded event (we'll get a rough estimate from Split event)
        // For now, estimate as initial ETH value (proper parsing would decode all events)
        const liquidity = ethValue;

        return {
          txHash,
          receipt,
          marketId,
          noId,
          liquidity,
          transactionHash: txHash,
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
    [wallet]
  );

  /**
   * Buy YES shares with ETH
   */
  const buyYes = React.useCallback(
    async (params: BuyParams): Promise<BuyResult> => {
      if (!MARKET_FACTORY_ADDRESS) {
        throw new Error("MARKET_FACTORY_ADDRESS not configured");
      }

      if (!wallet.isConnected || !wallet.address) {
        throw new Error("No wallet connected. Please connect a wallet first.");
      }

      setIsLoading(true);
      setError(null);

      try {
        const account = wallet.address;
        const {
          marketId,
          amount,
          feeBps = BigInt(30),
          minOut = BigInt(0),
        } = params;

        const ethValue = parseEther(amount);
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

        console.log("Buying YES shares:", {
          marketId: marketId.toString(),
          amount,
          feeBps: feeBps.toString(),
          walletType: wallet.walletType,
        });

        let txHash: Hex;
        let receipt: TransactionReceipt;

        if (wallet.walletType === "passkey") {
          // Use passkey wallet (account abstraction)
          const passkeyAccount = wallet.passkeyWallet.account;
          if (!passkeyAccount) {
            throw new Error("Passkey account not ready");
          }

          // Encode the function call
          const callData = encodeFunctionData({
            abi: marketFactoryAbi,
            functionName: "buyYes",
            args: [
              marketId,
              BigInt(0), // collateralIn (0 = use msg.value for ETH)
              minOut, // minYesOut
              BigInt(0), // minSwapOut
              feeBps, // feeOrHook
              account, // to
              deadline,
            ],
          });

          // Send via bundler
          const userOpHash = await bundlerClient.sendUserOperation({
            account: passkeyAccount,
            calls: [
              {
                to: MARKET_FACTORY_ADDRESS,
                data: callData,
                value: ethValue,
              },
            ],
            paymaster: true,
            maxPriorityFeePerGas: parseGwei("1"),
            maxFeePerGas: parseGwei("50"),
          });

          console.log("buyYes UserOp sent:", userOpHash);

          const { receipt: userOpReceipt } = await bundlerClient.waitForUserOperationReceipt({
            hash: userOpHash,
          });

          txHash = userOpReceipt.transactionHash;
          receipt = userOpReceipt;
        } else {
          // Use EOA wallet (MetaMask)
          if (typeof window === "undefined" || !window.ethereum) {
            throw new Error("MetaMask not found. Please install MetaMask.");
          }

          const walletClient = createWalletClient({
            transport: custom(window.ethereum),
          });

          const chainIdHex = await window.ethereum.request({
            method: "eth_chainId",
          });
          const chainId = parseInt(chainIdHex as string, 16) as SupportedChainId;

          const chain = SUPPORTED_CHAINS[chainId];
          if (!chain) {
            throw new Error(`Unsupported chain (${chainId}).`);
          }

          txHash = await walletClient.writeContract({
            address: MARKET_FACTORY_ADDRESS,
            abi: marketFactoryAbi,
            functionName: "buyYes",
            args: [
              marketId,
              BigInt(0), // collateralIn (0 = use msg.value for ETH)
              minOut, // minYesOut
              BigInt(0), // minSwapOut
              feeBps, // feeOrHook
              account, // to
              deadline,
            ],
            value: ethValue,
            account,
            chain,
          });

          console.log("buyYes tx sent:", txHash);

          const publicClient = createPublicClient({
            chain,
            transport: http(),
          });

          receipt = await publicClient.waitForTransactionReceipt({
            hash: txHash,
          });
        }

        setLastTxHash(txHash);

        if (receipt.status === "reverted") {
          throw new Error("Transaction reverted");
        }

        // Parse Transfer event to get shares received
        const transferLogs = receipt.logs.filter(
          (log) => log.topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
        );
        const sharesOut = transferLogs.length > 0 
          ? BigInt(transferLogs[transferLogs.length - 1].data || "0")
          : ethValue;

        return { txHash, receipt, sharesOut };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("buyYes error:", err);
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [wallet]
  );

  /**
   * Buy NO shares with ETH
   */
  const buyNo = React.useCallback(
    async (params: BuyParams): Promise<BuyResult> => {
      if (!MARKET_FACTORY_ADDRESS) {
        throw new Error("MARKET_FACTORY_ADDRESS not configured");
      }

      if (!wallet.isConnected || !wallet.address) {
        throw new Error("No wallet connected. Please connect a wallet first.");
      }

      setIsLoading(true);
      setError(null);

      try {
        const account = wallet.address;
        const {
          marketId,
          amount,
          feeBps = BigInt(30),
          minOut = BigInt(0),
        } = params;

        const ethValue = parseEther(amount);
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

        console.log("Buying NO shares:", {
          marketId: marketId.toString(),
          amount,
          feeBps: feeBps.toString(),
          walletType: wallet.walletType,
        });

        let txHash: Hex;
        let receipt: TransactionReceipt;

        if (wallet.walletType === "passkey") {
          // Use passkey wallet (account abstraction)
          const passkeyAccount = wallet.passkeyWallet.account;
          if (!passkeyAccount) {
            throw new Error("Passkey account not ready");
          }

          // Encode the function call
          const callData = encodeFunctionData({
            abi: marketFactoryAbi,
            functionName: "buyNo",
            args: [
              marketId,
              BigInt(0), // collateralIn (0 = use msg.value for ETH)
              minOut, // minNoOut
              BigInt(0), // minSwapOut
              feeBps, // feeOrHook
              account, // to
              deadline,
            ],
          });

          // Send via bundler
          const userOpHash = await bundlerClient.sendUserOperation({
            account: passkeyAccount,
            calls: [
              {
                to: MARKET_FACTORY_ADDRESS,
                data: callData,
                value: ethValue,
              },
            ],
            paymaster: true,
            maxPriorityFeePerGas: parseGwei("1"),
            maxFeePerGas: parseGwei("50"),
          });

          console.log("buyNo UserOp sent:", userOpHash);

          const { receipt: userOpReceipt } = await bundlerClient.waitForUserOperationReceipt({
            hash: userOpHash,
          });

          txHash = userOpReceipt.transactionHash;
          receipt = userOpReceipt;
        } else {
          // Use EOA wallet (MetaMask)
          if (typeof window === "undefined" || !window.ethereum) {
            throw new Error("MetaMask not found. Please install MetaMask.");
          }

          const walletClient = createWalletClient({
            transport: custom(window.ethereum),
          });

          const chainIdHex = await window.ethereum.request({
            method: "eth_chainId",
          });
          const chainId = parseInt(chainIdHex as string, 16) as SupportedChainId;

          const chain = SUPPORTED_CHAINS[chainId];
          if (!chain) {
            throw new Error(`Unsupported chain (${chainId}).`);
          }

          txHash = await walletClient.writeContract({
            address: MARKET_FACTORY_ADDRESS,
            abi: marketFactoryAbi,
            functionName: "buyNo",
            args: [
              marketId,
              BigInt(0), // collateralIn (0 = use msg.value for ETH)
              minOut, // minNoOut
              BigInt(0), // minSwapOut
              feeBps, // feeOrHook
              account, // to
              deadline,
            ],
            value: ethValue,
            account,
            chain,
          });

          console.log("buyNo tx sent:", txHash);

          const publicClient = createPublicClient({
            chain,
            transport: http(),
          });

          receipt = await publicClient.waitForTransactionReceipt({
            hash: txHash,
          });
        }

        setLastTxHash(txHash);

        if (receipt.status === "reverted") {
          throw new Error("Transaction reverted");
        }

        // Parse Transfer event to get shares received
        const transferLogs = receipt.logs.filter(
          (log) => log.topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
        );
        const sharesOut = transferLogs.length > 0 
          ? BigInt(transferLogs[transferLogs.length - 1].data || "0")
          : ethValue;

        return { txHash, receipt, sharesOut };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("buyNo error:", err);
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [wallet]
  );

  /**
   * Add liquidity to an existing market (split collateral + add LP)
   */
  const addLiquidity = React.useCallback(
    async (params: AddLiquidityParams): Promise<AddLiquidityResult> => {
      if (!MARKET_FACTORY_ADDRESS) {
        throw new Error("MARKET_FACTORY_ADDRESS not configured");
      }

      if (!wallet.isConnected || !wallet.address) {
        throw new Error("No wallet connected. Please connect a wallet first.");
      }

      setIsLoading(true);
      setError(null);

      try {
        const account = wallet.address;
        const {
          marketId,
          amount,
          feeBps = BigInt(30),
          minLiquidity = BigInt(0),
        } = params;

        const ethValue = parseEther(amount);
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

        console.log("Adding liquidity:", {
          marketId: marketId.toString(),
          amount,
          feeBps: feeBps.toString(),
          walletType: wallet.walletType,
        });

        let txHash: Hex;
        let receipt: TransactionReceipt;

        if (wallet.walletType === "passkey") {
          // Use passkey wallet (account abstraction)
          const passkeyAccount = wallet.passkeyWallet.account;
          if (!passkeyAccount) {
            throw new Error("Passkey account not ready");
          }

          // Encode the function call
          const callData = encodeFunctionData({
            abi: marketFactoryAbi,
            functionName: "splitAndAddLiquidity",
            args: [
              marketId,
              BigInt(0), // collateralIn (0 = use msg.value for ETH)
              feeBps, // feeOrHook
              BigInt(0), // amount0Min
              BigInt(0), // amount1Min
              minLiquidity, // minLiquidity
              account, // to
              deadline,
            ],
          });

          // Send via bundler
          const userOpHash = await bundlerClient.sendUserOperation({
            account: passkeyAccount,
            calls: [
              {
                to: MARKET_FACTORY_ADDRESS,
                data: callData,
                value: ethValue,
              },
            ],
            paymaster: true,
            maxPriorityFeePerGas: parseGwei("1"),
            maxFeePerGas: parseGwei("50"),
          });

          console.log("Add liquidity userOp sent:", userOpHash);

          // Wait for user operation receipt
          const userOpReceipt =
            await bundlerClient.waitForUserOperationReceipt({
              hash: userOpHash,
            });

          txHash = userOpReceipt.receipt.transactionHash;
          receipt = userOpReceipt.receipt as TransactionReceipt;
        } else {
          // Use MetaMask wallet
          if (typeof window === "undefined" || !window.ethereum) {
            throw new Error("MetaMask not found. Please install MetaMask.");
          }

          const walletClient = createWalletClient({
            transport: custom(window.ethereum),
          });

          const chainIdHex = await window.ethereum.request({
            method: "eth_chainId",
          });
          const chainId = parseInt(chainIdHex as string, 16) as SupportedChainId;

          const chain = SUPPORTED_CHAINS[chainId];
          if (!chain) {
            throw new Error(`Unsupported chain (${chainId}).`);
          }

          txHash = await walletClient.writeContract({
            address: MARKET_FACTORY_ADDRESS,
            abi: marketFactoryAbi,
            functionName: "splitAndAddLiquidity",
            args: [
              marketId,
              BigInt(0), // collateralIn (0 = use msg.value for ETH)
              feeBps, // feeOrHook
              BigInt(0), // amount0Min
              BigInt(0), // amount1Min
              minLiquidity, // minLiquidity
              account, // to
              deadline,
            ],
            value: ethValue,
            account,
            chain,
          });

          console.log("Add liquidity tx sent:", txHash);

          const publicClient = createPublicClient({
            chain,
            transport: http(),
          });

          receipt = await publicClient.waitForTransactionReceipt({
            hash: txHash,
          });
        }

        setLastTxHash(txHash);

        if (receipt.status === "reverted") {
          throw new Error("Transaction reverted");
        }

        // Estimate liquidity from the transaction (proper parsing would decode LiquidityAdded event)
        const liquidity = ethValue;

        return { txHash, receipt, liquidity };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("addLiquidity error:", err);
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [wallet]
  );

  return {
    isLoading,
    error,
    lastTxHash,
    createMarketAndSeed,
    buyYes,
    buyNo,
    addLiquidity,
    clearError,
  };
}
