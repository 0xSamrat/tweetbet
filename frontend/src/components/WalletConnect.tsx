"use client";

import * as React from "react";
import { useWallet } from "@/contexts/WalletContext";

export function WalletConnect() {
  const { register, login, isLoading, error } = useWallet();

  const handleRegister = async () => {
    const usernameInput = (
      document.getElementById("username") as HTMLInputElement
    ).value;
    try {
      await register(usernameInput);
    } catch {
      // Error is already set in the hook
    }
  };

  const handleLogin = async () => {
    try {
      await login();
    } catch {
      // Error is already set in the hook
    }
  };

  return (
    <div className="w-full max-w-md space-y-6 rounded-2xl bg-white p-8 shadow-xl dark:bg-zinc-900">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
          🎯 TweetBet
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Gasless prediction markets powered by passkeys
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <input
          id="username"
          name="username"
          placeholder="Enter username"
          className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
        />

        <div className="flex gap-3">
          <button
            onClick={handleRegister}
            disabled={isLoading}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? "Loading..." : "Register"}
          </button>
          <button
            onClick={handleLogin}
            disabled={isLoading}
            className="flex-1 rounded-lg border border-zinc-300 px-4 py-3 font-semibold text-zinc-900 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-white dark:hover:bg-zinc-800"
          >
            {isLoading ? "Loading..." : "Login"}
          </button>
        </div>
      </div>
    </div>
  );
}
