"use client";

import * as React from "react";
import { type Hex, createPublicClient, parseUnits } from "viem";
import { polygonAmoy } from "viem/chains";
import {
  type P256Credential,
  type SmartAccount,
  type WebAuthnAccount,
  createBundlerClient,
  toWebAuthnAccount,
} from "viem/account-abstraction";
import {
  WebAuthnMode,
  toCircleSmartAccount,
  toModularTransport,
  toPasskeyTransport,
  toWebAuthnCredential,
  encodeTransfer,
  ContractAddress,
} from "@circle-fin/modular-wallets-core";

const clientKey = process.env.NEXT_PUBLIC_CIRCLE_CLIENT_KEY!;
const clientUrl = process.env.NEXT_PUBLIC_CIRCLE_CLIENT_URL!;


console.log(clientKey, "------------------------------------", clientUrl);
const USDC_DECIMALS = 6;

// Create Circle transports (outside component)
const passkeyTransport = toPasskeyTransport(clientUrl, clientKey);
const modularTransport = toModularTransport(`${clientUrl}/polygonAmoy`, clientKey);

// Create a public client
const client = createPublicClient({
  chain: polygonAmoy,
  transport: modularTransport,
});

// Create a bundler client
const bundlerClient = createBundlerClient({
  chain: polygonAmoy,
  transport: modularTransport,
});

export default function Home() {
  const [account, setAccount] = React.useState<SmartAccount>();
  const [credential, setCredential] = React.useState<P256Credential | null>(null);
  const [username, setUsername] = React.useState<string | undefined>();
  const [hash, setHash] = React.useState<Hex>();
  const [userOpHash, setUserOpHash] = React.useState<Hex>();
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Load credential from localStorage on mount
  React.useEffect(() => {
    const storedCredential = localStorage.getItem("credential");
    const storedUsername = localStorage.getItem("username");
    if (storedCredential) {
      setCredential(JSON.parse(storedCredential));
    }
    if (storedUsername) {
      setUsername(storedUsername);
    }
  }, []);

  // Create smart account when credential is available
  React.useEffect(() => {
    if (!credential) return;

    toCircleSmartAccount({
      client,
      owner: toWebAuthnAccount({ credential }) as WebAuthnAccount,
      name: username,
    }).then(setAccount);
  }, [credential, username]);

  const register = async () => {
    const usernameInput = (document.getElementById("username") as HTMLInputElement).value;
    if (!usernameInput.trim()) {
      setError("Please enter a username");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const credential = await toWebAuthnCredential({
        transport: passkeyTransport,
        mode: WebAuthnMode.Register,
        username: usernameInput,
      });
      localStorage.setItem("credential", JSON.stringify(credential));
      localStorage.setItem("username", usernameInput);
      setCredential(credential);
      setUsername(usernameInput);
    } catch (err) {
      console.error("Registration failed:", err);
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  const login = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const credential = await toWebAuthnCredential({
        transport: passkeyTransport,
        mode: WebAuthnMode.Login,
      });
      localStorage.setItem("credential", JSON.stringify(credential));
      setCredential(credential);
    } catch (err) {
      console.error("Login failed:", err);
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("credential");
    localStorage.removeItem("username");
    setCredential(null);
    setAccount(undefined);
    setUsername(undefined);
    setHash(undefined);
    setUserOpHash(undefined);
  };

  const sendUserOperation = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!account) return;

    setIsLoading(true);
    setError(null);
    setHash(undefined);
    setUserOpHash(undefined);

    try {
      const formData = new FormData(event.currentTarget);
      const to = formData.get("to") as `0x${string}`;
      const value = formData.get("value") as string;

      // Create callData for USDC transfer
      const callData = encodeTransfer(
        to,
        ContractAddress.PolygonAmoy_USDC,
        parseUnits(value, USDC_DECIMALS)
      );

      const opHash = await bundlerClient.sendUserOperation({
        account,
        calls: [callData],
        paymaster: true,
      });
      setUserOpHash(opHash);

      const { receipt } = await bundlerClient.waitForUserOperationReceipt({
        hash: opHash,
      });
      setHash(receipt.transactionHash);
    } catch (err) {
      console.error("Transaction failed:", err);
      setError(err instanceof Error ? err.message : "Transaction failed");
    } finally {
      setIsLoading(false);
    }
  };

  // Not logged in - show register/login
  if (!credential) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-black">
        <div className="w-full max-w-md space-y-6 rounded-2xl bg-white p-8 shadow-xl dark:bg-zinc-900">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">🎯 TweetBet</h1>
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
                onClick={register}
                disabled={isLoading}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? "Loading..." : "Register"}
              </button>
              <button
                onClick={login}
                disabled={isLoading}
                className="flex-1 rounded-lg border border-zinc-300 px-4 py-3 font-semibold text-zinc-900 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-white dark:hover:bg-zinc-800"
              >
                {isLoading ? "Loading..." : "Login"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loading account
  if (!account) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="mt-4 text-zinc-600 dark:text-zinc-400">Loading account...</p>
        </div>
      </div>
    );
  }

  // Logged in - show account and send form
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-black">
      <div className="w-full max-w-md space-y-6 rounded-2xl bg-white p-8 shadow-xl dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">🎯 TweetBet</h1>
          <button
            onClick={logout}
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Logout
          </button>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
          <p className="text-sm font-medium text-green-800 dark:text-green-400">✅ Connected</p>
          <p className="mt-1 break-all font-mono text-xs text-green-600 dark:text-green-500">
            {account.address}
          </p>
        </div>

        <form onSubmit={sendUserOperation} className="space-y-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            Send USDC (Gasless)
          </h2>

          <input
            name="to"
            placeholder="Recipient address (0x...)"
            required
            className="w-full rounded-lg border border-zinc-300 px-4 py-3 font-mono text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />

          <input
            name="value"
            type="number"
            step="0.01"
            min="0"
            placeholder="Amount (USDC)"
            required
            className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-green-600 px-4 py-3 font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {isLoading ? "Sending..." : "💸 Send USDC"}
          </button>
        </form>

        {userOpHash && (
          <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
            <p className="text-sm font-medium text-blue-800 dark:text-blue-400">
              User Op Hash:
            </p>
            <p className="mt-1 break-all font-mono text-xs text-blue-600 dark:text-blue-500">
              {userOpHash}
            </p>
          </div>
        )}

        {hash && (
          <div className="rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
            <p className="text-sm font-medium text-green-800 dark:text-green-400">
              ✅ Transaction Confirmed!
            </p>
            <a
              href={`https://amoy.polygonscan.com/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block break-all font-mono text-xs text-green-600 underline hover:text-green-800 dark:text-green-500"
            >
              View on PolygonScan →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
