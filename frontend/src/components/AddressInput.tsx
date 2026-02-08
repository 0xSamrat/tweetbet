"use client";

import * as React from "react";
import { useEnsAddress } from "@/hooks/useEns";
import { isAddress } from "viem";

interface AddressInputProps {
  value: string;
  onChange: (value: string) => void;
  onResolvedAddress?: (address: string | null) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  name?: string;
}

/**
 * Input component that accepts both ENS names and Ethereum addresses.
 * If an ENS name is entered, it automatically resolves to the address.
 * Shows resolution status and the resolved address.
 */
export function AddressInput({
  value,
  onChange,
  onResolvedAddress,
  placeholder = "Address or ENS name (e.g., vitalik.eth)",
  className = "",
  required = false,
  name,
}: AddressInputProps) {
  const [inputValue, setInputValue] = React.useState(value);
  const [debouncedValue, setDebouncedValue] = React.useState("");

  // Check if input looks like an ENS name
  const isEnsName = inputValue.includes(".") && !isAddress(inputValue);
  
  // Only query ENS if it looks like an ENS name
  const { address: resolvedAddress, isLoading, error } = useEnsAddress(
    isEnsName ? inputValue : undefined
  );

  // Debounce the ENS lookup
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(inputValue);
    }, 500);
    return () => clearTimeout(timer);
  }, [inputValue]);

  // Determine the final address to use
  const finalAddress = React.useMemo(() => {
    if (isAddress(inputValue)) {
      return inputValue;
    }
    if (isEnsName && resolvedAddress) {
      return resolvedAddress;
    }
    return null;
  }, [inputValue, isEnsName, resolvedAddress]);

  // Notify parent of resolved address changes
  React.useEffect(() => {
    onResolvedAddress?.(finalAddress);
  }, [finalAddress, onResolvedAddress]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);
  };

  // Status indicator
  const getStatusIndicator = () => {
    if (!inputValue) return null;

    if (isAddress(inputValue)) {
      return (
        <span className="text-xs text-green-400 flex items-center gap-1">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Valid address
        </span>
      );
    }

    if (isEnsName) {
      if (isLoading) {
        return (
          <span className="text-xs text-blue-400 flex items-center gap-1 animate-pulse">
            <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Resolving ENS...
          </span>
        );
      }

      if (resolvedAddress) {
        return (
          <span className="text-xs text-green-400 flex items-center gap-1">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {`${resolvedAddress.slice(0, 6)}...${resolvedAddress.slice(-4)}`}
          </span>
        );
      }

      if (error || debouncedValue === inputValue) {
        return (
          <span className="text-xs text-red-400 flex items-center gap-1">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            ENS not found
          </span>
        );
      }
    }

    return null;
  };

  return (
    <div className="space-y-1">
      <input
        name={name}
        value={inputValue}
        onChange={handleChange}
        placeholder={placeholder}
        required={required}
        className={`w-full rounded-lg border border-zinc-700 px-4 py-3 font-mono text-sm text-white placeholder-zinc-400 focus:border-blue-500 focus:outline-none bg-zinc-800 ${className}`}
      />
      <div className="min-h-[20px] px-1">
        {getStatusIndicator()}
      </div>
      
      {/* Hidden input with the resolved address for form submission */}
      {name && finalAddress && finalAddress !== inputValue && (
        <input type="hidden" name={`${name}_resolved`} value={finalAddress} />
      )}
    </div>
  );
}

/**
 * Hook to use AddressInput logic without the component
 * Useful when you need to resolve ENS in custom components
 */
export function useAddressResolver(input: string) {
  const isEnsName = input.includes(".") && !isAddress(input);
  const { address: resolvedAddress, isLoading, error } = useEnsAddress(
    isEnsName ? input : undefined
  );

  const finalAddress = React.useMemo(() => {
    if (isAddress(input)) {
      return input as `0x${string}`;
    }
    if (isEnsName && resolvedAddress) {
      return resolvedAddress as `0x${string}`;
    }
    return null;
  }, [input, isEnsName, resolvedAddress]);

  return {
    resolvedAddress: finalAddress,
    isEnsName,
    isResolving: isLoading,
    error,
    isValid: !!finalAddress,
  };
}
