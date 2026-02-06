"use client";

import * as React from "react";
import {
  type Hex,
  createPublicClient,
  createWalletClient,
  custom,
  parseUnits,
  formatUnits,
  erc20Abi,
  http,
  type Address,
  type Chain,
} from "viem";
import { arcTestnet, baseSepolia } from "viem/chains";

// Supported chains for MetaMask
export const SUPPORTED_CHAINS = {
  arcTestnet: arcTestnet,
  baseSepolia: baseSepolia,
} as const;

export type SupportedChainId = typeof arcTestnet.id | typeof baseSepolia.id;

// Constants
const USDC_DECIMALS = 6;

// USDC addresses per chain
const USDC_ADDRESSES: Record<SupportedChainId, Address> = {
  [arcTestnet.id]: "0x3600000000000000000000000000000000000000" as Address,
  [baseSepolia.id]: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as Address, // Base Sepolia USDC
};

// Create public client for a chain
const getPublicClient = (chainId: SupportedChainId) => {
  const chain = chainId === arcTestnet.id ? arcTestnet : baseSepolia;
  return createPublicClient({
    chain,
    transport: http(),
  });
};

// Types
export interface EOAWalletState {
  address: Address | undefined;
  chainId: SupportedChainId | undefined;
  chain: Chain | undefined;
  isLoading: boolean;
  error: string | null;
  usdcBalance: string;
  isLoadingBalance: boolean;
}

export interface EOASendResult {
  txHash: Hex;
}

export interface EOAWalletActions {
  connectMetaMask: () => Promise<void>;
  disconnectMetaMask: () => void;
  switchChain: (chainId: SupportedChainId) => Promise<void>;
  fetchBalance: () => Promise<void>;
  sendUSDC: (to: Address, amount: string) => Promise<EOASendResult>;
  clearError: () => void;
}

export interface UseEOAWalletReturn extends EOAWalletState, EOAWalletActions {
  isConnected: boolean;
  isReady: boolean;
  walletType: "eoa";
  supportedChains: typeof SUPPORTED_CHAINS;
}

