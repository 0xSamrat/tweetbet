"use client";

import * as React from "react";
import { type Hex, type Address, type Chain } from "viem";
import { arcTestnet } from "viem/chains";
import {
  usePasskeyWallet,
  type UsePasskeyWalletReturn,
} from "./usePasskeyWallet";
import { useEOAWallet, type UseEOAWalletReturn, type SupportedChainId, SUPPORTED_CHAINS } from "./useEOAWallet";

// Re-export individual hooks for direct usage
export { usePasskeyWallet } from "./usePasskeyWallet";
export { useEOAWallet, SUPPORTED_CHAINS } from "./useEOAWallet";
export type { SupportedChainId } from "./useEOAWallet";

// Wallet type
export type WalletType = "passkey" | "eoa" | null;

// Unified wallet state
export interface UnifiedWalletState {
  // Connection state
  isConnected: boolean;
  isReady: boolean;
  walletType: WalletType;

  // Address (works for both wallet types)
  address: Address | undefined;

  // Chain info
  chainId: number | undefined;
  chainName: string | undefined;
  chain: Chain | undefined;

  // Loading & error
  isLoading: boolean;
  error: string | null;

  // Balance
  usdcBalance: string;
  isLoadingBalance: boolean;

  // Passkey-specific
  username: string | undefined;
}

export interface UnifiedWalletActions {
  // Passkey actions
  registerPasskey: (username: string) => Promise<void>;
  loginPasskey: () => Promise<void>;

  // EOA actions
  connectMetaMask: () => Promise<void>;
  switchChain: (chainId: SupportedChainId) => Promise<void>;

  // Common actions
  logout: () => void;
  fetchBalance: () => Promise<void>;
  sendUSDC: (
    to: Address,
    amount: string
  ) => Promise<{ userOpHash?: Hex; txHash: Hex }>;
  clearError: () => void;
}

export interface UseWalletReturn
  extends UnifiedWalletState,
    UnifiedWalletActions {
  // Access to underlying wallet hooks if needed
  passkeyWallet: UsePasskeyWalletReturn;
  eoaWallet: UseEOAWalletReturn;
  // Supported chains for EOA
  supportedChains: typeof SUPPORTED_CHAINS;
}

// Unified Wallet Hook - combines passkey and EOA wallets
export function useWalletCore(): UseWalletReturn {
  const passkeyWallet = usePasskeyWallet();
  const eoaWallet = useEOAWallet();

  // Determine which wallet is active
  const walletType: WalletType = React.useMemo(() => {
    if (passkeyWallet.isConnected) return "passkey";
    if (eoaWallet.isConnected) return "eoa";
    return null;
  }, [passkeyWallet.isConnected, eoaWallet.isConnected]);

  // Unified state
  const isConnected = passkeyWallet.isConnected || eoaWallet.isConnected;
  const isReady = passkeyWallet.isReady || eoaWallet.isReady;

  const address = React.useMemo(() => {
    if (walletType === "passkey") return passkeyWallet.account?.address;
    if (walletType === "eoa") return eoaWallet.address;
    return undefined;
  }, [walletType, passkeyWallet.account?.address, eoaWallet.address]);

  // Chain info
  const chainId = React.useMemo(() => {
    if (walletType === "passkey") return arcTestnet.id;
    if (walletType === "eoa") return eoaWallet.chainId;
    return undefined;
  }, [walletType, eoaWallet.chainId]);

  const chain = React.useMemo(() => {
    if (walletType === "passkey") return arcTestnet;
    if (walletType === "eoa") return eoaWallet.chain;
    return undefined;
  }, [walletType, eoaWallet.chain]);

  const chainName = React.useMemo(() => {
    return chain?.name;
  }, [chain]);

  const isLoading = passkeyWallet.isLoading || eoaWallet.isLoading;
  const error = passkeyWallet.error || eoaWallet.error;

  const usdcBalance = React.useMemo(() => {
    if (walletType === "passkey") return passkeyWallet.usdcBalance;
    if (walletType === "eoa") return eoaWallet.usdcBalance;
    return "0";
  }, [walletType, passkeyWallet.usdcBalance, eoaWallet.usdcBalance]);

  const isLoadingBalance =
    passkeyWallet.isLoadingBalance || eoaWallet.isLoadingBalance;

  // Unified actions
  const logout = React.useCallback(() => {
    if (walletType === "passkey") {
      passkeyWallet.logoutPasskey();
    } else if (walletType === "eoa") {
      eoaWallet.disconnectMetaMask();
    }
  }, [walletType, passkeyWallet, eoaWallet]);

  const fetchBalance = React.useCallback(async () => {
    if (walletType === "passkey") {
      await passkeyWallet.fetchBalance();
    } else if (walletType === "eoa") {
      await eoaWallet.fetchBalance();
    }
  }, [walletType, passkeyWallet, eoaWallet]);

  const sendUSDC = React.useCallback(
    async (
      to: Address,
      amount: string
    ): Promise<{ userOpHash?: Hex; txHash: Hex }> => {
      if (walletType === "passkey") {
        const result = await passkeyWallet.sendUSDC(to, amount);
        return { userOpHash: result.userOpHash, txHash: result.txHash };
      } else if (walletType === "eoa") {
        const result = await eoaWallet.sendUSDC(to, amount);
        return { txHash: result.txHash };
      }
      throw new Error("No wallet connected");
    },
    [walletType, passkeyWallet, eoaWallet]
  );

  const clearError = React.useCallback(() => {
    passkeyWallet.clearError();
    eoaWallet.clearError();
  }, [passkeyWallet, eoaWallet]);

  return {
    // Unified state
    isConnected,
    isReady,
    walletType,
    address,
    chainId,
    chainName,
    chain,
    isLoading,
    error,
    usdcBalance,
    isLoadingBalance,
    username: passkeyWallet.username,

    // Passkey actions
    registerPasskey: passkeyWallet.registerPasskey,
    loginPasskey: passkeyWallet.loginPasskey,

    // EOA actions
    connectMetaMask: eoaWallet.connectMetaMask,
    switchChain: eoaWallet.switchChain,

    // Common actions
    logout,
    fetchBalance,
    sendUSDC,
    clearError,

    // Access to underlying hooks
    passkeyWallet,
    eoaWallet,
    
    // Supported chains
    supportedChains: SUPPORTED_CHAINS,
  };
}

