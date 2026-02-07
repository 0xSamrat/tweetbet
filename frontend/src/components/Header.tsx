"use client";

import { useState } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { WalletConnect } from "@/components/WalletConnect";
import { WalletInfo } from "@/components/WalletInfo";
import { SendUSDC } from "@/components/SendUSDC";
import { GatewayDeposit } from "@/components/GatewayDeposit";
import { GatewayTransfer } from "@/components/GatewayTransfer";
import { CreateMarketModal } from "@/components/CreateMarketModal";
import { arcTestnet, baseSepolia } from "viem/chains";
import type { SupportedChainId } from "@/hooks/useWallet";
import type { Address } from "viem";

export function Header() {
  const { isConnected, walletType, address, chainId, chainName, switchChain, isLoading, logout } = useWallet();
  const [showModal, setShowModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showChainDropdown, setShowChainDropdown] = useState(false);
  const [showCreateMarket, setShowCreateMarket] = useState(false);
  const [activeTab, setActiveTab] = useState<"send" | "deposit" | "transfer">("send");

  // Chain options for MetaMask
  const chainOptions = [
    { id: arcTestnet.id as SupportedChainId, name: "ARC Testnet", icon: "🔵" },
    { id: baseSepolia.id as SupportedChainId, name: "Base Sepolia", icon: "🔷" },
  ];

  const handleSwitchChain = async (targetChainId: SupportedChainId) => {
    await switchChain(targetChainId);
    setShowChainDropdown(false);
  };

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
            {/* Create Market Button - Only show when connected */}
            {isConnected && address && (
              <button
                onClick={() => setShowCreateMarket(true)}
                className="flex items-center justify-center h-10 w-10 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-xl hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl hover:scale-105"
                title="Create Market"
              >
                +
              </button>
            )}

            {isConnected && address ? (
              <div className="relative">
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center gap-2 rounded-full bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                >
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
                    <div className="absolute right-0 top-full z-[60] mt-2 w-80 sm:w-96 max-h-[80vh] overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
                      {/* Header with Network Switcher */}
                      <div className="flex items-center justify-between mb-4">
                        {/* Network Switcher - Left Side */}
                        <div className="relative">
                          {walletType === "passkey" ? (
                            // Passkey - fixed network, just show label
                            <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                              <span>🔵</span>
                              <span>ARC Testnet</span>
                            </div>
                          ) : (
                            // MetaMask - can switch networks
                            <>
                              <button
                                onClick={() => setShowChainDropdown(!showChainDropdown)}
                                disabled={isLoading}
                                className="flex items-center gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 px-2 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition disabled:opacity-50"
                              >
                                <span>{chainId === arcTestnet.id ? "🔵" : "🔷"}</span>
                                <span>{chainName || "Unknown"}</span>
                                <svg
                                  className={`h-3 w-3 transition-transform ${showChainDropdown ? "rotate-180" : ""}`}
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                              
                              {showChainDropdown && (
                                <>
                                  <div
                                    className="fixed inset-0 z-10"
                                    onClick={() => setShowChainDropdown(false)}
                                  />
                                  <div className="absolute left-0 top-full z-20 mt-1 w-36 rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
                                    {chainOptions.map((chain) => (
                                      <button
                                        key={chain.id}
                                        onClick={() => handleSwitchChain(chain.id)}
                                        disabled={chain.id === chainId || isLoading}
                                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition first:rounded-t-lg last:rounded-b-lg ${
                                          chain.id === chainId
                                            ? "bg-blue-50 text-blue-900 dark:bg-blue-900/30 dark:text-blue-300"
                                            : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
                                        } disabled:opacity-50`}
                                      >
                                        <span>{chain.icon}</span>
                                        <span>{chain.name}</span>
                                        {chain.id === chainId && (
                                          <svg className="ml-auto h-3 w-3 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                          </svg>
                                        )}
                                      </button>
                                    ))}
                                  </div>
                                </>
                              )}
                            </>
                          )}
                        </div>
                        
                        {/* Close Button - Right Side */}
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
                        
                        {/* Tabs for MetaMask users */}
                        {walletType === "eoa" && (
                          <>
                            <div className="h-px bg-zinc-200 dark:bg-zinc-700" />
                            
                            {/* Tab Navigation */}
                            <div className="flex border-b border-zinc-200 dark:border-zinc-700">
                              <button
                                onClick={() => setActiveTab("send")}
                                className={`flex-1 py-2 text-xs font-medium transition-colors ${
                                  activeTab === "send"
                                    ? "text-blue-600 border-b-2 border-blue-600"
                                    : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                                }`}
                              >
                                💸 Send
                              </button>
                              <button
                                onClick={() => setActiveTab("deposit")}
                                className={`flex-1 py-2 text-xs font-medium transition-colors ${
                                  activeTab === "deposit"
                                    ? "text-purple-600 border-b-2 border-purple-600"
                                    : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                                }`}
                              >
                                🏦 Deposit
                              </button>
                              <button
                                onClick={() => setActiveTab("transfer")}
                                className={`flex-1 py-2 text-xs font-medium transition-colors ${
                                  activeTab === "transfer"
                                    ? "text-green-600 border-b-2 border-green-600"
                                    : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                                }`}
                              >
                                ⚡ Transfer
                              </button>
                            </div>

                            {/* Tab Content */}
                            <div className="mt-4">
                              {activeTab === "send" && <SendUSDC />}
                              {activeTab === "deposit" && (
                                <GatewayDeposit address={address as Address} />
                              )}
                              {activeTab === "transfer" && (
                                <GatewayTransfer address={address as Address} />
                              )}
                            </div>
                          </>
                        )}
                        
                        {/* Passkey: Just show SendUSDC */}
                        {walletType === "passkey" && (
                          <>
                            <div className="h-px bg-zinc-200 dark:bg-zinc-700" />
                            <SendUSDC />
                          </>
                        )}
                        
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

      {/* Create Market Modal */}
      <CreateMarketModal
        isOpen={showCreateMarket}
        onClose={() => setShowCreateMarket(false)}
        onSuccess={(marketId) => {
          console.log("Market created:", marketId.toString());
        }}
      />
    </>
  );
}
