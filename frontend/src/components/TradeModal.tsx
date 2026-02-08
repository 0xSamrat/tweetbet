"use client";

import { useState } from "react";
import { useMarketFactory } from "@/hooks/useMarketFactory";
import type { MarketData } from "@/hooks/useMarkets";
import { formatEther } from "viem";

interface TradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  market: MarketData;
  initialSide: "yes" | "no";
  onSuccess?: () => void;
}

export function TradeModal({ isOpen, onClose, market, initialSide, onSuccess }: TradeModalProps) {
  const { buyYes, buyNo, isLoading, error: hookError } = useMarketFactory();
  
  const [side, setSide] = useState<"yes" | "no">(initialSide);
  const [amount, setAmount] = useState("0.01");
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleClose = () => {
    setAmount("0.01");
    setFormError(null);
    setSuccessMessage(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setFormError("Please enter a valid amount");
      return;
    }

    try {
      if (side === "yes") {
        const result = await buyYes({
          marketId: market.marketId,
          amount,
        });
        setSuccessMessage(`Bought YES shares! TX: ${result.txHash.slice(0, 10)}...`);
      } else {
        const result = await buyNo({
          marketId: market.marketId,
          amount,
        });
        setSuccessMessage(`Bought NO shares! TX: ${result.txHash.slice(0, 10)}...`);
      }

      if (onSuccess) onSuccess();
      
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err) {
      console.error("Trade failed:", err);
      setFormError(err instanceof Error ? err.message : "Trade failed");
    }
  };

  // Calculate estimated shares (rough estimate: 1 ETH = ~2x shares due to AMM)
  const estimatedShares = parseFloat(amount) * 1.5; // Simplified estimate

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal content */}
      <div className="relative z-10 w-full max-w-md mx-4 bg-zinc-900 rounded-md shadow-2xl border border-zinc-700 overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-zinc-700">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">
              Trade
            </h2>
            <button
              onClick={handleClose}
              className="text-zinc-400 hover:text-zinc-200 transition"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {/* Market Question */}
          <p className="mt-2 text-sm text-zinc-400 line-clamp-2">
            {market.question}
          </p>
        </div>

        {/* Toggle YES/NO */}
        <div className="p-5 space-y-5">
          <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-800 rounded-md">
            <button
              type="button"
              onClick={() => setSide("yes")}
              className={`py-3 rounded-md font-semibold text-sm transition-all ${
                side === "yes"
                  ? "bg-green-500 text-white shadow-md"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Yes {market.yesProbability}%
            </button>
            <button
              type="button"
              onClick={() => setSide("no")}
              className={`py-3 rounded-md font-semibold text-sm transition-all ${
                side === "no"
                  ? "bg-red-500 text-white shadow-md"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              No {100 - market.yesProbability}%
            </button>
          </div>

          {/* Amount Input */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Amount (USDC)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.01"
                  step="0.001"
                  min="0.001"
                  className="w-full px-4 py-3 rounded-md border border-zinc-700 bg-zinc-800 text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-medium"
                  disabled={isLoading}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">
                  USDC
                </div>
              </div>
              {/* Quick amounts */}
              <div className="flex gap-2 mt-2">
                {["0.01", "0.05", "0.1", "0.5"].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setAmount(val)}
                    className="flex-1 py-1.5 rounded-md text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition"
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>

            {/* Estimate */}
            <div className="p-4 rounded-md bg-zinc-800/50 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">You pay</span>
                <span className="font-medium text-white">{amount} USDC</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Est. shares</span>
                <span className={`font-medium ${side === "yes" ? "text-green-600" : "text-red-600"}`}>
                  ~{estimatedShares.toFixed(4)} {side.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Potential payout</span>
                <span className="font-medium text-white">
                  {(estimatedShares * 1).toFixed(4)} USDC
                </span>
              </div>
            </div>

            {/* Error Message */}
            {(formError || hookError) && (
              <div className="p-3 rounded-md bg-red-900/20 border border-red-800">
                <p className="text-sm text-red-400">
                  {formError || hookError}
                </p>
              </div>
            )}

            {/* Success Message */}
            {successMessage && (
              <div className="p-3 rounded-md bg-green-900/20 border border-green-800">
                <p className="text-sm text-green-400">
                  {successMessage}
                </p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-4 px-6 rounded-md font-semibold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                side === "yes"
                  ? "bg-green-500 hover:bg-green-600 text-white"
                  : "bg-red-500 hover:bg-red-600 text-white"
              }`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing...
                </span>
              ) : (
                `Buy ${side.toUpperCase()}`
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
