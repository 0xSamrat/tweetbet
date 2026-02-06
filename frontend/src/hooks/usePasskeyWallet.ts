"use client";

import * as React from "react";
import {
  type Hex,
  createPublicClient,
  parseUnits,
  formatUnits,
  erc20Abi,
  parseGwei,
  type Address,
} from "viem";
import { arcTestnet } from "viem/chains";
import {
  type P256Credential,
  type SmartAccount,
  type WebAuthnAccount,
  createBundlerClient,
  toWebAuthnAccount,
} from "viem/account-abstraction";
import {
  WebAuthnMode,
  toCircleSmartAccount,
  toModularTransport,
  toPasskeyTransport,
  toWebAuthnCredential,
  encodeTransfer,
  ContractAddress,
} from "@circle-fin/modular-wallets-core";

// Constants
const clientKey = process.env.NEXT_PUBLIC_CIRCLE_CLIENT_KEY!;
const clientUrl = process.env.NEXT_PUBLIC_CIRCLE_CLIENT_URL!;
const USDC_DECIMALS = 6;

// Create Circle transports (singleton - outside component)
const passkeyTransport = toPasskeyTransport(clientUrl, clientKey);
const modularTransport = toModularTransport(
  `${clientUrl}/arcTestnet`,
  clientKey
);

// Create clients (singleton)
export const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: modularTransport,
});

export const bundlerClient = createBundlerClient({
  chain: arcTestnet,
  transport: modularTransport,
});

// Types
export interface PasskeyWalletState {
  account: SmartAccount | undefined;
  credential: P256Credential | null;
  username: string | undefined;
  isLoading: boolean;
  error: string | null;
  usdcBalance: string;
  isLoadingBalance: boolean;
}

export interface SendResult {
  userOpHash: Hex;
  txHash: Hex;
}

export interface PasskeyWalletActions {
  registerPasskey: (username: string) => Promise<void>;
  loginPasskey: () => Promise<void>;
  logoutPasskey: () => void;
  fetchBalance: () => Promise<void>;
  sendUSDC: (to: Address, amount: string) => Promise<SendResult>;
  clearError: () => void;
}

export interface UsePasskeyWalletReturn
  extends PasskeyWalletState,
    PasskeyWalletActions {
  isConnected: boolean;
  isReady: boolean;
  walletType: "passkey";
}

// Passkey Wallet Hook
export function usePasskeyWallet(): UsePasskeyWalletReturn {
  const [account, setAccount] = React.useState<SmartAccount>();
  const [credential, setCredential] = React.useState<P256Credential | null>(
    null
  );
  const [username, setUsername] = React.useState<string | undefined>();
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = React.useState<string>("0");
  const [isLoadingBalance, setIsLoadingBalance] = React.useState(false);

  // Derived state
  const isConnected = !!credential;
  const isReady = !!account;

  // Load credential from localStorage on mount
  React.useEffect(() => {
    const storedCredential = localStorage.getItem("passkey_credential");
    const storedUsername = localStorage.getItem("passkey_username");
    if (storedCredential) {
      setCredential(JSON.parse(storedCredential));
    }
    if (storedUsername) {
      setUsername(storedUsername);
    }
  }, []);

  // Create smart account when credential is available
  React.useEffect(() => {
    if (!credential) return;

    toCircleSmartAccount({
      client: publicClient,
      owner: toWebAuthnAccount({ credential }) as WebAuthnAccount,
      name: username,
    }).then(setAccount);
  }, [credential, username]);

  // Fetch balance
  const fetchBalance = React.useCallback(async () => {
    if (!account?.address) return;

    setIsLoadingBalance(true);
    try {
      const balance = await publicClient.readContract({
        address: ContractAddress.ArcTestnet_USDC,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [account.address],
      });
      setUsdcBalance(formatUnits(balance, USDC_DECIMALS));
    } catch (err) {
      console.error("Failed to fetch balance:", err);
    } finally {
      setIsLoadingBalance(false);
    }
  }, [account?.address]);

  // Auto-fetch balance when account is ready
  React.useEffect(() => {
    if (account?.address) {
      fetchBalance();
    }
  }, [account?.address, fetchBalance]);

  // Register new passkey wallet
  const registerPasskey = React.useCallback(async (usernameInput: string) => {
    if (!usernameInput.trim()) {
      setError("Please enter a username");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const newCredential = await toWebAuthnCredential({
        transport: passkeyTransport,
        mode: WebAuthnMode.Register,
        username: usernameInput,
      });
      localStorage.setItem("passkey_credential", JSON.stringify(newCredential));
      localStorage.setItem("passkey_username", usernameInput);
      localStorage.setItem("wallet_type", "passkey");
      setCredential(newCredential);
      setUsername(usernameInput);
    } catch (err) {
      console.error("Registration failed:", err);
      setError(err instanceof Error ? err.message : "Registration failed");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Login with existing passkey
  const loginPasskey = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const existingCredential = await toWebAuthnCredential({
        transport: passkeyTransport,
        mode: WebAuthnMode.Login,
      });
      localStorage.setItem(
        "passkey_credential",
        JSON.stringify(existingCredential)
      );
      localStorage.setItem("wallet_type", "passkey");
      setCredential(existingCredential);
    } catch (err) {
      console.error("Login failed:", err);
      setError(err instanceof Error ? err.message : "Login failed");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Logout
  const logoutPasskey = React.useCallback(() => {
    localStorage.removeItem("passkey_credential");
    localStorage.removeItem("passkey_username");
    localStorage.removeItem("wallet_type");
    setCredential(null);
    setAccount(undefined);
    setUsername(undefined);
    setUsdcBalance("0");
    setError(null);
  }, []);

  // Clear error
  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  // Send USDC (gasless via bundler)
  const sendUSDC = React.useCallback(
    async (to: Address, amount: string): Promise<SendResult> => {
      if (!account) {
        throw new Error("Wallet not connected");
      }

      setIsLoading(true);
      setError(null);

      try {
        const callData = encodeTransfer(
          to,
          ContractAddress.ArcTestnet_USDC,
          parseUnits(amount, USDC_DECIMALS)
        );

        const userOpHash = await bundlerClient.sendUserOperation({
          account,
          calls: [callData],
          paymaster: true,
          maxPriorityFeePerGas: parseGwei("1"),
          maxFeePerGas: parseGwei("50"),
        });

        const { receipt } = await bundlerClient.waitForUserOperationReceipt({
          hash: userOpHash,
        });

        await fetchBalance();

        return {
          userOpHash,
          txHash: receipt.transactionHash,
        };
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
    [account, fetchBalance]
  );

  return {
    // State
    account,
    credential,
    username,
    isLoading,
    error,
    usdcBalance,
    isLoadingBalance,
    // Derived
    isConnected,
    isReady,
    walletType: "passkey",
    // Actions
    registerPasskey,
    loginPasskey,
    logoutPasskey,
    fetchBalance,
    sendUSDC,
    clearError,
  };
}
