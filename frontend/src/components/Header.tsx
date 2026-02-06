"use client";

import { useState } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { WalletConnect } from "@/components/WalletConnect";
import { WalletInfo } from "@/components/WalletInfo";
import { SendUSDC } from "@/components/SendUSDC";

export function Header() {
  const { isConnected, walletType, address, logout } = useWallet();
  const [showModal, setShowModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const handleSignInClick = () => {
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  const handleDisconnect = () => {
    logout();
    setShowDropdown(false);
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 border-b border-zinc-200 bg-white/80 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              TweetBet
            </span>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-4">
            {isConnected && address ? (
              <div className="relative">
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center gap-2 rounded-full bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                >
                  <span className="text-base">
                    {walletType === "passkey" ? "🔐" : "🦊"}
                  </span>
                  <span>{formatAddress(address)}</span>
                  <svg
                    className={`h-4 w-4 transition-transform ${showDropdown ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Wallet Panel Dropdown */}
                {showDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-50"
                      onClick={() => setShowDropdown(false)}
                    />
                    <div className="absolute right-0 top-full z-[60] mt-2 w-80 sm:w-96 rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
                      {/* Header */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">
                            {walletType === "passkey" ? "🔐" : "🦊"}
                          </span>
                          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                            {walletType === "passkey" ? "Passkey Wallet" : "MetaMask"}
                          </span>
                        </div>
                        <button
                          onClick={() => setShowDropdown(false)}
                          className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      
                      {/* Wallet Info */}
                      <div className="space-y-4">
                        <WalletInfo />
                        
                        {/* Divider */}
                        <div className="h-px bg-zinc-200 dark:bg-zinc-700" />
                        
                        {/* Send USDC */}
                        <SendUSDC />
                        
                        {/* Divider */}
                        <div className="h-px bg-zinc-200 dark:bg-zinc-700" />
                        
                        {/* Disconnect Button */}
                        <button
                          onClick={handleDisconnect}
                          className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          Disconnect Wallet
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button
                onClick={handleSignInClick}
                className="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-2 text-sm font-semibold text-white shadow-lg transition hover:shadow-xl hover:opacity-90"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleCloseModal}
          />
          
          {/* Modal content */}
          <div className="relative z-10 w-full max-w-md mx-4">
            {/* Close button */}
            <button
              onClick={handleCloseModal}
              className="absolute -top-12 right-0 text-white/80 hover:text-white transition"
            >
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <WalletConnect onSuccess={handleCloseModal} />
          </div>
        </div>
      )}
    </>
  );
}
