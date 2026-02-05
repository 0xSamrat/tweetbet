// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ERC6909} from "./tokens/ERC6909.sol";
import "./utils/Math.sol";
import "./utils/TransferHelper.sol";

contract PredictionAMM is ERC6909 {

    uint256 constant MINIMUM_LIQUIDITY = 1000;
    uint256 constant MAX_FEE = 10000;

    mapping(uint256 poolId => Pool) public pools;

    struct PoolKey {
        uint256 id0;
        uint256 id1;
        address token0;
        address token1;
        uint256 feeOrHook;
    }

    struct Pool {
        uint112 reserve0;
        uint112 reserve1;
        uint32 blockTimestampLast;
        uint256 price0CumulativeLast;
        uint256 price1CumulativeLast;
        uint256 kLast;
        uint256 supply;
    }

    error Reentrancy();

    modifier lock() {
        assembly ("memory-safe") {
            if tload(0x929eee149b4bd21268) {
                mstore(0x00, 0xab143c06)
                revert(0x1c, 0x04)
            }
            tstore(0x929eee149b4bd21268, address())
        }
        _;
        assembly ("memory-safe") {
            tstore(0x929eee149b4bd21268, 0)
        }
    }

    error Expired();
    error InvalidMsgVal();
    error InsufficientLiquidity();
    error InsufficientInputAmount();
    error InsufficientOutputAmount();
    error Overflow();

    /* ───────────────── INTERNAL TRANSFER HELPERS ───────────────── */

    function _safeTransfer(address token, address to, uint256 id, uint256 amount) internal {
        if (token == address(this)) {
            _mint(to, id, amount);
        } else if (token == address(0)) {
            safeTransferETH(to, amount);
        } else if (id == 0) {
            safeTransfer(token, to, amount);
        } else {
            ERC6909(token).transfer(to, id, amount);
        }
    }

    function _safeTransferFrom(
        address token,
        address from,
        address to,
        uint256 id,
        uint256 amount
    ) internal {
        // First try to use transient balance (from deposit())
        if (_useTransientBalance(token, id, amount)) {
            return; // Tokens already in contract from deposit()
        }
        
        if (token == address(this)) {
            _burn(from, id, amount);
        } else if (id == 0) {
            safeTransferFrom(token, from, to, amount);
        } else {
            ERC6909(token).transferFrom(from, to, id, amount);
        }
    }

    /* ───────────────── CORE INTERNAL LOGIC ───────────────── */

    function _update(
        Pool storage pool,
        uint256,
        uint256 balance0,
        uint256 balance1,
        uint112 reserve0,
        uint112 reserve1
    ) internal {
        unchecked {
            require(balance0 <= type(uint112).max, Overflow());
            require(balance1 <= type(uint112).max, Overflow());

            uint32 blockTimestamp = uint32(block.timestamp % 2 ** 32);
            uint32 timeElapsed = blockTimestamp - pool.blockTimestampLast;

            if (timeElapsed > 0 && reserve0 != 0 && reserve1 != 0) {
                pool.price0CumulativeLast += uint256(uqdiv(encode(reserve1), reserve0)) * timeElapsed;
                pool.price1CumulativeLast += uint256(uqdiv(encode(reserve0), reserve1)) * timeElapsed;
            }

            pool.blockTimestampLast = blockTimestamp;
            pool.reserve0 = uint112(balance0);
            pool.reserve1 = uint112(balance1);
        }
    }

    function _getPoolId(PoolKey calldata poolKey) internal pure returns (uint256 poolId) {
        assembly ("memory-safe") {
            let m := mload(0x40)
            calldatacopy(m, poolKey, 0xa0)
            poolId := keccak256(m, 0xa0)
        }
    }

    function _getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut,
        uint256 swapFee
    ) internal pure returns (uint256 amountOut) {
        uint256 amountInWithFee = amountIn * (10000 - swapFee);
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 10000) + amountInWithFee;
        return numerator / denominator;
    }

    function _getAmountIn(
        uint256 amountOut,
        uint256 reserveIn,
        uint256 reserveOut,
        uint256 swapFee
    ) internal pure returns (uint256 amountIn) {
        uint256 numerator = reserveIn * amountOut * 10000;
        uint256 denominator = (reserveOut - amountOut) * (10000 - swapFee);
        return (numerator / denominator) + 1;
    }

    /* ───────────────── TRANSIENT BALANCE ───────────────── */

    function deposit(address token, uint256 id, uint256 amount) public payable {
        require(msg.value == (token == address(0) ? amount : 0), InvalidMsgVal());
        if (token != address(0)) _safeTransferFrom(token, msg.sender, address(this), id, amount);

        assembly ("memory-safe") {
            let m := mload(0x40)
            mstore(0x00, caller())
            mstore(0x20, token)
            mstore(0x40, id)
            let slot := keccak256(0x00, 0x60)
            tstore(slot, add(tload(slot), amount))
            mstore(0x40, m)
        }
    }

    function _useTransientBalance(address token, uint256 id, uint256 amount)
        internal
        returns (bool credited)
    {
        assembly ("memory-safe") {
            let m := mload(0x40)
            mstore(0x00, caller())
            mstore(0x20, token)
            mstore(0x40, id)
            let slot := keccak256(0x00, 0x60)
            let bal := tload(slot)
            if iszero(lt(bal, amount)) {
                tstore(slot, sub(bal, amount))
                credited := 1
            }
            mstore(0x40, m)
        }
    }

    function recoverTransientBalance(address token, uint256 id, address to)
        public
        lock
        returns (uint256 amount)
    {
        assembly ("memory-safe") {
            let m := mload(0x40)
            mstore(0x00, caller())
            mstore(0x20, token)
            mstore(0x40, id)
            let slot := keccak256(0x00, 0x60)
            amount := tload(slot)
            if amount { tstore(slot, 0) }
            mstore(0x40, m)
        }

        if (amount != 0) _safeTransfer(token, to, id, amount);
    }

    /* ───────────────── SWAPS ───────────────── */

    function swapExactIn(
        PoolKey calldata poolKey,
        uint256 amountIn,
        uint256 amountOutMin,
        bool zeroForOne,
        address to,
        uint256 deadline
    ) public payable lock returns (uint256 amountOut) {

        require(deadline >= block.timestamp, Expired());
        require(amountIn != 0, InsufficientInputAmount());

        uint256 poolId = _getPoolId(poolKey);
        Pool storage pool = pools[poolId];

        (uint112 reserve0, uint112 reserve1) = (pool.reserve0, pool.reserve1);

        if (zeroForOne) {
            amountOut = _getAmountOut(amountIn, reserve0, reserve1, poolKey.feeOrHook);

            require(amountOut >= amountOutMin, InsufficientOutputAmount());
            require(amountOut < reserve1, InsufficientLiquidity());

            _safeTransferFrom(poolKey.token0, msg.sender, address(this), poolKey.id0, amountIn);
            _safeTransfer(poolKey.token1, to, poolKey.id1, amountOut);

            _update(pool, poolId, reserve0 + amountIn, reserve1 - amountOut, reserve0, reserve1);
        } else {
            amountOut = _getAmountOut(amountIn, reserve1, reserve0, poolKey.feeOrHook);

            require(amountOut >= amountOutMin, InsufficientOutputAmount());
            require(amountOut < reserve0, InsufficientLiquidity());

            _safeTransferFrom(poolKey.token1, msg.sender, address(this), poolKey.id1, amountIn);
            _safeTransfer(poolKey.token0, to, poolKey.id0, amountOut);

            _update(pool, poolId, reserve0 - amountOut, reserve1 + amountIn, reserve0, reserve1);
        }
    }

    function swapExactOut(
        PoolKey calldata poolKey,
        uint256 amountOut,
        uint256 amountInMax,
        bool zeroForOne,
        address to,
        uint256 deadline
    ) public payable lock returns (uint256 amountIn) {

        require(deadline >= block.timestamp, Expired());
        uint256 poolId = _getPoolId(poolKey);
        Pool storage pool = pools[poolId];

        (uint112 reserve0, uint112 reserve1) = (pool.reserve0, pool.reserve1);

        if (zeroForOne) {
            amountIn = _getAmountIn(amountOut, reserve0, reserve1, poolKey.feeOrHook);
            require(amountIn <= amountInMax, InsufficientInputAmount());

            _safeTransferFrom(poolKey.token0, msg.sender, address(this), poolKey.id0, amountIn);
            _safeTransfer(poolKey.token1, to, poolKey.id1, amountOut);

            _update(pool, poolId, reserve0 + amountIn, reserve1 - amountOut, reserve0, reserve1);
        } else {
            amountIn = _getAmountIn(amountOut, reserve1, reserve0, poolKey.feeOrHook);
            require(amountIn <= amountInMax, InsufficientInputAmount());

            _safeTransferFrom(poolKey.token1, msg.sender, address(this), poolKey.id1, amountIn);
            _safeTransfer(poolKey.token0, to, poolKey.id0, amountOut);

            _update(pool, poolId, reserve0 - amountOut, reserve1 + amountIn, reserve0, reserve1);
        }
    }

    /* ───────────────── LIQUIDITY ───────────────── */

    function addLiquidity(
        PoolKey calldata poolKey,
        uint256 amount0Desired,
        uint256 amount1Desired,
        uint256,
        uint256,
        address to,
        uint256 deadline
    ) public payable lock returns (uint256 amount0, uint256 amount1, uint256 liquidity) {

        require(deadline >= block.timestamp, Expired());

        uint256 poolId = _getPoolId(poolKey);
        Pool storage pool = pools[poolId];

        (uint112 reserve0, uint112 reserve1, uint256 supply) =
            (pool.reserve0, pool.reserve1, pool.supply);

        amount0 = amount0Desired;
        amount1 = amount1Desired;

        _safeTransferFrom(poolKey.token0, msg.sender, address(this), poolKey.id0, amount0);
        _safeTransferFrom(poolKey.token1, msg.sender, address(this), poolKey.id1, amount1);

        if (supply == 0) {
            liquidity = sqrt(amount0 * amount1) - MINIMUM_LIQUIDITY;
            _initMint(to, poolId, liquidity);
            pool.supply = liquidity + MINIMUM_LIQUIDITY;
        } else {
            liquidity = min(
                mulDiv(amount0, supply, reserve0),
                mulDiv(amount1, supply, reserve1)
            );

            _mint(to, poolId, liquidity);
            pool.supply += liquidity;
        }

        _update(pool, poolId, reserve0 + amount0, reserve1 + amount1, reserve0, reserve1);
    }

    function removeLiquidity(
        PoolKey calldata poolKey,
        uint256 liquidity,
        uint256,
        uint256,
        address to,
        uint256 deadline
    ) public lock returns (uint256 amount0, uint256 amount1) {

        require(deadline >= block.timestamp, Expired());

        uint256 poolId = _getPoolId(poolKey);
        Pool storage pool = pools[poolId];

        (uint112 reserve0, uint112 reserve1) = (pool.reserve0, pool.reserve1);

        amount0 = mulDiv(liquidity, reserve0, pool.supply);
        amount1 = mulDiv(liquidity, reserve1, pool.supply);

        _burn(msg.sender, poolId, liquidity);
        pool.supply -= liquidity;

        _safeTransfer(poolKey.token0, to, poolKey.id0, amount0);
        _safeTransfer(poolKey.token1, to, poolKey.id1, amount1);

        _update(pool, poolId, reserve0 - amount0, reserve1 - amount1, reserve0, reserve1);
    }
}
