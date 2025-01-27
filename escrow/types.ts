import { Address, Asset } from '@meshsdk/core';

// Match the Aiken contract types
export type MValue = {
  [policyId: string]: {
    [assetName: string]: bigint;
  };
};

export type EscrowDatum = {
  Initiation: {
    initiator: Address;
    initiator_assets: MValue;
  } | {
    ActiveEscrow: {
      initiator: Address;
      initiator_assets: MValue;
      recipient: Address;
      recipient_assets: MValue;
    }
  };
};

export type EscrowRedeemer = {
  RecipientDeposit: {
    recipient: Address;
    recipient_assets: MValue;
  } | {
    CancelTrade: null;
  } | {
    CompleteTrade: null;
  };
};

export type EscrowState = {
  status: 'NONE' | 'INITIATED' | 'ACTIVE';
  utxo?: any;
  datum?: EscrowDatum;
};
