"use client";

import * as React from "react";
import { useGatewayDeposit } from "@/hooks/useGatewayDeposit";
import { useGatewayBalance } from "@/hooks/useGatewayBalance";
import type { Address } from "viem";

interface GatewayDepositProps {
  address: Address | undefined;
  onSuccess?: () => void;
}

type Chain = "arcTestnet" | "baseSepolia";

const CHAINS: { id: Chain; name: string; icon: string; explorer: string }[] = [
  { id: "arcTestnet", name: "ARC Testnet", icon: "🔵", explorer: "https://testnet.arcscan.app" },
  { id: "baseSepolia", name: "Base Sepolia", icon: "🔷", explorer: "https://sepolia.basescan.org" },
];

export function GatewayDeposit({ address, onSuccess }: GatewayDepositProps) {
  const [selectedChain, setSelectedChain] = React.useState<Chain>("arcTestnet");
  const [amount, setAmount] = React.useState("");
  
  const {
    deposit,
    isApproving,
    isDepositing,
    isWaitingConfirmation,
    error,
    lastDeposit,
  } = useGatewayDeposit();

  const { chainBalances, refetch } = useGatewayBalance(address);

  // Get available balance for selected chain
  const selectedChainBalance = chainBalances.find(
    (b) => b.chainKey === selectedChain
  );
  const availableBalance = selectedChainBalance?.walletBalance ?? "0";

  const handleDeposit = async () => {
    if (!amount || parseFloat(amount) <= 0) return;

    try {
      await deposit(selectedChain, amount);
      setAmount("");
      await refetch();
      onSuccess?.();
    } catch (err) {
      // Error handled by hook
    }
  };

  const handleMaxClick = () => {
    setAmount(availableBalance);
  };

  const isLoading = isApproving || isDepositing || isWaitingConfirmation;

  const getStatusText = () => {
    if (isApproving) return "Approving USDC...";
    if (isDepositing) return "Depositing to Gateway...";
    if (isWaitingConfirmation) return "Waiting for confirmations...";
    return "Deposit to Gateway";
  };

  const explorerUrl = CHAINS.find(c => c.id === lastDeposit?.chain)?.explorer;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-white">
          Deposit to Gateway
        </h3>
        <span className="px-2 py-0.5 text-xs font-medium bg-gradient-to-r from-blue-900/30 to-purple-900/30 text-blue-300 rounded-full">
          Unified Balance
        </span>
      </div>

      {/* Info Box */}
      <div className="rounded-lg bg-blue-900/20 p-3 border border-blue-800">
        <p className="text-xs text-blue-300">
          💡 Deposit USDC to Circle Gateway to create a unified balance. 
          Once deposited, you can instantly transfer to ARC Testnet.
        </p>
      </div>

      {/* Chain Selection */}
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-2">
          Deposit From
        </label>
        <div className="grid grid-cols-2 gap-2">
          {CHAINS.map((chain) => {
            const balance = chainBalances.find((b) => b.chainKey === chain.id);
            return (
              <button
                key={chain.id}
                type="button"
                onClick={() => setSelectedChain(chain.id)}
                className={`p-3 rounded-lg text-left transition-all ${
                  selectedChain === chain.id
                    ? "bg-blue-900/50 border-2 border-blue-500"
                    : "bg-zinc-800 border border-zinc-700 hover:border-blue-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{chain.icon}</span>
                  <span className="text-sm font-medium text-white">
                    {chain.name}
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-400">
                  Available: ${parseFloat(balance?.walletBalance ?? "0").toFixed(2)}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Amount Input */}
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
            className="w-full rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2.5 pr-16 text-sm text-white placeholder-zinc-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleMaxClick}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs font-medium text-blue-400 hover:text-blue-300 bg-blue-900/30 rounded"
          >
            MAX
          </button>
        </div>
      </div>

      {/* Deposit Button */}
      <button
        onClick={handleDeposit}
        disabled={isLoading || !amount || parseFloat(amount) <= 0}
        className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
          "🏦 Deposit to Gateway"
        )}
      </button>

      {/* Success Message */}
      {lastDeposit && (
        <div className="rounded-lg bg-green-900/20 p-3 border border-green-800">
          <p className="text-xs font-medium text-green-300">
            ✅ Deposited ${lastDeposit.amount} USDC to Gateway!
          </p>
          <a
            href={`${explorerUrl}/tx/${lastDeposit.depositTxHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-green-400 underline mt-1 block"
          >
            View Transaction →
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
