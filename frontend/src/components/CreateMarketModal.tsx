"use client";

import { useState } from "react";
import { useMarketFactory } from "@/hooks/useMarketFactory";
import { encodeXPost, parseXPostUrl } from "@/utils/xPostCodec";
import type { Hex } from "viem";

interface CreateMarketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (marketId: bigint) => void;
}

export function CreateMarketModal({ isOpen, onClose, onSuccess }: CreateMarketModalProps) {
  const { createMarketAndSeed, isLoading, error: hookError } = useMarketFactory();
  
  // Form state
  const [description, setDescription] = useState("");
  const [closeDate, setCloseDate] = useState("");
  const [closeTime, setCloseTime] = useState("");
  const [liquidityAmount, setLiquidityAmount] = useState("0.01");
  const [xPostUrl, setXPostUrl] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const resetForm = () => {
    setDescription("");
    setCloseDate("");
    setCloseTime("");
    setLiquidityAmount("0.01");
    setXPostUrl("");
    setFormError(null);
    setSuccessMessage(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    // Validation
    if (!description.trim()) {
      setFormError("Market question is required");
      return;
    }

    if (!closeDate || !closeTime) {
      setFormError("Close date and time are required");
      return;
    }

    const liquidityNum = parseFloat(liquidityAmount);
    if (isNaN(liquidityNum) || liquidityNum <= 0) {
      setFormError("Invalid liquidity amount");
      return;
    }

    // Parse close timestamp
    const closeDateTime = new Date(`${closeDate}T${closeTime}`);
    if (closeDateTime.getTime() <= Date.now()) {
      setFormError("Close time must be in the future");
      return;
    }
    const closeTimestamp = BigInt(Math.floor(closeDateTime.getTime() / 1000));

    // Encode X post if provided
    let xPost: Hex = "0x0000000000000000000000000000000000000000000000000000000000000000";
    if (xPostUrl.trim()) {
      const parsed = parseXPostUrl(xPostUrl.trim());
      if (!parsed) {
        setFormError("Invalid X/Twitter post URL. Format: https://x.com/username/status/123456");
        return;
      }
      xPost = encodeXPost(parsed.postId, parsed.user) as Hex;
    }

    try {
      const result = await createMarketAndSeed({
        description: description.trim(),
        closeTime: closeTimestamp,
        liquidityAmount: liquidityAmount,
        xPost,
      });

      setSuccessMessage(`Market created! ID: ${result.marketId.toString()}`);
      
      // Call success callback
      if (onSuccess) {
        onSuccess(result.marketId);
      }

      // Reset form after short delay
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err) {
      console.error("Failed to create market:", err);
      setFormError(err instanceof Error ? err.message : "Failed to create market");
    }
  };

  if (!isOpen) return null;

  // Get minimum date (today)
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal content */}
      <div className="relative z-10 w-full max-w-lg mx-4 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-700">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
            Create New Market
          </h2>
          <button
            onClick={handleClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Market Question */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Market Question *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Will ETH reach $10,000 by end of 2026?"
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              disabled={isLoading}
            />
          </div>

          {/* Close Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Close Date *
              </label>
              <input
                type="date"
                value={closeDate}
                onChange={(e) => setCloseDate(e.target.value)}
                min={today}
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Close Time *
              </label>
              <input
                type="time"
                value={closeTime}
                onChange={(e) => setCloseTime(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Initial Liquidity */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Initial Liquidity (USDC) *
            </label>
            <input
              type="number"
              value={liquidityAmount}
              onChange={(e) => setLiquidityAmount(e.target.value)}
              placeholder="0.1"
              step="0.001"
              min="0.001"
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
            />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              This USDC will be used to seed the prediction market liquidity pool
            </p>
          </div>

          {/* X Post URL (Optional) */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              X/Twitter Post (Optional)
            </label>
            <input
              type="url"
              value={xPostUrl}
              onChange={(e) => setXPostUrl(e.target.value)}
              placeholder="https://x.com/elonmusk/status/1234567890123456789"
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
            />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Link this market to a specific tweet for context
            </p>
          </div>

          {/* Error Message */}
          {(formError || hookError) && (
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">
                {formError || hookError}
              </p>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              <p className="text-sm text-green-600 dark:text-green-400">
                {successMessage}
              </p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold text-lg hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Creating Market...
              </span>
            ) : (
              "Create Market"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
