// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.30;

import {Script} from "forge-std/Script.sol";
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
        
        // Deploy MarketFactory with PredictionAMM address
        marketFactory = new MarketFactory(IPredictionAMM(address(predictionAMM)));

        vm.stopBroadcast();
    }
}
