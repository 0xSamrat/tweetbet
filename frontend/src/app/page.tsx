"use client";

import { useWallet } from "@/contexts/WalletContext";
import { Header } from "@/components/Header";

export default function Home() {
  const { isConnected, isReady } = useWallet();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <Header />
      
      {/* Main content with padding for fixed header */}
      <main className="pt-16">
        {/* Not logged in - show welcome */}
        {!isConnected && (
          <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center p-4">
            <div className="text-center space-y-6">
              <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                TweetBet
              </h1>
              <p className="text-xl text-zinc-600 dark:text-zinc-400 max-w-md">
                Predict outcomes from tweets with gasless transactions
              </p>
              <div className="flex items-center justify-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
                <span className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> No gas fees
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> Passkey secured
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> MetaMask support
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Loading account */}
        {isConnected && !isReady && (
          <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
            <div className="text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
              <p className="mt-4 text-zinc-600 dark:text-zinc-400">
                Loading account...
              </p>
            </div>
          </div>
        )}

        {/* Logged in - show main content */}
        {isConnected && isReady && (
          <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center p-4">
            <div className="text-center space-y-6">
              <h1 className="text-4xl font-bold text-zinc-900 dark:text-white">
                Welcome to TweetBet
              </h1>
              <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-md">
                Click on your wallet address in the header to view balance and send USDC
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
