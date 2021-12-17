import { getJSONParams } from "@zilliqa-js/scilla-json-utils";
import { BN } from "@zilliqa-js/util";
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export const expectEvents = (events, want) => {
  if (events === undefined) {
    expect(want).toBe(undefined);
  }

  for (const [index, event] of events.entries()) {
    expect(event._eventname).toBe(want[index].name);
    const wantParams = getJSONParams(want[index].getParams());
    expect(JSON.stringify(event.params)).toBe(JSON.stringify(wantParams));
  }
};

export const expectTransitions = (transitions, want) => {
  if (transitions === undefined) {
    expect(want).toBe(undefined);
  }
  for (const [index, transition] of transitions.entries()) {
    const { msg } = transition;

    want[index].amount &&
      expect(msg._amount).toBe(want[index].amount.toString());
    want[index].recipient && expect(msg._recipient).toBe(want[index].recipient);

    expect(msg._tag).toBe(want[index].tag);
    const wantParams = getJSONParams(want[index].getParams());
    expect(JSON.stringify(msg.params)).toBe(JSON.stringify(wantParams));
  }
};

export const getErrorMsg = (code) =>
  `Exception thrown: (Message [(_exception : (String "Error")) ; (code : (Int32 ${code}))])`;

export const getBNum = async (zilliqa) => {
  const response = await zilliqa.provider.send("GetBlocknum", "");
  return Number(response.result);
};

export const increaseBNum = async (zilliqa, n) =>
  zilliqa.provider.send("IncreaseBlocknum", n);

export class BalanceTracker {
  zilliqa: any;
  accounts: string[];
  balances: BN[];
  zrc2: string | undefined;
  constructor(zilliqa, accounts: string[], config?: any) {
    this.zilliqa = zilliqa;
    this.accounts = accounts;
    this.balances = Array.from({ length: accounts.length });
    this.zrc2 = config?.zrc2;
  }
  async deltas() {
    if (this.zrc2) {
      const state = await this.zilliqa.contracts.at(this.zrc2).getState();

      const deltas = this.accounts.map((addr, i) => {
        const prev = this.balances[i] as BN;
        const cur = new BN(state.balances[addr.toLowerCase()] || "0");
        const delta = cur.sub(prev);
        return [this.accounts[i], delta.toString()];
      });
      return deltas;
    } else {
      const deltas = await Promise.all(
        this.accounts.map(async (addr, i) => {
          const res = await this.zilliqa.blockchain.getBalance(addr);
          const { result } = res;
          if (result === undefined) {
            return 0;
          }
          const prev = this.balances[i] as BN;
          const cur = new BN(result.balance);
          const delta = cur.sub(prev);
          return [this.accounts[i], delta.toString()];
        })
      );
      return deltas;
    }
  }
  async get() {
    if (this.zrc2) {
      const state = await this.zilliqa.contracts.at(this.zrc2).getState();
      const balances = this.accounts.map((addr) => {
        return new BN(state.balances[addr.toLowerCase()] || "0");
      });
      this.balances = balances;
    } else {
      const balances = this.accounts.map(async (addr) => {
        const res = await this.zilliqa.blockchain.getBalance(addr);
        const { result } = res;
        if (result === undefined) {
          return new BN("0");
        }
        return new BN(result.balance);
      });
      this.balances = await Promise.all(balances);
    }
  }
}
