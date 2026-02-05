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

### Local (Anvil)
```bash
# Start local node
anvil

# Deploy
forge script script/Counter.s.sol --rpc-url http://localhost:8545 --broadcast
```

### Testnet
```bash
# Set environment variables
export PRIVATE_KEY=<your-private-key>
export RPC_URL=<testnet-rpc-url>

# Deploy
forge script script/Counter.s.sol --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast
```

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
