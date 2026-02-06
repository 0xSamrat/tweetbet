"use client";

import * as React from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  pad,
  maxUint256,
  zeroAddress,
  parseUnits,
  type Hex,
  type Address,
} from "viem";
import { arcTestnet, baseSepolia } from "viem/chains";
import {
  GATEWAY_WALLET_ADDRESS,
  GATEWAY_MINTER_ADDRESS,
  GATEWAY_API_URL,
  USDC_ADDRESSES,
  DOMAIN_IDS,
  GATEWAY_EIP712_DOMAIN,
  BURN_INTENT_TYPES,
  gatewayMinterAbi,
} from "@/config/gateway";

type SupportedChain = "arcTestnet" | "baseSepolia";

interface SourceChainAmount {
  chain: SupportedChain;
  amount: string; // USDC amount to burn from this chain
}

interface TransferParams {
  sources: SourceChainAmount[]; // Which chains to burn from and how much
  recipient: Address;
}

interface TransferResult {
  mintTxHash: Hex;
  totalAmount: string;
  recipient: Address;
}

interface UseGatewayTransferReturn {
  transfer: (params: TransferParams) => Promise<TransferResult>;
  isSigningIntents: boolean;
  isSubmittingToApi: boolean;
  isMinting: boolean;
  error: string | null;
  lastTransfer: TransferResult | null;
}

const chains = {
  arcTestnet,
  baseSepolia,
};

const MAX_FEE = BigInt(2_010000); // Max fee in USDC (6 decimals)

// Generate random salt for burn intent
function generateSalt(): Hex {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')}`;
}

export function useGatewayTransfer(): UseGatewayTransferReturn {
  const [isSigningIntents, setIsSigningIntents] = React.useState(false);
  const [isSubmittingToApi, setIsSubmittingToApi] = React.useState(false);
  const [isMinting, setIsMinting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastTransfer, setLastTransfer] = React.useState<TransferResult | null>(null);

  const transfer = React.useCallback(
    async (params: TransferParams): Promise<TransferResult> => {
      const { sources, recipient } = params;
      // Destination is always ARC Testnet
      const destinationChain: SupportedChain = "arcTestnet";
      
      setError(null);
      setLastTransfer(null);

      if (typeof window === "undefined" || !window.ethereum) {
        throw new Error("MetaMask not found");
      }

      if (sources.length === 0) {
        throw new Error("No source chains specified");
      }

      try {
        // Get wallet client for signing
        const walletClient = createWalletClient({
          chain: arcTestnet, // Chain doesn't matter for signing
          transport: custom(window.ethereum),
        });

        const [account] = await walletClient.getAddresses();
        if (!account) {
          throw new Error("No account connected");
        }

        // Step 1: Create and sign burn intents for each source chain
        setIsSigningIntents(true);
        console.log("Creating burn intents...");

        const requests: Array<{ burnIntent: any; signature: Hex }> = [];

        for (const source of sources) {
          const sourceChain = source.chain;
          const sourceUsdcAddress = USDC_ADDRESSES[sourceChain];
          const destinationUsdcAddress = USDC_ADDRESSES[destinationChain];
          const transferValue = parseUnits(source.amount, 6);

          console.log(`Creating burn intent: ${source.amount} USDC from ${sourceChain} → ${destinationChain}`);

          // Create the burn intent message for EIP-712 signing
          const burnIntentMessage = {
            maxBlockHeight: maxUint256,
            maxFee: MAX_FEE,
            spec: {
              version: 1,
              sourceDomain: DOMAIN_IDS[sourceChain],
              destinationDomain: DOMAIN_IDS[destinationChain],
              sourceContract: pad(GATEWAY_WALLET_ADDRESS.toLowerCase() as Hex, { size: 32 }),
              destinationContract: pad(GATEWAY_MINTER_ADDRESS.toLowerCase() as Hex, { size: 32 }),
              sourceToken: pad(sourceUsdcAddress.toLowerCase() as Hex, { size: 32 }),
              destinationToken: pad(destinationUsdcAddress.toLowerCase() as Hex, { size: 32 }),
              sourceDepositor: pad(account.toLowerCase() as Hex, { size: 32 }),
              destinationRecipient: pad(recipient.toLowerCase() as Hex, { size: 32 }),
              sourceSigner: pad(account.toLowerCase() as Hex, { size: 32 }),
              destinationCaller: pad(zeroAddress.toLowerCase() as Hex, { size: 32 }),
              value: transferValue,
              salt: generateSalt(),
              hookData: "0x" as Hex,
            },
          };

          // Sign the burn intent with MetaMask (EIP-712)
          const signature = await walletClient.signTypedData({
            account,
            domain: GATEWAY_EIP712_DOMAIN,
            types: BURN_INTENT_TYPES,
            primaryType: "BurnIntent",
            message: burnIntentMessage,
          });

          requests.push({ burnIntent: burnIntentMessage, signature });
        }

        console.log(`Signed ${requests.length} burn intents`);
        setIsSigningIntents(false);

        // Step 2: Submit burn intents to Gateway API
        setIsSubmittingToApi(true);
        console.log("Submitting to Gateway API...");

        const response = await fetch(`${GATEWAY_API_URL}/transfer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requests, (_key, value) =>
            typeof value === "bigint" ? value.toString() : value
          ),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Gateway API error:", errorText);
          throw new Error(`Gateway API error: ${response.status} - ${errorText}`);
        }

        const json = await response.json();
        console.log("Gateway API response:", json);

        if (json.success === false) {
          throw new Error(`Gateway API error: ${json.message}`);
        }

        const { attestation, signature: mintSignature } = json;
        setIsSubmittingToApi(false);

        // Step 3: Mint USDC on ARC Testnet (destination chain)
        setIsMinting(true);
        console.log(`Minting USDC on ARC Testnet...`);

        const publicClient = createPublicClient({
          chain: arcTestnet,
          transport: http(),
        });

        const mintWalletClient = createWalletClient({
          chain: arcTestnet,
          transport: custom(window.ethereum),
        });

        // Switch to ARC Testnet if needed
        const currentChainId = await mintWalletClient.getChainId();
        if (currentChainId !== arcTestnet.id) {
          await mintWalletClient.switchChain({ id: arcTestnet.id });
        }

        // Call gatewayMint on ARC Testnet
        const mintTxHash = await mintWalletClient.writeContract({
          address: GATEWAY_MINTER_ADDRESS,
          abi: gatewayMinterAbi,
          functionName: "gatewayMint",
          args: [attestation as Hex, mintSignature as Hex],
          account,
        });

        // Wait for confirmation
        await publicClient.waitForTransactionReceipt({ hash: mintTxHash });
        console.log(`Minted! Transaction: ${mintTxHash}`);

        setIsMinting(false);

        // Calculate total amount
        const totalAmount = sources.reduce(
          (sum, s) => sum + parseFloat(s.amount),
          0
        ).toFixed(2);

        const result: TransferResult = {
          mintTxHash,
          totalAmount,
          recipient,
        };

        setLastTransfer(result);
        return result;
      } catch (err) {
        setIsSigningIntents(false);
        setIsSubmittingToApi(false);
        setIsMinting(false);
        const errorMessage = err instanceof Error ? err.message : "Transfer failed";
        setError(errorMessage);
        throw err;
      }
    },
    []
  );

  return {
    transfer,
    isSigningIntents,
    isSubmittingToApi,
    isMinting,
    error,
    lastTransfer,
  };
}
