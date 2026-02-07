# Binary Prediction Market

A decentralized prediction market protocol built with ERC6909 multi-token standard. Users can create markets for any YES/NO question, provide liquidity, and trade outcome tokens.

## Features

- 🎯 **Binary Outcomes** - Create markets for any YES/NO question
- 💰 **Multi-Collateral** - Supports ETH and any ERC20 token as collateral
- 🔄 **Automated Market Maker** - ERC6909 token based AMM for continuous liquidity
- 🪙 **ERC6909 Tokens** - Gas-efficient multi-token standard for YES/NO shares
- 🔮 **Flexible Oracles** - Supports manual resolution, multisig, or automated oracles
- 💸 **LP Rewards** - Liquidity providers earn trading fees

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      MarketFactory.sol                          │
│  - Creates prediction markets                                   │
│  - Manages collateral (ETH/ERC20)                              │
│  - Mints YES/NO tokens (ERC6909)                               │
│  - Handles resolution and claims                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PredictionAMM.sol                          │
│  - Liquidity pools for YES/NO trading                          │
│  - Constant Product Market Maker (x * y = k)                   │
│  - LP token management                                          │
│  - Swap execution                                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Resolver.sol                             │
│  - On-chain oracle for automated resolution                    │
│  - Supports custom conditions (price > X, balance > Y)         │
│  - Alternative: Manual EOA or Multisig resolution              │
└─────────────────────────────────────────────────────────────────┘
```

## Contracts

| Contract | Description |
|----------|-------------|
| `MarketFactory.sol` | Core factory for creating and managing prediction markets |
| `PredictionAMM.sol` | AMM for trading YES/NO outcome tokens |
| `Resolver.sol` | On-chain oracle for automated market resolution |
| `ERC6909.sol` | Multi-token standard implementation |
| `ERC6909Minimal.sol` | Gas-optimized minimal ERC6909 |

## How It Works

### 1. Create a Market
```solidity
marketFactory.createMarketAndSeed{value: 10 ether}(
    "Will ETH reach $10k by end of 2026?",  // Question
    resolverAddress,                          // Who can resolve
    address(0),                               // Collateral (ETH)
    closeTime,                                // When resolution is allowed
    true,                                     // Can resolver early-close?
    0,                                        // Use msg.value for ETH
    30,                                       // Fee in basis points (0.3%)
    0,                                        // Min liquidity
    msg.sender,                               // LP token recipient
    deadline                                  // Transaction deadline
);
```

### 2. Buy Outcome Tokens
```solidity
// Buy YES tokens
marketFactory.buyYes{value: 1 ether}(
    marketId,
    0,              // collateralIn (use msg.value)
    0,              // minYesOut
    0,              // minSwapOut
    30,             // feeOrHook
    msg.sender,     // recipient
    deadline
);

// Buy NO tokens
marketFactory.buyNo{value: 1 ether}(marketId, 0, 0, 0, 30, msg.sender, deadline);
```

### 3. Resolve Market
```solidity
// Only resolver can call after close time
marketFactory.resolve(marketId, true);  // true = YES wins, false = NO wins
```

### 4. Claim Winnings
```solidity
// Winners claim their collateral
marketFactory.claim(marketId, msg.sender);
```

## Installation

### Prerequisites
- [Foundry](https://book.getfoundry.sh/getting-started/installation)

### Setup
```bash
# Clone the repository
git clone <repo-url>
cd binary-trading

# Install dependencies
forge install

# Build contracts
forge build
```

## Testing

### Run All Tests
```bash
forge test
```

### Run Specific Tests
```bash
# Happy path test with ETH collateral
forge test --match-test test_HappyPath_CreateMarketAndTrade -vv

# Happy path test with ERC20 collateral
forge test --match-test test_HappyPath_ERC20Collateral -vv
```

### Run with Different Outcomes
The happy path test uses random outcome selection. Force specific outcomes:

```bash
# Force NO wins
forge test --match-test test_HappyPath_CreateMarketAndTrade -vv \
  --block-prevrandao 0x0000000000000000000000000000000000000000000000000000000000000001

