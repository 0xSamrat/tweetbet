import type { Address } from "viem";

// Gateway Contract Addresses (same on all EVM chains)
export const GATEWAY_WALLET_ADDRESS = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9" as const;
export const GATEWAY_MINTER_ADDRESS = "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B" as const;

// Gateway API URL
export const GATEWAY_API_URL = "https://gateway-api-testnet.circle.com/v1";

// USDC Contract Addresses per chain
export const USDC_ADDRESSES: Record<string, Address> = {
  arcTestnet: "0x3600000000000000000000000000000000000000",
  baseSepolia: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
};

// Chain IDs
export const CHAIN_IDS = {
  arcTestnet: 1637450,
  baseSepolia: 84532,
} as const;

// Domain IDs for Gateway (used in burn intents)
export const DOMAIN_IDS: Record<string, number> = {
  arcTestnet: 26,
  baseSepolia: 6,
};

// Gateway Wallet ABI (for deposit and balance)
export const gatewayWalletAbi = [
  {
    type: "function",
    name: "deposit",
    inputs: [
      { name: "token", type: "address", internalType: "address" },
      { name: "value", type: "uint256", internalType: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "depositFor",
    inputs: [
      { name: "token", type: "address", internalType: "address" },
      { name: "value", type: "uint256", internalType: "uint256" },
      { name: "recipient", type: "address", internalType: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [
      { name: "token", type: "address", internalType: "address" },
      { name: "account", type: "address", internalType: "address" },
    ],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "Deposit",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
  },
] as const;

// Gateway Minter ABI (for receiving/minting USDC on destination chain)
export const gatewayMinterAbi = [
  {
    type: "function",
    name: "gatewayMint",
    inputs: [
      { name: "attestationPayload", type: "bytes", internalType: "bytes" },
      { name: "signature", type: "bytes", internalType: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

// Block confirmations required per chain
export const REQUIRED_CONFIRMATIONS: Record<string, number> = {
  arcTestnet: 1,
  baseSepolia: 12,
};

// EIP-712 Domain for signing burn intents
export const GATEWAY_EIP712_DOMAIN = {
  name: "GatewayWallet",
  version: "1",
} as const;

// EIP-712 Types for burn intents
export const BURN_INTENT_TYPES = {
  TransferSpec: [
    { name: "version", type: "uint32" },
    { name: "sourceDomain", type: "uint32" },
    { name: "destinationDomain", type: "uint32" },
    { name: "sourceContract", type: "bytes32" },
    { name: "destinationContract", type: "bytes32" },
    { name: "sourceToken", type: "bytes32" },
    { name: "destinationToken", type: "bytes32" },
    { name: "sourceDepositor", type: "bytes32" },
    { name: "destinationRecipient", type: "bytes32" },
    { name: "sourceSigner", type: "bytes32" },
    { name: "destinationCaller", type: "bytes32" },
    { name: "value", type: "uint256" },
    { name: "salt", type: "bytes32" },
    { name: "hookData", type: "bytes" },
  ],
  BurnIntent: [
    { name: "maxBlockHeight", type: "uint256" },
    { name: "maxFee", type: "uint256" },
    { name: "spec", type: "TransferSpec" },
  ],
} as const;
