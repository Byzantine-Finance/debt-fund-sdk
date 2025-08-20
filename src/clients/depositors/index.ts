// // @ts-check

// /**
//  * Export all staking related clients
//  */

// // Export specialized clients
// export { DepositClient } from "./DepositClient";
// export { WithdrawClient } from "./WithdrawClient";

// Export the main DepositorsClient
export { DepositorsClient } from "./DepositorsClient";

// Export specialized functions for direct use if needed
export * from "./Deposit";
export * from "./Withdraw";
export * from "./Transfer";
