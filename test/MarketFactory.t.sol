// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.30;

import {Test, console} from "forge-std/Test.sol";
import {PredictionAMM} from "../src/PredictionAMM.sol";
import {MarketFactory} from "../src/MarketFactory.sol";
import {IPredictionAMM} from "../src/interface/IPredictionAMM.sol";

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

        // ============ STEP 3: Print Final State ============
        _printTokenSupplies(marketId, noId, "After All Trades");
        _printUserBalances(marketId, noId);
        _printPoolState(marketId);
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
}
