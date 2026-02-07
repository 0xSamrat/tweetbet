// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {PredictionAMM} from "../src/PredictionAMM.sol";
import {MarketFactory} from "../src/MarketFactory.sol";
import {IPredictionAMM} from "../src/interface/IPredictionAMM.sol";

contract Deploy is Script {
    PredictionAMM public predictionAMM;
    MarketFactory public marketFactory;

    // Salt for deterministic deployment - change this to get different addresses
    bytes32 constant SALT = bytes32(uint256(1));

    function setUp() public {}

    function run() public {
        // Get deployer address from the broadcaster
        console.log("Starting deployment...");
        
        vm.startBroadcast();

        // Deploy PredictionAMM with CREATE2 (deterministic address)
        predictionAMM = new PredictionAMM{salt: SALT}();
        console.log("PredictionAMM deployed at:", address(predictionAMM));
        
        // Deploy MarketFactory with CREATE2 (deterministic address)
        marketFactory = new MarketFactory{salt: SALT}(IPredictionAMM(address(predictionAMM)));
        console.log("MarketFactory deployed at:", address(marketFactory));

        vm.stopBroadcast();
        
        console.log("\n=== Deployment Complete (CREATE2) ===");
        console.log("Salt used:", vm.toString(SALT));
        console.log("PredictionAMM:", address(predictionAMM));
        console.log("MarketFactory:", address(marketFactory));
    }

    /// @notice Dry run to compute addresses without deploying
    function computeAddresses(address deployer) public view returns (address ammAddr, address factoryAddr) {
        // Compute PredictionAMM address
        bytes32 ammInitCodeHash = keccak256(type(PredictionAMM).creationCode);
        ammAddr = computeCreate2Address(SALT, ammInitCodeHash, deployer);
        
        // Compute MarketFactory address (includes constructor arg)
        bytes memory factoryInitCode = abi.encodePacked(
            type(MarketFactory).creationCode,
            abi.encode(IPredictionAMM(ammAddr))
        );
        bytes32 factoryInitCodeHash = keccak256(factoryInitCode);
        factoryAddr = computeCreate2Address(SALT, factoryInitCodeHash, deployer);
        
        console.log("\n=== Predicted Addresses ===");
        console.log("Deployer:", deployer);
        console.log("PredictionAMM will deploy to:", ammAddr);
        console.log("MarketFactory will deploy to:", factoryAddr);
    }
}
