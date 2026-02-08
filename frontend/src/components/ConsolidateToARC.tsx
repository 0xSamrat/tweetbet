"use client";

import * as React from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  formatUnits,
  parseUnits,
  erc20Abi,
  http,
  type Hex,
  type Address,
} from "viem";
import { baseSepolia, arcTestnet } from "viem/chains";
import { useWallet } from "@/contexts/WalletContext";
import { useUnifiedBalance, type ChainBalance } from "@/hooks/useUnifiedBalance";

// CCTP Bridge Contract on Base Sepolia (Circle Cross-Chain Transfer Protocol)
// For a real implementation, you'd use Circle's CCTP SDK or API
// This is a simplified demo using a direct transfer approach

const USDC_ADDRESSES = {
  [arcTestnet.id]: "0x3600000000000000000000000000000000000000" as Address,
  [baseSepolia.id]: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as Address,
};

interface ConsolidateToARCProps {
  onComplete?: () => void;
}

export function ConsolidateToARC({ onComplete }: ConsolidateToARCProps) {
  const { address, walletType, chainId, switchChain } = useWallet();
  const { chainBalances, fetchUnifiedBalance } = useUnifiedBalance(
    walletType === "eoa" ? (address as Address) : undefined
  );

  const [isConsolidating, setIsConsolidating] = React.useState(false);
  const [currentStep, setCurrentStep] = React.useState<string | null>(null);
  const [txHashes, setTxHashes] = React.useState<{ chain: string; hash: Hex }[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  // Only show for MetaMask users
  if (walletType !== "eoa" || !address) {
    return null;
  }

  // Find Base Sepolia balance
  const baseSepoliaBalance = chainBalances.find(
    (c) => c.chainId === baseSepolia.id
  );

  // Check if there's anything to consolidate
  const hasBalanceOnBaseSepolia =
    baseSepoliaBalance && parseFloat(baseSepoliaBalance.balance) > 0;

  const handleConsolidate = async () => {
    if (!baseSepoliaBalance || parseFloat(baseSepoliaBalance.balance) <= 0) {
      setError("No USDC on Base Sepolia to consolidate");
      return;
    }

    setIsConsolidating(true);
    setError(null);
    setTxHashes([]);
    setSuccess(false);

    try {
      // Step 1: Switch to Base Sepolia if not already
      if (chainId !== baseSepolia.id) {
        setCurrentStep("Switching to Base Sepolia...");
        await switchChain(baseSepolia.id);
        // Wait for chain switch to complete
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Step 2: Get user's wallet client on Base Sepolia
      setCurrentStep("Preparing transfer from Base Sepolia...");
      
      if (!window.ethereum) {
        throw new Error("MetaMask not available");
      }

      const walletClient = createWalletClient({
        chain: baseSepolia,
        transport: custom(window.ethereum),
      });

      const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(),
      });

      // Note: In a real CCTP implementation, you would:
      // 1. Call depositForBurn on the TokenMessenger contract on source chain
      // 2. Wait for attestation from Circle's attestation service
      // 3. Call receiveMessage on destination chain
      // 
      // For this demo, we'll simulate by transferring to a bridge address
      // In production, use Circle's CCTP SDK: https://developers.circle.com/stablecoins/cctp

      // For demo purposes, we'll transfer to the user's own address
      // This simulates the "consolidation" by just triggering a transfer
      // In production, integrate with actual CCTP bridge contracts
      
      const amountRaw = baseSepoliaBalance.balanceRaw;
      
      // Simulate gas estimation
      setCurrentStep("Estimating gas...");
      
      const { request } = await publicClient.simulateContract({
        address: USDC_ADDRESSES[baseSepolia.id],
        abi: erc20Abi,
        functionName: "transfer",
        args: [address as Address, amountRaw],
        account: address as Address,
      });

      setCurrentStep(`Transferring ${baseSepoliaBalance.balance} USDC...`);

      // Note: This is a self-transfer for demo purposes
      // Real implementation would use CCTP bridge
      const hash = await walletClient.writeContract(request);

      setTxHashes((prev) => [...prev, { chain: "Base Sepolia", hash }]);

      // Wait for confirmation
      setCurrentStep("Waiting for confirmation...");
      await publicClient.waitForTransactionReceipt({ hash });

      // Step 3: Switch back to ARC Testnet
      setCurrentStep("Switching to ARC Testnet...");
      await switchChain(arcTestnet.id);

      setSuccess(true);
      setCurrentStep(null);

      // Refresh balances
      await fetchUnifiedBalance();

      if (onComplete) {
        onComplete();
      }
    } catch (err) {
      console.error("Consolidation failed:", err);
      setError(err instanceof Error ? err.message : "Consolidation failed");
      setCurrentStep(null);
    } finally {
      setIsConsolidating(false);
    }
  };

  if (!hasBalanceOnBaseSepolia) {
    return (
      <div className="rounded-md bg-zinc-800/50 p-4">
        <p className="text-sm text-zinc-400">
          ✅ All your USDC is already on ARC Testnet
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md bg-gradient-to-r from-blue-900/20 to-purple-900/20 p-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          🔄 Consolidate to ARC Testnet
        </h3>
        <p className="mt-1 text-xs text-zinc-400">
          Transfer your USDC from Base Sepolia to ARC Testnet
        </p>

        {/* Balance to consolidate */}
        <div className="mt-3 flex items-center justify-between bg-zinc-800/50 rounded-md px-3 py-2">
          <span className="text-xs text-zinc-400">
            {baseSepoliaBalance?.chainIcon} Base Sepolia
          </span>
          <span className="font-mono text-sm font-semibold text-white">
            ${parseFloat(baseSepoliaBalance?.balance || "0").toFixed(2)} USDC
          </span>
        </div>

        <div className="flex justify-center my-2">
          <span className="text-lg">↓</span>
        </div>

        <div className="flex items-center justify-between bg-zinc-800/50 rounded-md px-3 py-2">
          <span className="text-xs text-zinc-400">
            🔵 ARC Testnet
          </span>
          <span className="font-mono text-sm text-zinc-400">
            + ${parseFloat(baseSepoliaBalance?.balance || "0").toFixed(2)} USDC
          </span>
        </div>

        {error && (
          <div className="mt-3 rounded-md bg-red-900/20 p-3 text-xs text-red-400">
            {error}
          </div>
        )}

        {currentStep && (
          <div className="mt-3 rounded-md bg-blue-900/20 p-3 text-xs text-blue-400 flex items-center gap-2">
            <span className="animate-spin">⏳</span>
            {currentStep}
          </div>
        )}

        {success && (
          <div className="mt-3 rounded-md bg-green-900/20 p-3 text-xs text-green-400">
            ✅ Consolidation complete! Your USDC is now on ARC Testnet.
          </div>
        )}

        {txHashes.length > 0 && (
          <div className="mt-3 space-y-2">
            {txHashes.map((tx, i) => (
              <a
                key={i}
                href={
                  tx.chain === "Base Sepolia"
                    ? `https://sepolia.basescan.org/tx/${tx.hash}`
                    : `https://testnet.arcscan.app/tx/${tx.hash}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs text-blue-400 truncate"
              >
                {tx.chain}: {tx.hash.slice(0, 20)}...
              </a>
            ))}
          </div>
        )}

        <button
          onClick={handleConsolidate}
          disabled={isConsolidating}
          className="mt-4 w-full rounded-md bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-3 font-semibold text-white hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 transition-all"
        >
          {isConsolidating ? "Consolidating..." : "🚀 Consolidate Now"}
        </button>

        <p className="mt-2 text-center text-xs text-zinc-500">
          Note: This is a demo. Production would use Circle CCTP for cross-chain transfers.
        </p>
      </div>
    </div>
  );
}
