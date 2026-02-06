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
    <div className="w-full max-w-md space-y-6 rounded-2xl bg-white p-8 shadow-xl dark:bg-zinc-900">
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Passkey Options */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            PASSKEY (GASLESS)
          </span>
          <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
        </div>

        {/* Username input for registration */}
        {showUsernameInput ? (
          <div className="space-y-3">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              autoFocus
              className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
            <div className="flex gap-3">
              <button
                onClick={handleCancelUsername}
                disabled={isLoading}
                className="flex-1 rounded-lg border border-zinc-300 px-4 py-3 font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                onClick={handlePasskeyRegister}
                disabled={isLoading || !username.trim()}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={handlePasskeyLogin}
              disabled={isLoading}
              className="flex-1 rounded-lg border border-blue-600 px-4 py-3 font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-500 dark:text-blue-400 dark:hover:bg-blue-900/20"
            >
              {isLoading ? "Loading..." : "🔑 Login"}
            </button>
            <button
              onClick={() => setShowUsernameInput(true)}
              disabled={isLoading}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              ✨ Sign Up
            </button>
          </div>
        )}

        <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
          No gas fees • Secured by your device
        </p>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-4">
        <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
        <span className="text-sm text-zinc-500 dark:text-zinc-400">or</span>
        <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
      </div>

      {/* MetaMask Option */}
      <div className="space-y-3">
        <button
          onClick={handleMetaMaskConnect}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 rounded-lg border border-zinc-300 px-4 py-3 font-semibold text-zinc-900 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-white dark:hover:bg-zinc-800 transition-colors"
        >
          <Image
            src="/metamask-icon.png"
            alt="MetaMask"
            width={24}
            height={24}
          />
          {isLoading ? "Connecting..." : "Connect MetaMask"}
        </button>
        <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
          Requires gas • Use your existing wallet
        </p>
      </div>
    </div>
  );
}
