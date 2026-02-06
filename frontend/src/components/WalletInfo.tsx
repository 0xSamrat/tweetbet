"use client";

import { useState } from "react";
import { useWallet } from "@/contexts/WalletContext";

export function WalletInfo() {
  const {
    address,
    walletType,
    usdcBalance,
    isLoadingBalance,
    fetchBalance,
    error,
  } = useWallet();
  
  const [copied, setCopied] = useState(false);

  if (!address) return null;

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

      <div className="rounded-lg bg-purple-50 p-4 dark:bg-purple-900/20">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-purple-800 dark:text-purple-400">
            💰 USDC Balance
          </p>
          <button
            onClick={fetchBalance}
            disabled={isLoadingBalance}
            className="text-xs text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300"
          >
            {isLoadingBalance ? "..." : "↻ Refresh"}
          </button>
        </div>
        <p className="mt-1 text-2xl font-bold text-purple-900 dark:text-purple-300">
          {isLoadingBalance ? "..." : `$${parseFloat(usdcBalance).toFixed(2)}`}
        </p>
      </div>
    </div>
  );
}
