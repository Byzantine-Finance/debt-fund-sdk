"use strict";
// @ts-check
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlasherType = exports.DelegatorType = void 0;
// ----------------------------------
// Symbiotic
// ----------------------------------
var DelegatorType;
(function (DelegatorType) {
    DelegatorType[DelegatorType["NETWORK_RESTAKE"] = 0] = "NETWORK_RESTAKE";
    DelegatorType[DelegatorType["FULL_RESTAKE"] = 1] = "FULL_RESTAKE";
    DelegatorType[DelegatorType["OPERATOR_SPECIFIC"] = 2] = "OPERATOR_SPECIFIC";
    DelegatorType[DelegatorType["OPERATOR_NETWORK_SPECIFIC"] = 3] = "OPERATOR_NETWORK_SPECIFIC";
})(DelegatorType || (exports.DelegatorType = DelegatorType = {}));
var SlasherType;
(function (SlasherType) {
    SlasherType[SlasherType["INSTANT"] = 0] = "INSTANT";
    SlasherType[SlasherType["VETO"] = 1] = "VETO";
})(SlasherType || (exports.SlasherType = SlasherType = {}));
// ----------------------------------