// EOA (MetaMask) Wallet Hook
export function useEOAWallet(): UseEOAWalletReturn {
  const [address, setAddress] = React.useState<Address | undefined>();
  const [chainId, setChainId] = React.useState<SupportedChainId | undefined>();
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = React.useState<string>("0");
  const [isLoadingBalance, setIsLoadingBalance] = React.useState(false);

  // Derived state
  const isConnected = !!address;
  const isReady = !!address && !!chainId;
  const chain = chainId ? (chainId === arcTestnet.id ? arcTestnet : baseSepolia) : undefined;

  // Check for existing connection on mount
  React.useEffect(() => {
    const storedAddress = localStorage.getItem("eoa_address");
    const storedChainId = localStorage.getItem("eoa_chain_id");
    const walletType = localStorage.getItem("wallet_type");

    if (storedAddress && walletType === "eoa") {
      // Verify the connection is still valid
      checkExistingConnection(storedAddress as Address, storedChainId ? parseInt(storedChainId) as SupportedChainId : arcTestnet.id);
    }
  }, []);

  const checkExistingConnection = async (storedAddress: Address, storedChainId: SupportedChainId) => {
    if (typeof window === "undefined" || !window.ethereum) return;

    try {
      const accounts = (await window.ethereum.request({
        method: "eth_accounts",
      })) as Address[];

      if (accounts.length > 0 && accounts[0].toLowerCase() === storedAddress.toLowerCase()) {
        setAddress(accounts[0]);
        
        // Get current chain
        const currentChainId = await window.ethereum.request({
          method: "eth_chainId",
        }) as string;
        const parsedChainId = parseInt(currentChainId, 16) as SupportedChainId;
        
        // Check if it's a supported chain
        if (parsedChainId === arcTestnet.id || parsedChainId === baseSepolia.id) {
          setChainId(parsedChainId);
          localStorage.setItem("eoa_chain_id", parsedChainId.toString());
        } else {
          setChainId(storedChainId);
        }
      } else {
        // Connection no longer valid
        localStorage.removeItem("eoa_address");
        localStorage.removeItem("eoa_chain_id");
        localStorage.removeItem("wallet_type");
      }
    } catch {
      console.error("Failed to check existing connection");
    }
  };

  // Listen for account and chain changes
  React.useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;

    const handleAccountsChanged = (accounts: unknown) => {
      const accountsArray = accounts as Address[];
      if (accountsArray.length === 0) {
        // User disconnected
        disconnectMetaMask();
      } else if (address && accountsArray[0].toLowerCase() !== address.toLowerCase()) {
        // Account changed
        setAddress(accountsArray[0]);
        localStorage.setItem("eoa_address", accountsArray[0]);
      }
    };

    const handleChainChanged = (newChainId: unknown) => {
      const parsedChainId = parseInt(newChainId as string, 16) as SupportedChainId;
      if (parsedChainId === arcTestnet.id || parsedChainId === baseSepolia.id) {
        setChainId(parsedChainId);
        localStorage.setItem("eoa_chain_id", parsedChainId.toString());
      }
    };

    window.ethereum.on?.("accountsChanged", handleAccountsChanged);
    window.ethereum.on?.("chainChanged", handleChainChanged);

    return () => {
      window.ethereum?.removeListener?.("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [address]);

  // Fetch balance
  const fetchBalance = React.useCallback(async () => {
    if (!address || !chainId) return;

    setIsLoadingBalance(true);
    try {
      const client = getPublicClient(chainId);
      const usdcAddress = USDC_ADDRESSES[chainId];
      
      const balance = await client.readContract({
        address: usdcAddress,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address],
      });
      setUsdcBalance(formatUnits(balance, USDC_DECIMALS));
    } catch (err) {
      console.error("Failed to fetch balance:", err);
    } finally {
      setIsLoadingBalance(false);
    }
  }, [address, chainId]);

  // Auto-fetch balance when connected or chain changes
  React.useEffect(() => {
    if (address && chainId) {
      fetchBalance();
    }
  }, [address, chainId, fetchBalance]);

  // Switch chain
  const switchChain = React.useCallback(async (targetChainId: SupportedChainId) => {
    if (typeof window === "undefined" || !window.ethereum) {
      setError("MetaMask is not available");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const targetChain = targetChainId === arcTestnet.id ? arcTestnet : baseSepolia;
      
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${targetChainId.toString(16)}` }],
        });
      } catch (switchError: unknown) {
        const error = switchError as { code?: number };
        if (error.code === 4902) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: `0x${targetChainId.toString(16)}`,
                chainName: targetChain.name,
                nativeCurrency: targetChain.nativeCurrency,
                rpcUrls: [targetChain.rpcUrls.default.http[0]],
                blockExplorerUrls: targetChain.blockExplorers ? [targetChain.blockExplorers.default.url] : [],
              },
            ],
          });
        } else {
          throw switchError;
        }
      }

      setChainId(targetChainId);
      localStorage.setItem("eoa_chain_id", targetChainId.toString());
    } catch (err) {
      console.error("Failed to switch chain:", err);
      setError(err instanceof Error ? err.message : "Failed to switch chain");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Connect MetaMask
  const connectMetaMask = React.useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      setError("MetaMask is not installed. Please install MetaMask to continue.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Request account access
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as Address[];

      if (accounts.length === 0) {
        throw new Error("No accounts found");
      }

      // Switch to ARC Testnet
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${arcTestnet.id.toString(16)}` }],
        });
      } catch (switchError: unknown) {
        // Chain not added, add it
        const error = switchError as { code?: number };
        if (error.code === 4902) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: `0x${arcTestnet.id.toString(16)}`,
                chainName: arcTestnet.name,
                nativeCurrency: arcTestnet.nativeCurrency,
                rpcUrls: [arcTestnet.rpcUrls.default.http[0]],
                blockExplorerUrls: [arcTestnet.blockExplorers?.default.url],
              },
            ],
          });
        } else {
          throw switchError;
        }
      }

      const connectedAddress = accounts[0];
      setAddress(connectedAddress);
      setChainId(arcTestnet.id);
      localStorage.setItem("eoa_address", connectedAddress);
      localStorage.setItem("eoa_chain_id", arcTestnet.id.toString());
      localStorage.setItem("wallet_type", "eoa");
    } catch (err) {
      console.error("MetaMask connection failed:", err);
      setError(err instanceof Error ? err.message : "Failed to connect MetaMask");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Disconnect MetaMask
  const disconnectMetaMask = React.useCallback(() => {
    localStorage.removeItem("eoa_address");
    localStorage.removeItem("eoa_chain_id");
    localStorage.removeItem("wallet_type");
    setAddress(undefined);
    setChainId(undefined);
    setUsdcBalance("0");
    setError(null);
  }, []);

  // Clear error
  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  // Send USDC (requires gas)
  const sendUSDC = React.useCallback(
    async (to: Address, amount: string): Promise<EOASendResult> => {
      if (!address || !chainId) {
        throw new Error("Wallet not connected");
      }

      if (typeof window === "undefined" || !window.ethereum) {
        throw new Error("MetaMask is not available");
      }

      setIsLoading(true);
      setError(null);

      try {
        const currentChain = chainId === arcTestnet.id ? arcTestnet : baseSepolia;
        const usdcAddress = USDC_ADDRESSES[chainId];
        const client = getPublicClient(chainId);
        
        const walletClient = createWalletClient({
          chain: currentChain,
          transport: custom(window.ethereum),
          account: address,
        });

        const txHash = await walletClient.writeContract({
          address: usdcAddress,
          abi: erc20Abi,
          functionName: "transfer",
          args: [to, parseUnits(amount, USDC_DECIMALS)],
        });

        // Wait for confirmation
        await client.waitForTransactionReceipt({ hash: txHash });

        await fetchBalance();

        return { txHash };
      } catch (err) {
        console.error("Transaction failed:", err);
        const errorMessage =
          err instanceof Error ? err.message : "Transaction failed";
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [address, chainId, fetchBalance]
  );

  return {
    // State
    address,
    chainId,
    chain,
    isLoading,
    error,
    usdcBalance,
    isLoadingBalance,
    // Derived
    isConnected,
    isReady,
    walletType: "eoa",
    supportedChains: SUPPORTED_CHAINS,
    // Actions
    connectMetaMask,
    disconnectMetaMask,
    switchChain,
    fetchBalance,
    sendUSDC,
    clearError,
  };
}

// Extend Window interface for ethereum
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on?: (event: string, callback: (data: unknown) => void) => void;
      removeListener?: (event: string, callback: (data: unknown) => void) => void;
    };
  }
}
