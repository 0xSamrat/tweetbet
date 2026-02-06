"use client";

import * as React from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  parseUnits,
  erc20Abi,
  type Hex,
  type Address,
} from "viem";
import { arcTestnet, baseSepolia } from "viem/chains";
import {
  GATEWAY_WALLET_ADDRESS,
  USDC_ADDRESSES,
  gatewayWalletAbi,
  REQUIRED_CONFIRMATIONS,
} from "@/config/gateway";

type SupportedChain = "arcTestnet" | "baseSepolia";

interface DepositResult {
  approvalTxHash: Hex | null;
  depositTxHash: Hex;
  amount: string;
  chain: SupportedChain;
}

interface UseGatewayDepositReturn {
  deposit: (chain: SupportedChain, amount: string) => Promise<DepositResult>;
  isApproving: boolean;
  isDepositing: boolean;
  isWaitingConfirmation: boolean;
  error: string | null;
  lastDeposit: DepositResult | null;
}

const chains = {
  arcTestnet,
  baseSepolia,
};

export function useGatewayDeposit(): UseGatewayDepositReturn {
  const [isApproving, setIsApproving] = React.useState(false);
  const [isDepositing, setIsDepositing] = React.useState(false);
  const [isWaitingConfirmation, setIsWaitingConfirmation] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastDeposit, setLastDeposit] = React.useState<DepositResult | null>(null);

  const deposit = React.useCallback(
    async (chain: SupportedChain, amount: string): Promise<DepositResult> => {
      setError(null);
      setLastDeposit(null);
      
      if (typeof window === "undefined" || !window.ethereum) {
        throw new Error("MetaMask not found");
      }

      const selectedChain = chains[chain];
      const usdcAddress = USDC_ADDRESSES[chain] as Address;
      const depositAmount = parseUnits(amount, 6); // USDC has 6 decimals

      try {
        // Create clients
        const publicClient = createPublicClient({
          chain: selectedChain,
          transport: http(),
        });

        const walletClient = createWalletClient({
          chain: selectedChain,
          transport: custom(window.ethereum),
        });

        // Get connected account
        const [account] = await walletClient.getAddresses();
        if (!account) {
          throw new Error("No account connected");
        }

        // Check current chain and switch if needed
        const currentChainId = await walletClient.getChainId();
        if (currentChainId !== selectedChain.id) {
          await walletClient.switchChain({ id: selectedChain.id });
        }

        // Step 1: Check current allowance
        const currentAllowance = await publicClient.readContract({
          address: usdcAddress,
          abi: erc20Abi,
          functionName: "allowance",
          args: [account, GATEWAY_WALLET_ADDRESS],
        });

        let approvalTxHash: Hex | null = null;

        // Step 2: Approve if needed
        if (currentAllowance < depositAmount) {
          setIsApproving(true);
          console.log(`Approving ${amount} USDC for Gateway Wallet...`);

          approvalTxHash = await walletClient.writeContract({
            address: usdcAddress,
            abi: erc20Abi,
            functionName: "approve",
            args: [GATEWAY_WALLET_ADDRESS, depositAmount],
            account,
          });

          // Wait for approval confirmation
          await publicClient.waitForTransactionReceipt({ hash: approvalTxHash });
          console.log(`Approval confirmed: ${approvalTxHash}`);
          setIsApproving(false);
        }

        // Step 3: Deposit to Gateway Wallet
        setIsDepositing(true);
        console.log(`Depositing ${amount} USDC to Gateway Wallet...`);

        const depositTxHash = await walletClient.writeContract({
          address: GATEWAY_WALLET_ADDRESS,
          abi: gatewayWalletAbi,
          functionName: "deposit",
          args: [usdcAddress, depositAmount],
          account,
        });

        setIsDepositing(false);
        setIsWaitingConfirmation(true);

        // Wait for required confirmations
        const requiredConfirmations = REQUIRED_CONFIRMATIONS[chain] || 1;
        console.log(`Waiting for ${requiredConfirmations} confirmations...`);

        await publicClient.waitForTransactionReceipt({
          hash: depositTxHash,
          confirmations: requiredConfirmations,
        });

        console.log(`Deposit confirmed: ${depositTxHash}`);
        setIsWaitingConfirmation(false);

        const result: DepositResult = {
          approvalTxHash,
          depositTxHash,
          amount,
          chain,
        };

        setLastDeposit(result);
        return result;
      } catch (err) {
        setIsApproving(false);
        setIsDepositing(false);
        setIsWaitingConfirmation(false);
        const errorMessage = err instanceof Error ? err.message : "Deposit failed";
        setError(errorMessage);
        throw err;
      }
    },
    []
  );

  return {
    deposit,
    isApproving,
    isDepositing,
    isWaitingConfirmation,
    error,
    lastDeposit,
  };
}
