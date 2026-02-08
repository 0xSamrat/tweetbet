"use client";

import * as React from "react";
import Image from "next/image";
import { useWallet } from "@/contexts/WalletContext";

interface WalletConnectProps {
  onSuccess?: () => void;
}

export function WalletConnect({ onSuccess }: WalletConnectProps) {
  const { registerPasskey, loginPasskey, connectMetaMask, isLoading, error } =
    useWallet();
  const [showUsernameInput, setShowUsernameInput] = React.useState(false);
  const [username, setUsername] = React.useState("");

  const handlePasskeyRegister = async () => {
    if (!username.trim()) {
      return;
    }
    try {
      await registerPasskey(username);
      onSuccess?.();
    } catch {
      // Error is already set in the hook
    }
  };

  const handlePasskeyLogin = async () => {
    try {
      await loginPasskey();
      onSuccess?.();
    } catch {
      // Error is already set in the hook
    }
  };

  const handleMetaMaskConnect = async () => {
    try {
      await connectMetaMask();
      onSuccess?.();
    } catch {
      // Error is already set in the hook
    }
  };

  const handleCancelUsername = () => {
    setShowUsernameInput(false);
    setUsername("");
  };

  // Sign-in options
  return (
    <div className="w-full max-w-md overflow-hidden rounded-3xl bg-gradient-to-b from-zinc-900 to-zinc-950 shadow-2xl">
      {/* Header with gradient */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 px-8 py-6 text-center">
        <h2 className="text-xl font-bold text-white">Connect Wallet</h2>
        <p className="mt-1 text-sm text-white/80">Choose your preferred method</p>
      </div>

      <div className="p-6 space-y-5">
        {error && (
          <div className="rounded-md bg-red-900/20 p-4 text-sm text-red-400 border border-red-800/30">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          </div>
        )}

        {/* Passkey Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-white">Passkey</h3>
              <p className="text-xs text-zinc-400">Gasless • Secured by device</p>
            </div>
            <span className="ml-auto rounded-full bg-green-900/30 px-2 py-0.5 text-[10px] font-semibold text-green-400">
              RECOMMENDED
            </span>
          </div>

          {/* Username input for registration */}
          {showUsernameInput ? (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="relative">
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Choose a username"
                  autoFocus
                  className="w-full rounded-md border-2 border-zinc-700 bg-zinc-800 px-4 py-3.5 text-white placeholder-zinc-400 transition-all focus:border-purple-400 focus:outline-none focus:ring-4 focus:ring-purple-500/10"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleCancelUsername}
                  disabled={isLoading}
                  className="flex-1 rounded-md border-2 border-zinc-700 px-4 py-3 font-semibold text-zinc-300 transition-all hover:bg-zinc-800 hover:border-zinc-600 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePasskeyRegister}
                  disabled={isLoading || !username.trim()}
                  className="flex-1 rounded-md bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-3 font-semibold text-white shadow-lg shadow-purple-500/25 transition-all hover:shadow-xl hover:shadow-purple-500/30 disabled:opacity-50 disabled:shadow-none"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Creating...
                    </span>
                  ) : "Create Account"}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handlePasskeyLogin}
                disabled={isLoading}
                className="group relative overflow-hidden rounded-md border-2 border-zinc-700 px-4 py-3.5 font-semibold text-zinc-200 transition-all hover:border-blue-600 hover:bg-blue-900/20 disabled:opacity-50"
              >
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  {isLoading ? "..." : "Login"}
                </span>
              </button>
              <button
                onClick={() => setShowUsernameInput(true)}
                disabled={isLoading}
                className="rounded-md bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-3.5 font-semibold text-white shadow-lg shadow-purple-500/25 transition-all hover:shadow-xl hover:shadow-purple-500/30 disabled:opacity-50"
              >
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  Sign Up
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4 py-1">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
          <span className="text-xs font-medium text-zinc-500">OR</span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
        </div>

        {/* MetaMask Section */}
        <div className="space-y-3">
          <button
            onClick={handleMetaMaskConnect}
            disabled={isLoading}
            className="group w-full flex items-center gap-4 rounded-md border-2 border-zinc-700 bg-zinc-800 px-4 py-4 transition-all hover:border-orange-600 hover:bg-orange-900/10 disabled:opacity-50"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gradient-to-br from-orange-400 to-orange-600 p-2 shadow-lg">
              <Image
                src="/metamask-icon.png"
                alt="MetaMask"
                width={24}
                height={24}
                className="drop-shadow-sm"
              />
            </div>
            <div className="text-left">
              <p className="font-semibold text-white">MetaMask</p>
              <p className="text-xs text-zinc-400">Connect existing wallet</p>
            </div>
            <svg className="ml-auto h-5 w-5 text-zinc-500 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <p className="text-center text-[11px] text-zinc-500">
            Requires gas fees for transactions
          </p>
        </div>
      </div>
    </div>
  );
}
