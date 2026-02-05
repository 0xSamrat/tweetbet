// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {PredictionAMM} from "../src/PredictionAMM.sol";

contract PredictionAMMTest is Test {
    PredictionAMM public predictionAMM;

    function setUp() public {
        predictionAMM = new PredictionAMM();
    }
}
