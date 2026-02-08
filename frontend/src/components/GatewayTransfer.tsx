"use client";

import * as React from "react";
import { useGatewayTransfer } from "@/hooks/useGatewayTransfer";
import { useGatewayBalance } from "@/hooks/useGatewayBalance";
import type { Address } from "viem";

interface GatewayTransferProps {
  address: Address | undefined;
  onSuccess?: () => void;
}

type Chain = "arcTestnet" | "baseSepolia";

const CHAINS: { id: Chain; name: string; icon: string }[] = [
  { id: "arcTestnet", name: "ARC Testnet", icon: "🔵" },
  { id: "baseSepolia", name: "Base Sepolia", icon: "🔷" },
];

export function GatewayTransfer({ address, onSuccess }: GatewayTransferProps) {
  const [recipient, setRecipient] = React.useState("");
  const [amount, setAmount] = React.useState("");
  
  const {
    transfer,
    isSigningIntents,
    isSubmittingToApi,
    isMinting,
    error,
    lastTransfer,
  } = useGatewayTransfer();

  const { chainBalances, totalGatewayBalance, refetch } = useGatewayBalance(address);

  const isLoading = isSigningIntents || isSubmittingToApi || isMinting;

  // Calculate how to split the transfer across chains based on available gateway balances
  const calculateSources = (targetAmount: number): { chain: Chain; amount: string }[] => {
    const sources: { chain: Chain; amount: string }[] = [];
    let remaining = targetAmount;

    // Sort chains by gateway balance (descending) to use largest balances first
    const sortedBalances = [...chainBalances]
      .filter(b => parseFloat(b.gatewayBalance) > 0)
      .sort((a, b) => parseFloat(b.gatewayBalance) - parseFloat(a.gatewayBalance));

    for (const balance of sortedBalances) {
      if (remaining <= 0) break;

      const available = parseFloat(balance.gatewayBalance);
      const toTake = Math.min(available, remaining);

      if (toTake > 0.000001) { // Avoid dust amounts
        // Floor to 6 decimals to avoid rounding up beyond available balance
        const flooredAmount = Math.floor(toTake * 1000000) / 1000000;
        sources.push({
          chain: balance.chainKey,
          amount: flooredAmount.toFixed(6),
        });
        remaining -= toTake;
      }
    }

    return sources;
  };

  const handleTransfer = async () => {
    if (!amount || parseFloat(amount) <= 0 || !recipient) return;

    const targetAmount = parseFloat(amount);
    const sources = calculateSources(targetAmount);

    if (sources.length === 0) {
      return;
    }

    try {
      await transfer({
        sources,
        recipient: recipient as Address,
      });
      setAmount("");
      setRecipient("");
      await refetch();
      onSuccess?.();
    } catch (err) {
      // Error handled by hook
    }
  };

  const handleMaxClick = () => {
    setAmount(totalGatewayBalance);
  };

  const handleSelfClick = () => {
    if (address) {
      setRecipient(address);
    }
  };

  const getStatusText = () => {
    if (isSigningIntents) return "Signing burn intents...";
    if (isSubmittingToApi) return "Getting attestation...";
    if (isMinting) return "Minting on ARC Testnet...";
    return "Transfer Unified USDC";
  };

  const previewSources = amount ? calculateSources(parseFloat(amount)) : [];
  const insufficientBalance = parseFloat(amount || "0") > parseFloat(totalGatewayBalance);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-white">
          Transfer to ARC Testnet
        </h3>
        <span className="px-2 py-0.5 text-xs font-medium bg-gradient-to-r from-green-900/30 to-blue-900/30 text-green-300 rounded-full">
          Instant
        </span>
      </div>

      {/* Info Box */}
      <div className="rounded-lg bg-green-900/20 p-3 border border-green-800">
        <p className="text-xs text-green-300">
          ⚡ Instantly transfer your unified USDC balance to ARC Testnet. 
          Circle Gateway burns from source chains and mints on destination.
        </p>
      </div>

      {/* Available Balance */}
      <div className="rounded-lg bg-zinc-800 p-3">
        <p className="text-xs text-zinc-400">Available Unified Balance</p>
        <p className="text-lg font-bold text-white">
          ${totalGatewayBalance} USDC
        </p>
      </div>

      {/* Recipient */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-medium text-zinc-400">
            Recipient Address (on ARC Testnet)
          </label>
          <button
            type="button"
            onClick={handleSelfClick}
            className="text-xs text-blue-400 hover:underline"
          >
            Use my address
          </button>
        </div>
        <input
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="0x..."
          className="w-full rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder-zinc-400 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none font-mono"
        />
      </div>

      {/* Amount */}
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">
          Amount (USDC)
        </label>
        <div className="relative">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            min="0"
            step="0.01"
            className={`w-full rounded-lg border ${
              insufficientBalance 
                ? "border-red-500 focus:border-red-500 focus:ring-red-500" 
                : "border-zinc-600 focus:border-green-500 focus:ring-green-500"
            } bg-zinc-800 px-3 py-2.5 pr-16 text-sm text-white placeholder-zinc-400 focus:ring-1 focus:outline-none`}
          />
          <button
            type="button"
            onClick={handleMaxClick}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs font-medium text-green-400 hover:text-green-300 bg-green-900/30 rounded"
          >
            MAX
          </button>
        </div>
        {insufficientBalance && (
          <p className="mt-1 text-xs text-red-500">Insufficient unified balance</p>
        )}
      </div>

      {/* Source Preview */}
      {previewSources.length > 0 && !insufficientBalance && (
        <div className="rounded-lg bg-blue-900/20 p-3 border border-blue-800">
          <p className="text-xs font-medium text-blue-300 mb-2">
            🔄 Will burn from:
          </p>
          <div className="space-y-1">
            {previewSources.map((source, i) => {
              const chainInfo = CHAINS.find(c => c.id === source.chain);
              return (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-blue-400">
                    {chainInfo?.icon} {chainInfo?.name}
                  </span>
                  <span className="font-mono text-blue-300">
                    ${parseFloat(source.amount).toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-2 pt-2 border-t border-blue-700 flex items-center justify-between text-xs">
            <span className="text-blue-400">
              → Mint on 🔵 ARC Testnet
            </span>
            <span className="font-mono font-semibold text-blue-300">
              ${parseFloat(amount).toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* Transfer Button */}
      <button
        onClick={handleTransfer}
        disabled={isLoading || !amount || parseFloat(amount) <= 0 || !recipient || insufficientBalance}
        className="w-full rounded-lg bg-gradient-to-r from-green-600 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:from-green-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            {getStatusText()}
          </span>
        ) : (
          "⚡ Transfer Instantly to ARC"
        )}
      </button>

      {/* Success Message */}
      {lastTransfer && (
        <div className="rounded-lg bg-green-900/20 p-3 border border-green-800">
          <p className="text-xs font-medium text-green-300">
            ✅ Transferred ${lastTransfer.totalAmount} USDC to ARC Testnet!
          </p>
          <p className="text-xs text-green-400 mt-1">
            To: {lastTransfer.recipient.slice(0, 6)}...{lastTransfer.recipient.slice(-4)}
          </p>
          <a
            href={`https://testnet.arcscan.app/tx/${lastTransfer.mintTxHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-green-400 underline mt-1 block"
          >
            View on ArcScan →
          </a>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-900/20 p-3 border border-red-800">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
}
