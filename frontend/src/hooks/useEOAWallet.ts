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
} from "viem";
import { arcTestnet } from "viem/chains";

// Constants
const USDC_DECIMALS = 6;
const USDC_ADDRESS = "0x3600000000000000000000000000000000000000" as Address; // ARC Testnet USDC

// Create public client for reading
const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(),
});

// Types
export interface EOAWalletState {
  address: Address | undefined;
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
  fetchBalance: () => Promise<void>;
  sendUSDC: (to: Address, amount: string) => Promise<EOASendResult>;
  clearError: () => void;
}

export interface UseEOAWalletReturn extends EOAWalletState, EOAWalletActions {
  isConnected: boolean;
  isReady: boolean;
  walletType: "eoa";
}

// EOA (MetaMask) Wallet Hook
export function useEOAWallet(): UseEOAWalletReturn {
  const [address, setAddress] = React.useState<Address | undefined>();
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = React.useState<string>("0");
  const [isLoadingBalance, setIsLoadingBalance] = React.useState(false);

  // Derived state
  const isConnected = !!address;
  const isReady = !!address;

  // Check for existing connection on mount
  React.useEffect(() => {
    const storedAddress = localStorage.getItem("eoa_address");
    const walletType = localStorage.getItem("wallet_type");

    if (storedAddress && walletType === "eoa") {
      // Verify the connection is still valid
      checkExistingConnection(storedAddress as Address);
    }
  }, []);

  const checkExistingConnection = async (storedAddress: Address) => {
    if (typeof window === "undefined" || !window.ethereum) return;

    try {
      const accounts = (await window.ethereum.request({
        method: "eth_accounts",
      })) as Address[];

      if (accounts.length > 0 && accounts[0].toLowerCase() === storedAddress.toLowerCase()) {
        setAddress(accounts[0]);
      } else {
        // Connection no longer valid
        localStorage.removeItem("eoa_address");
        localStorage.removeItem("wallet_type");
      }
    } catch {
      console.error("Failed to check existing connection");
    }
  };

  // Listen for account changes
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

    window.ethereum.on?.("accountsChanged", handleAccountsChanged);

    return () => {
      window.ethereum?.removeListener?.("accountsChanged", handleAccountsChanged);
    };
  }, [address]);

  // Fetch balance
  const fetchBalance = React.useCallback(async () => {
    if (!address) return;

    setIsLoadingBalance(true);
    try {
      const balance = await publicClient.readContract({
        address: USDC_ADDRESS,
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
  }, [address]);

  // Auto-fetch balance when connected
  React.useEffect(() => {
    if (address) {
      fetchBalance();
    }
  }, [address, fetchBalance]);

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
      localStorage.setItem("eoa_address", connectedAddress);
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
    localStorage.removeItem("wallet_type");
    setAddress(undefined);
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
      if (!address) {
        throw new Error("Wallet not connected");
      }

      if (typeof window === "undefined" || !window.ethereum) {
        throw new Error("MetaMask is not available");
      }

      setIsLoading(true);
      setError(null);

      try {
        const walletClient = createWalletClient({
          chain: arcTestnet,
          transport: custom(window.ethereum),
          account: address,
        });

        const txHash = await walletClient.writeContract({
          address: USDC_ADDRESS,
          abi: erc20Abi,
          functionName: "transfer",
          args: [to, parseUnits(amount, USDC_DECIMALS)],
        });

        // Wait for confirmation
        await publicClient.waitForTransactionReceipt({ hash: txHash });

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
    [address, fetchBalance]
  );

  return {
    // State
    address,
    isLoading,
    error,
    usdcBalance,
    isLoadingBalance,
    // Derived
    isConnected,
    isReady,
    walletType: "eoa",
    // Actions
    connectMetaMask,
    disconnectMetaMask,
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
