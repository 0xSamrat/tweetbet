"use client";

import { useState } from "react";
import { useMarketFactory } from "@/hooks/useMarketFactory";
import { useToast } from "@/contexts/ToastContext";
import type { MarketData } from "@/hooks/useMarkets";

// Flexible market type that works with both MarketData and MarketRecord
interface MarketInput {
  marketId: bigint | string;
  question: string;
  yesProbability?: number;
  totalVolume?: string;
}

interface AddLiquidityModalProps {
  isOpen: boolean;
  onClose: () => void;
  market: MarketInput;
  onSuccess?: () => void;
}

export function AddLiquidityModal({ isOpen, onClose, market, onSuccess }: AddLiquidityModalProps) {
  const { addLiquidity, isLoading, error: hookError } = useMarketFactory();
  const { addToast, updateToast } = useToast();
  
  const [amount, setAmount] = useState("5");
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleClose = () => {
    setAmount("5");
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

    // Show pending toast
    const toastId = addToast({
      type: "pending",
      title: "Adding Liquidity...",
      message: `Adding ${amount} USDC to the pool`,
    });

    try {
      // Support both bigint and string marketId
      const marketId = typeof market.marketId === 'string' 
        ? BigInt(market.marketId) 
        : market.marketId;
      
      const result = await addLiquidity({
        marketId,
        amount,
      });
      
      // Update toast to success with tx hash
      updateToast(toastId, {
        type: "success",
        title: "Liquidity Added!",
        message: `Successfully added ${amount} USDC`,
        txHash: result.txHash,
      });
      
      setSuccessMessage(`Liquidity added!`);

      if (onSuccess) onSuccess();
      
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err) {
      console.error("Add liquidity failed:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to add liquidity";
      
      // Update toast to error
      updateToast(toastId, {
        type: "error",
        title: "Add Liquidity Failed",
        message: errorMessage.length > 100 ? errorMessage.slice(0, 100) + "..." : errorMessage,
      });
      
      setFormError(errorMessage);
    }
  };

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
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Liquidity
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Info Box */}
          <div className="p-3 bg-purple-900/20 rounded-md border border-purple-800/30">
            <p className="text-xs text-purple-300">
              Adding liquidity provides YES and NO shares to the pool. You&apos;ll receive LP tokens 
              representing your share of the pool and earn trading fees.
            </p>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Amount (USDC)
            </label>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                step="0.01"
                min="1"
                placeholder="5"
                className="w-full px-4 py-3 pr-16 rounded-md border border-zinc-700 bg-zinc-800 text-white placeholder-zinc-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                disabled={isLoading}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">
                USDC
              </span>
            </div>
            
            {/* Quick Amount Buttons */}
            <div className="flex gap-2 mt-2">
              {["1", "5", "10", "20"].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setAmount(val)}
                  className="flex-1 py-1.5 text-xs font-medium rounded-md border border-zinc-700 hover:bg-zinc-800 text-zinc-400 transition-colors"
                >
                  {val} USDC
                </button>
              ))}
            </div>
          </div>

          {/* Pool Stats */}
          {(market.yesProbability !== undefined || market.totalVolume !== undefined) && (
            <div className="p-3 bg-zinc-800/50 rounded-md space-y-2">
              {market.yesProbability !== undefined && (
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Current Probability</span>
                  <span className="text-white font-medium">{market.yesProbability}% YES</span>
                </div>
              )}
              {market.totalVolume !== undefined && (
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Pool Volume</span>
                  <span className="text-white font-medium">{parseFloat(market.totalVolume).toFixed(4)} USDC</span>
                </div>
              )}
            </div>
          )}

          {/* Error/Success Messages */}
          {(formError || hookError) && (
            <div className="p-3 bg-red-900/20 rounded-md border border-red-800/30">
              <p className="text-sm text-red-400">{formError || hookError}</p>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-green-900/20 rounded-md border border-green-800/30">
              <p className="text-sm text-green-400">{successMessage}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || !amount || parseFloat(amount) <= 0}
            className="w-full py-3 px-4 rounded-md bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Adding Liquidity...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>Add Liquidity</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
