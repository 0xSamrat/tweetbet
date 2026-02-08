"use client";

import * as React from "react";
import { type Hex, type Address } from "viem";
import { useWallet } from "@/contexts/WalletContext";

export function SendUSDC() {
  const { sendUSDC, isLoading, isReady, walletType } = useWallet();
  const [userOpHash, setUserOpHash] = React.useState<Hex>();
  const [txHash, setTxHash] = React.useState<Hex>();
  const [localError, setLocalError] = React.useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setUserOpHash(undefined);
    setTxHash(undefined);
    setLocalError(null);

    const formData = new FormData(event.currentTarget);
    const to = formData.get("to") as Address;
    const value = formData.get("value") as string;

    try {
      const result = await sendUSDC(to, value);
      if (result.userOpHash) {
        setUserOpHash(result.userOpHash);
      }
      setTxHash(result.txHash);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Transaction failed");
    }
  };

  if (!isReady) return null;

  const isGasless = walletType === "passkey";
  const buttonLabel = isGasless ? "💸 Send USDC (Gasless)" : "💸 Send USDC";
  const titleLabel = isGasless ? "Send USDC (Gasless)" : "Send USDC";

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <h2 className="text-lg font-semibold text-white">
          {titleLabel}
        </h2>

        {localError && (
          <div className="rounded-lg bg-red-900/20 p-4 text-sm text-red-400">
            {localError}
          </div>
        )}

        {!isGasless && (
          <div className="rounded-lg bg-amber-900/20 p-3 text-xs text-amber-400">
            ⚠️ MetaMask transactions require gas fees
          </div>
        )}

        <input
          name="to"
          placeholder="Recipient address (0x...)"
          required
          className="w-full rounded-lg border border-zinc-700 px-4 py-3 font-mono text-sm text-white placeholder-zinc-400 focus:border-blue-500 focus:outline-none bg-zinc-800"
        />

        <input
          name="value"
          type="number"
          step="0.01"
          min="0"
          placeholder="Amount (USDC)"
          required
          className="w-full rounded-lg border border-zinc-700 px-4 py-3 text-white placeholder-zinc-400 focus:border-blue-500 focus:outline-none bg-zinc-800"
        />

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-lg bg-green-600 px-4 py-3 font-semibold text-white hover:bg-green-700 disabled:opacity-50"
        >
          {isLoading ? "Sending..." : buttonLabel}
        </button>
      </form>

      {userOpHash && (
        <div className="rounded-lg bg-blue-900/20 p-4">
          <p className="text-sm font-medium text-blue-400">
            User Op Hash:
          </p>
          <p className="mt-1 break-all font-mono text-xs text-blue-500">
            {userOpHash}
          </p>
        </div>
      )}

      {txHash && (
        <div className="rounded-lg bg-green-900/20 p-4">
          <p className="text-sm font-medium text-green-400">
            ✅ Transaction Confirmed!
          </p>
          <a
            href={`https://testnet.arcscan.app/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 block break-all font-mono text-xs text-green-500 underline hover:text-green-300"
          >
            View on ArcScan →
          </a>
        </div>
      )}
    </div>
  );
}
