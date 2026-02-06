"use client";

import { useWallet } from "@/contexts/WalletContext";

export function WalletInfo() {
  const {
    account,
    usdcBalance,
    isLoadingBalance,
    fetchBalance,
    logout,
    error,
  } = useWallet();

  if (!account) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          🎯 TweetBet
        </h1>
        <button
          onClick={logout}
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          Logout
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
        <p className="text-sm font-medium text-green-800 dark:text-green-400">
          ✅ Connected
        </p>
        <p className="mt-1 break-all font-mono text-xs text-green-600 dark:text-green-500">
          {account.address}
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
