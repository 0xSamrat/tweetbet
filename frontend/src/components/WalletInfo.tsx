"use client";

import { useState } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { useGatewayBalance } from "@/hooks/useGatewayBalance";
import type { Address } from "viem";

export function WalletInfo() {
  const {
    address,
    walletType,
    usdcBalance,
    isLoadingBalance,
    fetchBalance,
    error,
  } = useWallet();
  
  // Gateway balance for MetaMask users
  const gatewayBalance = useGatewayBalance(
    walletType === "eoa" ? (address as Address) : undefined
  );
  
  const [copied, setCopied] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  if (!address) return null;

  const isMetaMask = walletType === "eoa";
  const gasLabel = walletType === "passkey" ? "Gasless" : "Requires Gas";
  const walletLabel = walletType === "passkey" ? "🔐 Passkey" : "🦊 MetaMask";
  const truncatedAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleRefresh = () => {
    if (isMetaMask) {
      gatewayBalance.refetch();
    } else {
      fetchBalance();
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-green-800 dark:text-green-400">
            ✅ Connected
          </p>
          <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-800/30 dark:text-green-300">
            {walletLabel}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <p className="font-mono text-sm text-green-600 dark:text-green-500">
            {truncatedAddress}
          </p>
          <button
            onClick={handleCopy}
            className="p-1 rounded hover:bg-green-100 dark:hover:bg-green-800/30 transition-colors"
            title={copied ? "Copied!" : "Copy address"}
          >
            {copied ? (
              <svg className="h-4 w-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="h-4 w-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
        </div>
        <p className="mt-1 text-xs text-green-600/70 dark:text-green-500/70">
          {gasLabel}
        </p>
      </div>

      {/* Balance Display */}
      {isMetaMask ? (
        /* MetaMask: Show Gateway Unified Balance + Wallet Balance */
        <div className="space-y-3">
          {/* Unified Gateway Balance */}
          <div className="rounded-xl bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 p-4 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-lg">🌐</span>
                <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  Unified Gateway Balance
                </p>
              </div>
              <button
                onClick={handleRefresh}
                disabled={gatewayBalance.isLoading}
                className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
              >
                {gatewayBalance.isLoading ? "..." : "↻"}
              </button>
            </div>
            <p className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              {gatewayBalance.isLoading ? "..." : `$${gatewayBalance.totalGatewayBalance}`}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Available for instant cross-chain transfer
            </p>
          </div>

          {/* Wallet Balance (Not deposited) */}
          <div className="rounded-xl bg-zinc-100 dark:bg-zinc-800/50 p-3 border border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">💳</span>
                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Wallet Balance (Not Deposited)
                </p>
              </div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                ${gatewayBalance.totalWalletBalance}
              </p>
            </div>
          </div>

          {/* Breakdown Toggle */}
          <button
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="w-full flex items-center justify-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 py-1"
          >
            {showBreakdown ? "Hide" : "Show"} breakdown by chain
            <svg
              className={`w-3 h-3 transition-transform ${showBreakdown ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Chain Breakdown */}
          {showBreakdown && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
              {gatewayBalance.chainBalances.map((balance) => (
                <div
                  key={balance.chainId}
                  className="rounded-lg bg-white dark:bg-zinc-800 p-3 border border-zinc-200 dark:border-zinc-700"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span>{balance.symbol}</span>
                      <span className="text-sm font-medium text-zinc-900 dark:text-white">
                        {balance.chain}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-zinc-50 dark:bg-zinc-900 rounded p-2">
                      <p className="text-zinc-500 dark:text-zinc-400">Gateway</p>
                      <p className="font-semibold text-zinc-900 dark:text-white">
                        ${parseFloat(balance.gatewayBalance).toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-zinc-50 dark:bg-zinc-900 rounded p-2">
                      <p className="text-zinc-500 dark:text-zinc-400">Wallet</p>
                      <p className="font-semibold text-zinc-900 dark:text-white">
                        ${parseFloat(balance.walletBalance).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Passkey: Show Single Chain Balance */
        <div className="rounded-xl bg-purple-50 dark:bg-purple-900/20 p-4 border border-purple-200 dark:border-purple-800">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-medium text-purple-700 dark:text-purple-300">
              💰 USDC Balance
            </p>
            <button
              onClick={fetchBalance}
              disabled={isLoadingBalance}
              className="text-xs text-purple-600 hover:text-purple-800 dark:text-purple-400"
            >
              {isLoadingBalance ? "..." : "↻ Refresh"}
            </button>
          </div>
          <p className="text-2xl font-bold text-purple-900 dark:text-purple-300">
            {isLoadingBalance ? "..." : `$${parseFloat(usdcBalance).toFixed(2)}`}
          </p>
          <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
            🔵 ARC Testnet
          </p>
        </div>
      )}
    </div>
  );
}
