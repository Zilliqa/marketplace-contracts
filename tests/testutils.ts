import { getJSONParams } from "@zilliqa-js/scilla-json-utils";
import { BN } from "@zilliqa-js/util";
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const logDelta = (want, got) =>
  console.log(
    "\x1b[32m",
    `\nExpected: ${want}`,
    "\x1b[31m",
    `\nReceived: ${got}`
  );

export const verifyEvents = (events, want) => {
  if (events === undefined) {
    return want === undefined;
  }

  for (const [index, event] of events.entries()) {
    if (event._eventname !== want[index].name) {
      logDelta(want[index].name, event._eventname);
      return false;
    }

    const wantParams = getJSONParams(want[index].getParams());

    if (JSON.stringify(event.params) !== JSON.stringify(wantParams)) {
      logDelta(wantParams, JSON.stringify(event.params));
      return false;
    }
  }
  return true;
};

export const verifyTransitions = (transitions, want) => {
  if (transitions === undefined) {
    return want === undefined;
  }
  for (const [index, transition] of transitions.entries()) {
    const { msg } = transition;

    if (want[index].amount && msg._amount !== want[index].amount.toString()) {
      logDelta(want[index].amount.toString(), msg._amount);
      return false;
    }

    if (want[index].recipient && msg._recipient !== want[index].recipient) {
      logDelta(want[index].recipient, msg._recipient);
      return false;
    }

    if (msg._tag !== want[index].tag) {
      logDelta(want[index].tag, msg._tag);
      return false;
    }

    const wantParams = getJSONParams(want[index].getParams());

    if (JSON.stringify(msg.params) !== JSON.stringify(wantParams)) {
      logDelta(wantParams, JSON.stringify(msg.params));
      return false;
    }
  }
  return true;
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
  constructor(zilliqa, accounts: string[]) {
    this.zilliqa = zilliqa;
    this.accounts = accounts;
    this.balances = Array.from({ length: accounts.length });
  }
  async deltas() {
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
  async get() {
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
