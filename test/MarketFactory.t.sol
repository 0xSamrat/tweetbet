// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.30;

import {Test, console} from "forge-std/Test.sol";
import {PredictionAMM} from "../src/PredictionAMM.sol";
import {MarketFactory} from "../src/MarketFactory.sol";
import {IPredictionAMM} from "../src/interface/IPredictionAMM.sol";

/// @dev Simple ERC20 mock for testing
contract MockERC20 {
    string public name;
    string public symbol;
    uint8 public decimals;
    uint256 public totalSupply;
    
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    
    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);
    
    constructor(string memory _name, string memory _symbol, uint8 _decimals) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
    }
    
    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }
    
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }
    
    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }
    
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (allowance[from][msg.sender] != type(uint256).max) {
            allowance[from][msg.sender] -= amount;
        }
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}

contract MarketFactoryTest is Test {
    PredictionAMM public predictionAMM;
    MarketFactory public marketFactory;

    // Users
    address public liquidityProvider = makeAddr("liquidityProvider");
    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");
    address public user3 = makeAddr("user3");
    address public user4 = makeAddr("user4");
    address public user5 = makeAddr("user5");
    address public resolver = makeAddr("resolver");

    // Market parameters
    string public constant DESCRIPTION = "Will ETH reach $10k by end of 2026?";
    uint64 public closeTime;
    uint256 public constant FEE_BPS = 30; // 0.3% fee

    function setUp() public {
        // 1. Deploy PredictionAMM first
        predictionAMM = new PredictionAMM();
        console.log("PredictionAMM deployed at:", address(predictionAMM));

        // 2. Deploy MarketFactory with PredictionAMM address
        marketFactory = new MarketFactory(IPredictionAMM(address(predictionAMM)));
        console.log("MarketFactory deployed at:", address(marketFactory));

        // Set close time to 30 days from now
        closeTime = uint64(block.timestamp + 30 days);

        // Fund users with ETH
        vm.deal(liquidityProvider, 100 ether);
        vm.deal(user1, 10 ether);
        vm.deal(user2, 10 ether);
        vm.deal(user3, 10 ether);
        vm.deal(user4, 10 ether);
        vm.deal(user5, 10 ether);
    }

    function test_HappyPath_CreateMarketAndTrade() public {
        console.log("\n========== HAPPY PATH TEST ==========\n");

        // ============ STEP 1: Create Market and Seed with Initial Liquidity ============
        console.log("--- Step 1: Creating Market and Seeding Liquidity ---");
        
        uint256 initialLiquidity = 10 ether;
        
        vm.startPrank(liquidityProvider);
        
        (uint256 marketId, uint256 noId, uint256 liquidity) = marketFactory.createMarketAndSeed{value: initialLiquidity}(
            DESCRIPTION,           // description
            resolver,              // resolver (oracle)
            address(0),            // collateral (ETH)
            closeTime,             // close time
            true,                  // canClose (resolver can early-close)
            0,                     // collateralIn (0 means use msg.value for ETH)
            FEE_BPS,               // feeOrHook (pool fee in bps)
            0,                     // minLiquidity
            liquidityProvider,     // to (LP token recipient)
            block.timestamp + 1 hours  // deadline
        );
        
        vm.stopPrank();

        console.log("Market created successfully!");
        console.log("  Market ID (YES token ID):", marketId);
        console.log("  NO token ID:", noId);
        console.log("  LP tokens minted:", liquidity);
        
        // Print initial token supplies
        _printTokenSupplies(marketId, noId, "After Market Creation");

        // ============ STEP 2: Users Buy YES and NO tokens ============
        console.log("\n--- Step 2: Users Trading ---");
        
        // User 1 buys YES tokens
        console.log("\nUser 1 buying YES tokens with 1 ETH...");
        vm.startPrank(user1);
        uint256 user1YesOut = marketFactory.buyYes{value: 1 ether}(
            marketId,
            0,                     // collateralIn (use msg.value)
            0,                     // minYesOut
            0,                     // minSwapOut
            FEE_BPS,               // feeOrHook
            user1,                 // to
            block.timestamp + 1 hours  // deadline
        );
        vm.stopPrank();
        console.log("  User 1 received YES tokens:", user1YesOut);

        // User 2 buys YES tokens
        console.log("\nUser 2 buying YES tokens with 1.5 ETH...");
        vm.startPrank(user2);
        uint256 user2YesOut = marketFactory.buyYes{value: 1.5 ether}(
            marketId,
            0,
            0,
            0,
            FEE_BPS,
            user2,
            block.timestamp + 1 hours
        );
        vm.stopPrank();
        console.log("  User 2 received YES tokens:", user2YesOut);

        // User 3 buys YES tokens
        console.log("\nUser 3 buying YES tokens with 2 ETH...");
        vm.startPrank(user3);
        uint256 user3YesOut = marketFactory.buyYes{value: 2 ether}(
            marketId,
            0,
            0,
            0,
            FEE_BPS,
            user3,
            block.timestamp + 1 hours
        );
        vm.stopPrank();
        console.log("  User 3 received YES tokens:", user3YesOut);

        // User 4 buys NO tokens
        console.log("\nUser 4 buying NO tokens with 1 ETH...");
        vm.startPrank(user4);
        uint256 user4NoOut = marketFactory.buyNo{value: 1 ether}(
            marketId,
            0,
            0,
            0,
            FEE_BPS,
            user4,
            block.timestamp + 1 hours
        );
        vm.stopPrank();
        console.log("  User 4 received NO tokens:", user4NoOut);

        // User 5 buys NO tokens
        console.log("\nUser 5 buying NO tokens with 0.5 ETH...");
        vm.startPrank(user5);
        uint256 user5NoOut = marketFactory.buyNo{value: 0.5 ether}(
            marketId,
            0,
            0,
            0,
            FEE_BPS,
            user5,
            block.timestamp + 1 hours
        );
        vm.stopPrank();
        console.log("  User 5 received NO tokens:", user5NoOut);

        // ============ STEP 3: Print State After Trading ============
        _printTokenSupplies(marketId, noId, "After All Trades");
        _printUserBalances(marketId, noId);
        _printPoolState(marketId);

        // ============ STEP 4: Time passes and Market Closes ============
        console.log("\n--- Step 4: Fast Forward to Market Close Time ---");
        
        // Warp time to after close time
        vm.warp(closeTime + 1);
        console.log("  Time warped to:", block.timestamp);
        console.log("  Market close time was:", closeTime);

        // ============ STEP 5: Resolver Resolves the Market ============
        console.log("\n--- Step 5: Resolver Resolves Market (YES wins!) ---");
        
        // Record ETH balances before claiming
        uint256 user1BalBefore = user1.balance;
        uint256 user2BalBefore = user2.balance;
        uint256 user3BalBefore = user3.balance;
        uint256 user4BalBefore = user4.balance;
        uint256 user5BalBefore = user5.balance;
        
        console.log("\n  ETH Balances BEFORE claiming:");
        console.log("    User 1:", user1BalBefore);
        console.log("    User 2:", user2BalBefore);
        console.log("    User 3:", user3BalBefore);
        console.log("    User 4:", user4BalBefore);
        console.log("    User 5:", user5BalBefore);
        
        // Resolver resolves market - YES wins!
        vm.prank(resolver);
        marketFactory.resolve(marketId, true); // true = YES wins
        
        console.log("\n  Market resolved! YES wins!");
        
        // Verify market is resolved
        (,, bool resolved, bool outcome,,,,,,) = marketFactory.getMarket(marketId);
        console.log("  Market resolved:", resolved);
        console.log("  Winning outcome (true=YES):", outcome);

        // ============ STEP 6: Winners Claim Their Profits ============
        console.log("\n--- Step 6: Winners Claim Profits ---");
        
        // User 1 claims (bought YES - WINNER)
        console.log("\nUser 1 claiming (bought YES - WINNER)...");
        vm.prank(user1);
        (uint256 user1Shares, uint256 user1Payout) = marketFactory.claim(marketId, user1);
        console.log("  Shares burned:", user1Shares);
        console.log("  ETH received:", user1Payout);
        
        // User 2 claims (bought YES - WINNER)
        console.log("\nUser 2 claiming (bought YES - WINNER)...");
        vm.prank(user2);
        (uint256 user2Shares, uint256 user2Payout) = marketFactory.claim(marketId, user2);
        console.log("  Shares burned:", user2Shares);
        console.log("  ETH received:", user2Payout);
        
        // User 3 claims (bought YES - WINNER)
        console.log("\nUser 3 claiming (bought YES - WINNER)...");
        vm.prank(user3);
        (uint256 user3Shares, uint256 user3Payout) = marketFactory.claim(marketId, user3);
        console.log("  Shares burned:", user3Shares);
        console.log("  ETH received:", user3Payout);
        
        // User 4 tries to claim (bought NO - LOSER)
        console.log("\nUser 4 trying to claim (bought NO - LOSER)...");
        uint256 user4WinningBalance = marketFactory.balanceOf(user4, marketId); // YES balance = 0
        console.log("  User 4 winning token balance:", user4WinningBalance);
        console.log("  User 4 cannot claim - has no winning tokens!");
        
        // User 5 tries to claim (bought NO - LOSER)
        console.log("\nUser 5 trying to claim (bought NO - LOSER)...");
        uint256 user5WinningBalance = marketFactory.balanceOf(user5, marketId); // YES balance = 0
        console.log("  User 5 winning token balance:", user5WinningBalance);
        console.log("  User 5 cannot claim - has no winning tokens!");

        // ============ STEP 7: Print Final Results ============
        console.log("\n--- Step 7: Final Results ---");
        
        console.log("\n  ETH Balances AFTER claiming:");
        console.log("    User 1:", user1.balance);
        console.log("      profit:", user1.balance - user1BalBefore);
        console.log("    User 2:", user2.balance);
        console.log("      profit:", user2.balance - user2BalBefore);
        console.log("    User 3:", user3.balance);
        console.log("      profit:", user3.balance - user3BalBefore);
        console.log("    User 4:", user4.balance, "(no change - lost bet)");
        console.log("    User 5:", user5.balance, "(no change - lost bet)");
        
        console.log("\n  Profit/Loss Summary:");
        console.log("    User 1: Spent 1 ETH, received (wei):", user1Payout);
        console.log("      Result:", user1Payout > 1 ether ? "PROFIT" : "LOSS");
        console.log("    User 2: Spent 1.5 ETH, received (wei):", user2Payout);
        console.log("      Result:", user2Payout > 1.5 ether ? "PROFIT" : "LOSS");
        console.log("    User 3: Spent 2 ETH, received (wei):", user3Payout);
        console.log("      Result:", user3Payout > 2 ether ? "PROFIT" : "LOSS");
        console.log("    User 4: Spent 1 ETH, received 0 = LOSS");
        console.log("    User 5: Spent 0.5 ETH, received 0 = LOSS");
        
        // Final token balances (should be 0 for winners after claiming)
        console.log("\n  Final Token Balances:");
        console.log("    User 1 YES:", marketFactory.balanceOf(user1, marketId));
        console.log("    User 2 YES:", marketFactory.balanceOf(user2, marketId));
        console.log("    User 3 YES:", marketFactory.balanceOf(user3, marketId));
        console.log("    User 4 NO (worthless):", marketFactory.balanceOf(user4, noId));
        console.log("    User 5 NO (worthless):", marketFactory.balanceOf(user5, noId));
        
        // Verify claims were successful
        assertGt(user1Payout, 0, "User 1 should have received payout");
        assertGt(user2Payout, 0, "User 2 should have received payout");
        assertGt(user3Payout, 0, "User 3 should have received payout");
        assertEq(marketFactory.balanceOf(user1, marketId), 0, "User 1 YES balance should be 0 after claim");
        assertEq(marketFactory.balanceOf(user2, marketId), 0, "User 2 YES balance should be 0 after claim");
        assertEq(marketFactory.balanceOf(user3, marketId), 0, "User 3 YES balance should be 0 after claim");
    }

    function _printTokenSupplies(uint256 marketId, uint256 noId, string memory label) internal view {
        uint256 yesSupply = marketFactory.totalSupplyId(marketId);
        uint256 noSupply = marketFactory.totalSupplyId(noId);
        
        console.log("\n=== Token Supplies", label, "===");
        console.log("  Total YES tokens:", yesSupply);
        console.log("  Total NO tokens:", noSupply);
    }

    function _printUserBalances(uint256 marketId, uint256 noId) internal view {
        console.log("\n=== User Balances ===");
        
        console.log("  Liquidity Provider:");
        console.log("    YES:", marketFactory.balanceOf(liquidityProvider, marketId));
        console.log("    NO:", marketFactory.balanceOf(liquidityProvider, noId));
        
        console.log("  User 1 (bought YES):");
        console.log("    YES:", marketFactory.balanceOf(user1, marketId));
        console.log("    NO:", marketFactory.balanceOf(user1, noId));
        
        console.log("  User 2 (bought YES):");
        console.log("    YES:", marketFactory.balanceOf(user2, marketId));
        console.log("    NO:", marketFactory.balanceOf(user2, noId));
        
        console.log("  User 3 (bought YES):");
        console.log("    YES:", marketFactory.balanceOf(user3, marketId));
        console.log("    NO:", marketFactory.balanceOf(user3, noId));
        
        console.log("  User 4 (bought NO):");
        console.log("    YES:", marketFactory.balanceOf(user4, marketId));
        console.log("    NO:", marketFactory.balanceOf(user4, noId));
        
        console.log("  User 5 (bought NO):");
        console.log("    YES:", marketFactory.balanceOf(user5, marketId));
        console.log("    NO:", marketFactory.balanceOf(user5, noId));
    }

    function _printPoolState(uint256 marketId) internal view {
        (uint256 rYes, uint256 rNo, uint256 pYesNum, uint256 pYesDen) = 
            marketFactory.getPoolState(marketId, FEE_BPS);
        
        console.log("\n=== Pool State ===");
        console.log("  Reserve YES:", rYes);
        console.log("  Reserve NO:", rNo);
        
        // Calculate probability as percentage (multiply by 100 for display)
        if (pYesDen > 0) {
            uint256 probYes = (pYesNum * 100) / pYesDen;
            uint256 probNo = 100 - probYes;
            console.log("  Implied YES probability:", probYes, "%");
            console.log("  Implied NO probability:", probNo, "%");
        }
    }

    /*//////////////////////////////////////////////////////////////
                        ERC20 COLLATERAL TEST
    //////////////////////////////////////////////////////////////*/

    function test_HappyPath_ERC20Collateral() public {
        console.log("\n========== ERC20 COLLATERAL HAPPY PATH TEST ==========\n");

        // ============ STEP 0: Deploy Mock USDC and Mint to Users ============
        console.log("--- Step 0: Deploying Mock USDC and Funding Users ---");
        
        MockERC20 usdc = new MockERC20("USD Coin", "USDC", 6);
        console.log("Mock USDC deployed at:", address(usdc));
        
        // Mint USDC to all users (using 6 decimals like real USDC)
        uint256 lpAmount = 10_000 * 1e6;  // 10,000 USDC
        uint256 userAmount = 1_000 * 1e6; // 1,000 USDC each
        
        usdc.mint(liquidityProvider, lpAmount);
        usdc.mint(user1, userAmount);
        usdc.mint(user2, userAmount);
        usdc.mint(user3, userAmount);
        usdc.mint(user4, userAmount);
        usdc.mint(user5, userAmount);
        
        console.log("  Liquidity Provider USDC balance:", usdc.balanceOf(liquidityProvider));
        console.log("  Each user USDC balance:", userAmount);

        // ============ STEP 1: Create Market with USDC Collateral ============
        console.log("\n--- Step 1: Creating Market with USDC Collateral ---");
        
        uint256 initialLiquidity = 5_000 * 1e6; // 5,000 USDC
        string memory description = "Will BTC reach $200k by end of 2026?";
        
        vm.startPrank(liquidityProvider);
        
        // Approve MarketFactory to spend USDC
        usdc.approve(address(marketFactory), type(uint256).max);
        console.log("  LP approved MarketFactory for USDC");
        
        (uint256 marketId, uint256 noId, uint256 liquidity) = marketFactory.createMarketAndSeed(
            description,           // description
            resolver,              // resolver (oracle)
            address(usdc),         // collateral (USDC - ERC20!)
            closeTime,             // close time
            true,                  // canClose
            initialLiquidity,      // collateralIn (USDC amount)
            FEE_BPS,               // feeOrHook
            0,                     // minLiquidity
            liquidityProvider,     // to
            block.timestamp + 1 hours
        );
        
        vm.stopPrank();

        console.log("Market created successfully with USDC collateral!");
        console.log("  Market ID (YES token ID):", marketId);
        console.log("  NO token ID:", noId);
        console.log("  LP tokens minted:", liquidity);
        console.log("  LP remaining USDC:", usdc.balanceOf(liquidityProvider));
        
        // Print initial token supplies
        _printTokenSupplies(marketId, noId, "After Market Creation");

        // ============ STEP 2: Users Approve and Buy YES/NO tokens ============
        console.log("\n--- Step 2: Users Trading with USDC ---");
        
        // User 1 buys YES tokens with 500 USDC
        console.log("\nUser 1 buying YES tokens with 500 USDC...");
        vm.startPrank(user1);
        usdc.approve(address(marketFactory), type(uint256).max);
        uint256 user1YesOut = marketFactory.buyYes(
            marketId,
            500 * 1e6,             // collateralIn (500 USDC)
            0,                     // minYesOut
            0,                     // minSwapOut
            FEE_BPS,               // feeOrHook
            user1,                 // to
            block.timestamp + 1 hours
        );
        vm.stopPrank();
        console.log("  User 1 received YES tokens:", user1YesOut);
        console.log("  User 1 remaining USDC:", usdc.balanceOf(user1));

        // User 2 buys YES tokens with 750 USDC
        console.log("\nUser 2 buying YES tokens with 750 USDC...");
        vm.startPrank(user2);
        usdc.approve(address(marketFactory), type(uint256).max);
        uint256 user2YesOut = marketFactory.buyYes(
            marketId,
            750 * 1e6,
            0,
            0,
            FEE_BPS,
            user2,
            block.timestamp + 1 hours
        );
        vm.stopPrank();
        console.log("  User 2 received YES tokens:", user2YesOut);
        console.log("  User 2 remaining USDC:", usdc.balanceOf(user2));

        // User 3 buys YES tokens with 1000 USDC
        console.log("\nUser 3 buying YES tokens with 1000 USDC...");
        vm.startPrank(user3);
        usdc.approve(address(marketFactory), type(uint256).max);
        uint256 user3YesOut = marketFactory.buyYes(
            marketId,
            1000 * 1e6,
            0,
            0,
            FEE_BPS,
            user3,
            block.timestamp + 1 hours
        );
        vm.stopPrank();
        console.log("  User 3 received YES tokens:", user3YesOut);
        console.log("  User 3 remaining USDC:", usdc.balanceOf(user3));

        // User 4 buys NO tokens with 500 USDC
        console.log("\nUser 4 buying NO tokens with 500 USDC...");
        vm.startPrank(user4);
        usdc.approve(address(marketFactory), type(uint256).max);
        uint256 user4NoOut = marketFactory.buyNo(
            marketId,
            500 * 1e6,
            0,
            0,
            FEE_BPS,
            user4,
            block.timestamp + 1 hours
        );
        vm.stopPrank();
        console.log("  User 4 received NO tokens:", user4NoOut);
        console.log("  User 4 remaining USDC:", usdc.balanceOf(user4));

        // User 5 buys NO tokens with 250 USDC
        console.log("\nUser 5 buying NO tokens with 250 USDC...");
        vm.startPrank(user5);
        usdc.approve(address(marketFactory), type(uint256).max);
        uint256 user5NoOut = marketFactory.buyNo(
            marketId,
            250 * 1e6,
            0,
            0,
            FEE_BPS,
            user5,
            block.timestamp + 1 hours
        );
        vm.stopPrank();
        console.log("  User 5 received NO tokens:", user5NoOut);
        console.log("  User 5 remaining USDC:", usdc.balanceOf(user5));

        // ============ STEP 3: Print Final State ============
        _printTokenSupplies(marketId, noId, "After All Trades");
        _printUserBalances(marketId, noId);
        _printPoolState(marketId);
        
        // Print USDC locked in MarketFactory
        console.log("\n=== USDC Collateral State ===");
        console.log("  USDC locked in MarketFactory:", usdc.balanceOf(address(marketFactory)));
        
        // Verify market collateral info
        (,address collateral,,,,, uint256 collateralLocked,,,) = marketFactory.getMarket(marketId);
        console.log("  Collateral token:", collateral);
        console.log("  Collateral locked (from market):", collateralLocked);
    }
}
