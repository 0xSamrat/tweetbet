"use client";

import * as React from "react";
import { type Hex, type Address, isAddress } from "viem";
import { useWallet } from "@/contexts/WalletContext";
import { useAddressResolver } from "@/components/AddressInput";
import { resolveEnsName } from "@/hooks/useEns";

export function SendUSDC() {
  const { sendUSDC, isLoading, isReady, walletType } = useWallet();
  const [userOpHash, setUserOpHash] = React.useState<Hex>();
  const [txHash, setTxHash] = React.useState<Hex>();
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [recipient, setRecipient] = React.useState("");

  // Use the address resolver hook for real-time ENS resolution
  const { resolvedAddress, isResolving, isEnsName, isValid } = useAddressResolver(recipient);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setUserOpHash(undefined);
    setTxHash(undefined);
    setLocalError(null);

    const formData = new FormData(event.currentTarget);
    const value = formData.get("value") as string;

    // Debug logging
    console.log("[SendUSDC] Submitting with recipient:", recipient);
    console.log("[SendUSDC] isAddress(recipient):", isAddress(recipient));
    console.log("[SendUSDC] resolvedAddress from hook:", resolvedAddress);
    console.log("[SendUSDC] isEnsName:", isEnsName);
    console.log("[SendUSDC] isValid:", isValid);

    // Use the already-resolved address from the hook, or the direct address if it's valid
    let finalAddress: Address;

    if (isAddress(recipient)) {
      // Direct address input
      console.log("[SendUSDC] Using direct address");
      finalAddress = recipient as Address;
    } else if (resolvedAddress) {
      // ENS was resolved by the hook
      console.log("[SendUSDC] Using resolved ENS address:", resolvedAddress);
      finalAddress = resolvedAddress as Address;
    } else if (recipient.includes(".")) {
      // ENS name but not yet resolved - try resolving now
      console.log("[SendUSDC] ENS not resolved by hook, resolving now...");
      try {
        const resolved = await resolveEnsName(recipient);
        console.log("[SendUSDC] resolveEnsName result:", resolved);
        if (!resolved) {
          setLocalError(`Could not resolve ENS name: ${recipient}`);
          return;
        }
        finalAddress = resolved as Address;
      } catch (err) {
        console.error("[SendUSDC] ENS resolution error:", err);
        setLocalError(`ENS resolution failed: ${err instanceof Error ? err.message : "Unknown error"}`);
        return;
      }
    } else {
      setLocalError("Invalid address format. Enter a valid 0x address or ENS name.");
      return;
    }

    console.log("[SendUSDC] Final address for transaction:", finalAddress);

    try {
      const result = await sendUSDC(finalAddress, value);
      if (result.userOpHash) {
        setUserOpHash(result.userOpHash);
      }
      setTxHash(result.txHash);
      setRecipient("");
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Transaction failed");
    }
  };

  if (!isReady) return null;

  const isGasless = walletType === "passkey";
  const buttonLabel = isGasless ? "💸 Send USDC (Gasless)" : "💸 Send USDC";
  const titleLabel = isGasless ? "Send USDC (Gasless)" : "Send USDC";

  // Status indicator for ENS resolution
  const getRecipientStatus = () => {
    if (!recipient) return null;

    if (isAddress(recipient)) {
      return (
        <span className="text-xs text-green-400 flex items-center gap-1 mt-1">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Valid address
        </span>
      );
    }

    if (isEnsName) {
      if (isResolving) {
        return (
          <span className="text-xs text-blue-400 flex items-center gap-1 mt-1 animate-pulse">
            <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Resolving ENS...
          </span>
        );
      }

      if (resolvedAddress) {
        return (
          <span className="text-xs text-green-400 flex items-center gap-1 mt-1">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            → {`${resolvedAddress.slice(0, 6)}...${resolvedAddress.slice(-4)}`}
          </span>
        );
      }

      return (
        <span className="text-xs text-red-400 flex items-center gap-1 mt-1">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          ENS not found
        </span>
      );
    }

    return null;
  };

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

        <div>
          <input
            name="to"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="Address or ENS name (e.g., vitalik.eth)"
            required
            className="w-full rounded-lg border border-zinc-700 px-4 py-3 font-mono text-sm text-white placeholder-zinc-400 focus:border-blue-500 focus:outline-none bg-zinc-800"
          />
          {getRecipientStatus()}
        </div>

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
          disabled={isLoading || (isEnsName && !isValid)}
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
