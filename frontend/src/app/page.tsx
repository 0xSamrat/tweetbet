"use client";

import { useWallet } from "@/contexts/WalletContext";
import { WalletConnect } from "@/components/WalletConnect";
import { WalletInfo } from "@/components/WalletInfo";
import { SendUSDC } from "@/components/SendUSDC";

export default function Home() {
  const { isConnected, isReady } = useWallet();

  // Not logged in - show register/login
  if (!isConnected) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-black">
        <WalletConnect />
      </div>
    );
  }

  // Loading account
  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="mt-4 text-zinc-600 dark:text-zinc-400">
            Loading account...
          </p>
        </div>
      </div>
    );
  }

  // Logged in - show dashboard
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-black">
      <div className="w-full max-w-md space-y-6 rounded-2xl bg-white p-8 shadow-xl dark:bg-zinc-900">
        <WalletInfo />
        <SendUSDC />
      </div>
    </div>
  );
}
