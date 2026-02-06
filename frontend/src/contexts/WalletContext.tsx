"use client";

import * as React from "react";
import { useWalletCore, type UseWalletReturn } from "@/hooks/useWallet";

const WalletContext = React.createContext<UseWalletReturn | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const wallet = useWalletCore();

  return (
    <WalletContext.Provider value={wallet}>{children}</WalletContext.Provider>
  );
}

export function useWallet(): UseWalletReturn {
  const context = React.useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}
