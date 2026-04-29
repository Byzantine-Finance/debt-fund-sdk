/**
 * Shared test fixtures — deterministic addresses and constants reused
 * across unit tests.
 *
 * All addresses are lowercase to skip ethers' EIP-55 checksum validation.
 */

export const ADDR_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
export const ADDR_B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
export const ADDR_C = "0xcccccccccccccccccccccccccccccccccccccccc";
export const ADDR_D = "0xdddddddddddddddddddddddddddddddddddddddd";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
export const DEAD_ADDRESS = "0x000000000000000000000000000000000000dead";

/** A bytes32 of all zeros — handy as a placeholder idData / id. */
export const ID_DATA_ZERO =
	"0x0000000000000000000000000000000000000000000000000000000000000000";

/** Arbitrary non-empty calldata blob for tests that don't care about content. */
export const RAW_DATA = "0xdeadbeef";

/** Two random-looking 32-byte values useful as ECDSA r / s components. */
export const SIGNATURE_R =
	"0x1111111111111111111111111111111111111111111111111111111111111111";
export const SIGNATURE_S =
	"0x2222222222222222222222222222222222222222222222222222222222222222";
