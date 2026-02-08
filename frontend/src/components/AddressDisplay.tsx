"use client";

import { useState } from "react";
import { useEnsName } from "@/hooks/useEns";

interface AddressDisplayProps {
  address: string;
  truncate?: boolean;
  showCopyButton?: boolean;
  className?: string;
  textClassName?: string;
}

/**
 * Component that displays an address with ENS name resolution.
 * Shows ENS name if available, otherwise shows the address.
 * Copy button always copies the real 20-byte address.
 */
export function AddressDisplay({
  address,
  truncate = true,
  showCopyButton = true,
  className = "",
  textClassName = "",
}: AddressDisplayProps) {
  const { ensName, isLoading } = useEnsName(address);
  const [copied, setCopied] = useState(false);

  const truncatedAddress = truncate
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : address;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      // Always copy the real address, not the ENS name
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const displayText = isLoading
    ? truncatedAddress
    : ensName || truncatedAddress;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span
        className={`font-mono text-sm ${textClassName}`}
        title={address}
      >
        {isLoading ? (
          <span className="animate-pulse">{truncatedAddress}</span>
        ) : (
          <>
            {ensName ? (
              <span className="font-semibold text-blue-400">{ensName}</span>
            ) : (
              truncatedAddress
            )}
          </>
        )}
      </span>

      {showCopyButton && (
        <button
          onClick={handleCopy}
          className="p-1 rounded hover:bg-zinc-700 transition-colors"
          title={copied ? "Copied!" : `Copy address: ${address}`}
        >
          {copied ? (
            <svg
              className="h-4 w-4 text-green-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          ) : (
            <svg
              className="h-4 w-4 text-zinc-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}
