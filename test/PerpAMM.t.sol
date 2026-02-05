// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test} from "forge-std/Test.sol";
import {PerpAMM} from "../src/PerpAMM.sol";

contract PerpAMMTest is Test {
    PerpAMM public perpAMM;

    function setUp() public {
        perpAMM = new PerpAMM();
    }

    

    // function test_Increment() public {
    //     counter.increment();
    //     assertEq(counter.number(), 1);
    // }

    // function testFuzz_SetNumber(uint256 x) public {
    //     counter.setNumber(x);
    //     assertEq(counter.number(), x);
    // }
}
