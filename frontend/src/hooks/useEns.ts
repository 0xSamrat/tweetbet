"use client";

import { useState, useEffect } from "react";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

// ENS lives on Ethereum mainnet - use a reliable RPC
const ENS_RPC_URL = process.env.NEXT_PUBLIC_ENS_RPC_URL || "https://eth.llamarpc.com";

const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: http(ENS_RPC_URL),
});

// Cache for ENS lookups to avoid repeated RPC calls
const ensNameCache = new Map<string, string | null>();
const ensAddressCache = new Map<string, string | null>();
const ensAvatarCache = new Map<string, string | null>();

/**
 * Hook to resolve an Ethereum address to its ENS name
 * Uses reverse resolution (address → name)
 *
 * @param address - Ethereum address (0x...)
 * @returns { ensName, isLoading, error }
 */
export function useEnsName(address: string | undefined) {
  const [ensName, setEnsName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setEnsName(null);
      return;
    }

    const normalizedAddress = address.toLowerCase();

    // Check cache first
    if (ensNameCache.has(normalizedAddress)) {
      setEnsName(ensNameCache.get(normalizedAddress) || null);
      return;
    }

    const fetchEnsName = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const name = await mainnetClient.getEnsName({
          address: address as `0x${string}`,
        });

        ensNameCache.set(normalizedAddress, name);
        setEnsName(name);
      } catch (err) {
        console.error("ENS name lookup failed:", err);
        setError(err instanceof Error ? err.message : "ENS lookup failed");
        ensNameCache.set(normalizedAddress, null);
        setEnsName(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEnsName();
  }, [address]);

  return { ensName, isLoading, error };
}

/**
 * Hook to resolve an ENS name to its Ethereum address
 * Uses forward resolution (name → address)
 *
 * @param ensName - ENS name (e.g., "vitalik.eth")
 * @returns { address, isLoading, error }
 */
export function useEnsAddress(ensName: string | undefined) {
  const [address, setAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ensName || !ensName.includes(".")) {
      setAddress(null);
      return;
    }

    const normalizedName = ensName.toLowerCase();

    // Check cache first
    if (ensAddressCache.has(normalizedName)) {
      setAddress(ensAddressCache.get(normalizedName) || null);
      return;
    }

    const fetchAddress = async () => {
      setIsLoading(true);
      setError(null);

      try {
        console.log("[ENS] Resolving ENS name:", ensName);
        const resolvedAddress = await mainnetClient.getEnsAddress({
          name: ensName,
        });
        console.log("[ENS] Resolved address:", resolvedAddress);

        ensAddressCache.set(normalizedName, resolvedAddress);
        setAddress(resolvedAddress);
      } catch (err) {
        console.error("[ENS] Address lookup failed:", err);
        setError(err instanceof Error ? err.message : "ENS lookup failed");
        ensAddressCache.set(normalizedName, null);
        setAddress(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAddress();
  }, [ensName]);

  return { address, isLoading, error };
}

/**
 * Hook to fetch the avatar for an ENS name
 *
 * @param ensName - ENS name (e.g., "vitalik.eth")
 * @returns { avatar, isLoading, error }
 */
export function useEnsAvatar(ensName: string | null | undefined) {
  const [avatar, setAvatar] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ensName) {
      setAvatar(null);
      return;
    }

    const normalizedName = ensName.toLowerCase();

    // Check cache first
    if (ensAvatarCache.has(normalizedName)) {
      setAvatar(ensAvatarCache.get(normalizedName) || null);
      return;
    }

    const fetchAvatar = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const avatarUrl = await mainnetClient.getEnsAvatar({
          name: ensName,
        });

        ensAvatarCache.set(normalizedName, avatarUrl);
        setAvatar(avatarUrl);
      } catch (err) {
        console.error("ENS avatar lookup failed:", err);
        setError(err instanceof Error ? err.message : "Avatar lookup failed");
        ensAvatarCache.set(normalizedName, null);
        setAvatar(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAvatar();
  }, [ensName]);

  return { avatar, isLoading, error };
}

/**
 * Hook to get all ENS data for an address (name + avatar)
 * Convenience hook that combines useEnsName and useEnsAvatar
 *
 * @param address - Ethereum address
 * @returns { ensName, avatar, isLoading, error }
 */
export function useEnsProfile(address: string | undefined) {
  const { ensName, isLoading: nameLoading, error: nameError } = useEnsName(address);
  const { avatar, isLoading: avatarLoading, error: avatarError } = useEnsAvatar(ensName);

  return {
    ensName,
    avatar,
    isLoading: nameLoading || avatarLoading,
    error: nameError || avatarError,
  };
}

/**
 * Utility function to resolve ENS name to address (non-hook, for one-time lookups)
 *
 * @param ensName - ENS name (e.g., "vitalik.eth")
 * @returns Promise<string | null> - Resolved address or null
 */
export async function resolveEnsName(ensName: string): Promise<string | null> {
  const normalizedName = ensName.toLowerCase();

  // Check cache first
  if (ensAddressCache.has(normalizedName)) {
    return ensAddressCache.get(normalizedName) || null;
  }

  try {
    console.log("[ENS] resolveEnsName called with:", ensName);
    const address = await mainnetClient.getEnsAddress({
      name: ensName,
    });
    console.log("[ENS] resolveEnsName result:", address);

    ensAddressCache.set(normalizedName, address);
    return address;
  } catch (err) {
    console.error("[ENS] resolution failed:", err);
    return null;
  }
}

/**
 * Utility function to get ENS name from address (non-hook, for one-time lookups)
 *
 * @param address - Ethereum address
 * @returns Promise<string | null> - ENS name or null
 */
export async function lookupEnsName(address: string): Promise<string | null> {
  const normalizedAddress = address.toLowerCase();

  // Check cache first
  if (ensNameCache.has(normalizedAddress)) {
    return ensNameCache.get(normalizedAddress) || null;
  }

  try {
    const name = await mainnetClient.getEnsName({
      address: address as `0x${string}`,
    });

    ensNameCache.set(normalizedAddress, name);
    return name;
  } catch (err) {
    console.error("ENS lookup failed:", err);
    return null;
  }
}
