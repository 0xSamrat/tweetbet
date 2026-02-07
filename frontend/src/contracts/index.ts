/**
 * MarketFactory Contract Configuration
 * 
 * ABI is auto-copied from Foundry build output.
 * Address is loaded from environment variable.
 */

import MarketFactoryABI from "./MarketFactoryABI.json";

// Re-export ABI
export { MarketFactoryABI };

// Contract address from environment variable
export const MARKET_FACTORY_ADDRESS = process.env
  .NEXT_PUBLIC_MARKET_FACTORY_ADDRESS as `0x${string}`;

// Validate at runtime
if (!MARKET_FACTORY_ADDRESS) {
  console.warn(
    "⚠️ NEXT_PUBLIC_MARKET_FACTORY_ADDRESS not set in .env file. " +
      "Please add it to frontend/.env"
  );
}

// Export typed ABI for viem
export const marketFactoryAbi = MarketFactoryABI as typeof MarketFactoryABI;
