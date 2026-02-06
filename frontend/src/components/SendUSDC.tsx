"use client";

import * as React from "react";
import { type Hex } from "viem";
import { useWallet } from "@/contexts/WalletContext";

export function SendUSDC() {
  const { sendUSDC, isLoading, isReady } = useWallet();
  const [userOpHash, setUserOpHash] = React.useState<Hex>();
  const [txHash, setTxHash] = React.useState<Hex>();
  const [localError, setLocalError] = React.useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setUserOpHash(undefined);
    setTxHash(undefined);
    setLocalError(null);

    const formData = new FormData(event.currentTarget);
    const to = formData.get("to") as `0x${string}`;
    const value = formData.get("value") as string;

    try {
      const result = await sendUSDC(to, value);
      setUserOpHash(result.userOpHash);
      setTxHash(result.txHash);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Transaction failed");
    }
  };

  if (!isReady) return null;

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
          Send USDC (Gasless)
        </h2>

        {localError && (
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {localError}
          </div>
        )}

        <input
          name="to"
          placeholder="Recipient address (0x...)"
          required
          className="w-full rounded-lg border border-zinc-300 px-4 py-3 font-mono text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
        />

        <input
          name="value"
          type="number"
          step="0.01"
          min="0"
          placeholder="Amount (USDC)"
          required
          className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
        />

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-lg bg-green-600 px-4 py-3 font-semibold text-white hover:bg-green-700 disabled:opacity-50"
        >
          {isLoading ? "Sending..." : "💸 Send USDC"}
        </button>
      </form>

      {userOpHash && (
        <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
          <p className="text-sm font-medium text-blue-800 dark:text-blue-400">
            User Op Hash:
          </p>
          <p className="mt-1 break-all font-mono text-xs text-blue-600 dark:text-blue-500">
            {userOpHash}
          </p>
        </div>
      )}

      {txHash && (
        <div className="rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
          <p className="text-sm font-medium text-green-800 dark:text-green-400">
            ✅ Transaction Confirmed!
          </p>
          <a
            href={`https://testnet.arcscan.app/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 block break-all font-mono text-xs text-green-600 underline hover:text-green-800 dark:text-green-500"
          >
            View on ArcScan →
          </a>
        </div>
      )}
    </div>
  );
}
