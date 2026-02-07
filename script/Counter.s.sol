// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {PredictionAMM} from "../src/PredictionAMM.sol";
import {MarketFactory} from "../src/MarketFactory.sol";
import {IPredictionAMM} from "../src/interface/IPredictionAMM.sol";

contract DeployScript is Script {
    PredictionAMM public predictionAMM;
    MarketFactory public marketFactory;

    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        // Deploy PredictionAMM first
        predictionAMM = new PredictionAMM();
        console.log("PredictionAMM deployed at:", address(predictionAMM));
        
        // Deploy MarketFactory with PredictionAMM address
        marketFactory = new MarketFactory(IPredictionAMM(address(predictionAMM)));
        console.log("MarketFactory deployed at:", address(marketFactory));

        vm.stopBroadcast();
        
        console.log("\n=== Deployment Complete ===");
        console.log("PredictionAMM:", address(predictionAMM));
        console.log("MarketFactory:", address(marketFactory));
    }
}
