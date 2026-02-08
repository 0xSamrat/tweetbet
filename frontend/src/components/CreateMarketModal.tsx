"use client";

import { useState, useEffect } from "react";
import { useMarketFactory } from "@/hooks/useMarketFactory";
import { useToast } from "@/contexts/ToastContext";
import { encodeXPost, parseXPostUrl } from "@/utils/xPostCodec";
import { generatePredictionFromTweet } from "@/services/geminiService";
import { saveMarketToDatabase } from "@/services/marketService";
import { useWallet } from "@/contexts/WalletContext";
import type { Hex } from "viem";

interface CreateMarketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (marketId: bigint) => void;
}

export function CreateMarketModal({ isOpen, onClose, onSuccess }: CreateMarketModalProps) {
  const { createMarketAndSeed, isLoading, error: hookError } = useMarketFactory();
  const { addToast, updateToast } = useToast();
  const wallet = useWallet();
  
  // Step state: "input" for X URL input, "review" for reviewing/editing
  const [step, setStep] = useState<"input" | "review">("input");
  
  // Form state
  const [xPostUrl, setXPostUrl] = useState("");
  const [question, setQuestion] = useState(""); // Max 80 chars - goes to blockchain
  const [aiDescription, setAiDescription] = useState(""); // Context - goes to database only
  const [aiSuggestedCloseTime, setAiSuggestedCloseTime] = useState("");
  const [closeDate, setCloseDate] = useState("");
  const [closeTime, setCloseTime] = useState("23:59");
  const [liquidityAmount, setLiquidityAmount] = useState("0.01");
  
  // Scraped tweet data for MongoDB
  const [tweetContent, setTweetContent] = useState("");
  const [tweetAuthor, setTweetAuthor] = useState("");
  
  // Loading states
  const [isGenerating, setIsGenerating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setStep("input");
      setXPostUrl("");
      setQuestion("");
      setAiDescription("");
      setAiSuggestedCloseTime("");
      setCloseDate("");
      setCloseTime("23:59");
      setLiquidityAmount("0.01");
      setTweetContent("");
      setTweetAuthor("");
      setFormError(null);
      setSuccessMessage(null);
    }
  }, [isOpen]);

  const handleClose = () => {
    onClose();
  };

  // Validate X post URL
  const isValidXUrl = (url: string) => {
    return /^https?:\/\/(twitter\.com|x\.com)\/\w+\/status\/\d+/.test(url);
  };

  // Apply close time suggestion from AI
  const applyCloseTimeSuggestion = (suggestion: string) => {
    const now = new Date();
    let days = 7;
    
    switch (suggestion) {
      case "1 day": days = 1; break;
      case "3 days": days = 3; break;
      case "7 days": days = 7; break;
      case "14 days": days = 14; break;
      case "30 days": days = 30; break;
      case "90 days": days = 90; break;
    }
    
    now.setDate(now.getDate() + days);
    setCloseDate(now.toISOString().split("T")[0]);
  };

  // Generate prediction from X post using AI
  const handleGeneratePrediction = async () => {
    if (!isValidXUrl(xPostUrl)) {
      setFormError("Please enter a valid X/Twitter post URL");
      return;
    }

    setIsGenerating(true);
    setFormError(null);

    try {
      const result = await generatePredictionFromTweet(xPostUrl);
      setQuestion(result.question);
      setAiDescription(result.description);
      setAiSuggestedCloseTime(result.suggestedCloseTime);
      applyCloseTimeSuggestion(result.suggestedCloseTime);
      // Store scraped tweet data if available
      if (result.tweetContent) setTweetContent(result.tweetContent);
      if (result.tweetAuthor) setTweetAuthor(result.tweetAuthor);
      setStep("review");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to generate prediction");
    } finally {
      setIsGenerating(false);
    }
  };

  // Quick duration buttons
  const setDuration = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    setCloseDate(date.toISOString().split("T")[0]);
  };

  // Submit market creation
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    // Validation
    if (!question.trim()) {
      setFormError("Market question is required");
      return;
    }

    if (question.trim().length > 80) {
      setFormError("Question must be 80 characters or less");
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
    if (xPostUrl.trim() && isValidXUrl(xPostUrl)) {
      const parsed = parseXPostUrl(xPostUrl.trim());
      if (parsed) {
        xPost = encodeXPost(parsed.postId, parsed.user) as Hex;
      }
    }

    // Show pending toast
    const toastId = addToast({
      type: "pending",
      title: "Creating Market...",
      message: `Creating prediction market with ${liquidityAmount} ETH liquidity`,
    });

    try {
      // Only send question to blockchain (max 80 chars)
      const result = await createMarketAndSeed({
        description: question.trim(), // This is the short question for blockchain
        closeTime: closeTimestamp,
        liquidityAmount: liquidityAmount,
        xPost,
      });

      // Update toast to success with tx hash
      updateToast(toastId, {
        type: "success",
        title: "Market Created!",
        message: `Market #${result.marketId.toString().slice(0, 8)}... created successfully`,
        txHash: result.transactionHash,
      });

      // After successful transaction, save both question and description to MongoDB
      try {
        const parsed = xPostUrl.trim() && isValidXUrl(xPostUrl) ? parseXPostUrl(xPostUrl.trim()) : null;
        console.log("Saving to MongoDB with marketId:", result.marketId.toString());
        await saveMarketToDatabase({
          marketId: result.marketId.toString(),
          ammAddress: "",
          creatorAddress: wallet.address || "",
          question: question.trim(), // Short question (max 80 chars)
          description: aiDescription || undefined, // Detailed context from AI
          closeTime: Number(closeTimestamp),
          xPostUrl: xPostUrl.trim() || undefined,
          xPostId: parsed?.postId?.toString() || undefined,
          aiSuggestedCloseTime: aiSuggestedCloseTime || undefined,
          tweetContent: tweetContent || undefined,
          tweetAuthor: tweetAuthor || undefined,
          initialLiquidity: liquidityAmount,
          createdAt: new Date(),
          chainId: 5115, // Arc testnet
          transactionHash: result.transactionHash,
        });

      } catch (dbError) {
        console.error("Failed to save to MongoDB:", dbError);
        // Don't fail the whole operation if MongoDB save fails
      }

      setSuccessMessage(`Market created successfully!`);
      
      if (onSuccess) {
        onSuccess(result.marketId);
      }

      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err) {
      console.error("Failed to create market:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to create market";
      
      // Update toast to error
      updateToast(toastId, {
        type: "error",
        title: "Market Creation Failed",
        message: errorMessage.length > 100 ? errorMessage.slice(0, 100) + "..." : errorMessage,
      });
      
      setFormError(errorMessage);
    }
  };

  if (!isOpen) return null;

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg mx-4 bg-zinc-900 rounded-md shadow-2xl border border-zinc-700 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-700">
          <div>
            <h2 className="text-xl font-bold text-white">
              {step === "input" ? "Create Prediction Market" : "Review & Create"}
            </h2>
            <p className="text-sm text-zinc-400 mt-1">
              {step === "input" 
                ? "Paste an X post and let AI generate a prediction" 
                : "Review and customize your prediction market"}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-zinc-800 rounded-md transition-colors"
          >
            <svg className="w-5 h-5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {successMessage ? (
            /* Success State */
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Market Created Successfully!
              </h3>
              <p className="text-zinc-400">
                Your prediction market is now live.
              </p>
            </div>
          ) : step === "input" ? (
            /* Step 1: Input X Post URL */
            <div className="space-y-6">
              {/* X Post URL Input */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  X/Twitter Post URL
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-zinc-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  </div>
                  <input
                    type="url"
                    value={xPostUrl}
                    onChange={(e) => setXPostUrl(e.target.value)}
                    placeholder="https://x.com/user/status/123456789"
                    className="w-full pl-10 pr-4 py-3 rounded-md border border-zinc-700 bg-zinc-800 text-white placeholder-zinc-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <p className="mt-2 text-xs text-zinc-400">
                  Paste a link to any X/Twitter post. AI will generate a prediction question from it.
                </p>
              </div>

              {/* Error */}
              {formError && (
                <div className="p-3 bg-red-900/20 rounded-md border border-red-900/30">
                  <p className="text-sm text-red-400">{formError}</p>
                </div>
              )}

              {/* Generate Button */}
              <button
                onClick={handleGeneratePrediction}
                disabled={!xPostUrl || isGenerating}
                className="w-full py-3 px-4 rounded-md bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Generating with AI...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>Generate Prediction</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            /* Step 2: Review & Customize */
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Prediction Question (max 80 chars - stored on blockchain) */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Prediction Question 
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value.slice(0, 80))}
                    placeholder="Will [something specific] happen by [date]?"
                    className={`w-full px-4 py-3 rounded-md border ${
                      question.length > 80 ? 'border-red-500' : 'border-zinc-700'
                    } bg-zinc-800 text-white placeholder-zinc-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                    required
                    disabled={isLoading}
                    maxLength={80}
                  />
                  <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs ${
                    question.length >= 70 ? (question.length >= 80 ? 'text-red-400' : 'text-yellow-400') : 'text-zinc-500'
                  }`}>
                    {question.length}/80
                  </span>
                </div>
              </div>

              {/* AI Description (context for database - not stored on blockchain) */}
              {aiDescription && (
                <div className="p-3 bg-blue-900/20 rounded-md border border-blue-900/30">
                  <p className="text-xs font-medium text-blue-400 mb-1.5 flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Context (stored in database, not on blockchain)
                  </p>
                  <p className="text-sm text-blue-300">{aiDescription}</p>
                </div>
              )}

              {/* X Post URL (readonly or editable) */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  X/Twitter Post (optional)
                </label>
                <input
                  type="url"
                  value={xPostUrl}
                  onChange={(e) => setXPostUrl(e.target.value)}
                  placeholder="https://x.com/user/status/123456789"
                  className="w-full px-4 py-3 rounded-md border border-zinc-700 bg-zinc-800 text-white placeholder-zinc-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isLoading}
                />
              </div>

              {/* Close Date */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Market Closes *
                </label>
                
                {/* Quick Duration Buttons */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {[
                    { label: "1 Day", days: 1 },
                    { label: "3 Days", days: 3 },
                    { label: "1 Week", days: 7 },
                    { label: "2 Weeks", days: 14 },
                    { label: "1 Month", days: 30 },
                  ].map((opt) => (
                    <button
                      key={opt.days}
                      type="button"
                      onClick={() => setDuration(opt.days)}
                      className="px-3 py-1.5 text-xs font-medium rounded-md border border-zinc-700 hover:bg-zinc-800 text-zinc-400 transition-colors"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="date"
                    value={closeDate}
                    onChange={(e) => setCloseDate(e.target.value)}
                    min={today}
                    className="px-4 py-3 rounded-md border border-zinc-700 bg-zinc-800 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    disabled={isLoading}
                  />
                  <input
                    type="time"
                    value={closeTime}
                    onChange={(e) => setCloseTime(e.target.value)}
                    className="px-4 py-3 rounded-md border border-zinc-700 bg-zinc-800 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Initial Liquidity */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Initial Liquidity (USDC) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={liquidityAmount}
                    onChange={(e) => setLiquidityAmount(e.target.value)}
                    className="w-full px-4 py-3 rounded-md border border-zinc-700 bg-zinc-800 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    disabled={isLoading}
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-zinc-400 text-sm">USDC</span>
                  </div>
                </div>
                <p className="mt-2 text-xs text-zinc-400">
                  This seeds the liquidity pool. You&apos;ll receive LP tokens.
                </p>
              </div>

              {/* Error */}
              {(formError || hookError) && (
                <div className="p-3 bg-red-900/20 rounded-md border border-red-900/30">
                  <p className="text-sm text-red-400">{formError || hookError}</p>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep("input")}
                  className="flex-1 py-3 px-4 rounded-md border border-zinc-700 text-zinc-300 font-medium hover:bg-zinc-800 transition-colors"
                  disabled={isLoading}
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-3 px-4 rounded-md bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create Market</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