# Force YES wins
forge test --match-test test_HappyPath_CreateMarketAndTrade -vv \
  --block-prevrandao 0x0000000000000000000000000000000000000000000000000000000000000000
```

### Verbose Output
```bash
# Show all logs
forge test -vv

# Show traces
forge test -vvv

# Show full traces including calls
forge test -vvvv
```

### Gas Report
```bash
forge test --gas-report
```

## Deployment

The contracts use **CREATE2** for deterministic deployment addresses. The same addresses will be deployed on any chain when using the same deployer and salt.

### Local (Anvil)

#### Step 1: Start Anvil
```bash
# In a terminal, start the local blockchain
anvil
```

Keep this terminal running. You'll see 10 test accounts with 10,000 ETH each.

#### Step 2: Fund Your Deployer (if using keystore)
```bash
# Skip this if using Anvil's default private key
DEPLOYER=$(cast wallet address --account deployer)
cast send $DEPLOYER --value 10ether \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --rpc-url http://127.0.0.1:8545
```

#### Step 3: Deploy
```bash
# Option A: Using Anvil's default private key (quick testing)
forge script script/Deploy.s.sol:Deploy \
  --rpc-url http://127.0.0.1:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --broadcast

# Option B: Using keystore (recommended)
forge script script/Deploy.s.sol:Deploy \
  --rpc-url http://127.0.0.1:8545 \
  --account deployer \
  --broadcast
```

---

### Testnet Deployment

#### Step 1 (Optional): Create an Encrypted Keystore
If you haven't created a keystore yet, create one to securely store your private key:

```bash
# This will prompt for your private key and a password
cast wallet import deployer --interactive
```

You'll see:
```
Enter private key:
Enter password:
`deployer` keystore was saved successfully. Address: 0xYourAddress...
```

#### Step 1.5 (Optional): Verify the Keystore was Created
```bash
# List all keystores
cast wallet list

# Check your deployer address
cast wallet address --account deployer
```

#### Step 2: Deploy to Testnet
Make sure your wallet has testnet ETH (use faucets for testnets).

```bash
# Deploy to Base Sepolia
forge script script/Deploy.s.sol:Deploy \
  --rpc-url https://sepolia.base.org \
  --account deployer \
  --broadcast

# Deploy to Sepolia
forge script script/Deploy.s.sol:Deploy \
  --rpc-url https://rpc.sepolia.org \
  --account deployer \
  --broadcast

# Deploy with contract verification
forge script script/Deploy.s.sol:Deploy \
  --rpc-url https://sepolia.base.org \
  --account deployer \
  --broadcast \
  --verify
```

---

### Deployed Addresses (CREATE2)

Using `salt = 1`, the contracts deploy to these deterministic addresses:

| Contract | Address |
|----------|---------|
| **PredictionAMM** | `0x0B60DE51f67B8e0Dfd1E7Cea1A3487A28010E162` |
| **MarketFactory** | `0xB4a0046a84977F81d4A0BA42cf05e7a6b6726992` |

> **Note:** These addresses are the same on any EVM chain when deployed from the same deployer address with the same salt.

## Token IDs

The protocol uses ERC6909 with deterministic token IDs:

| Token | ID Derivation |
|-------|---------------|
| YES | `keccak256("PMARKET:YES", description, resolver, collateral)` |
| NO | `keccak256("PMARKET:NO", marketId)` |
| LP | `keccak256(poolKey)` |

## Resolution Options

### 1. Manual (EOA)
- Set `resolver` to a trusted wallet address
- Human calls `resolve(marketId, outcome)` after close time

### 2. Multisig
- Deploy `MultisigResolver` with M-of-N signers
- Multiple parties vote on outcome

### 3. Automated (Resolver.sol)
- Set conditions based on on-chain data
- Anyone can trigger resolution when condition is met

### 4. External Oracles (Future)
- Chainlink, UMA, Pyth when available on target chain

## Security Considerations

- ✅ Reentrancy protection via transient storage
- ✅ Slippage protection on all swaps
- ✅ Deadline parameters prevent stale transactions
- ✅ Only designated resolver can set outcomes
- ⚠️ Audit recommended before mainnet deployment

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Submit a pull request

---

Built for ETHGlobal Hackathon 🚀
