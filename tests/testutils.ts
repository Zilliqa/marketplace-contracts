import { getJSONParams } from "@zilliqa-js/scilla-json-utils";
import { BN } from "@zilliqa-js/util";
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export class BalanceTracker {
  zilliqa: any;
  accounts: string[];
  prevMap: { [x: string]: string };
  getBalanceMap: (accounts: string[]) => Promise<{}>;

  constructor(
    zilliqa,
    accounts: string[],
    getBalanceMap: (accounts: string[]) => Promise<{}>
  ) {
    this.zilliqa = zilliqa;
    this.accounts = accounts.map((x) => x.toLowerCase());
    this.prevMap = {};
    this.getBalanceMap = getBalanceMap;
  }

  async deltas() {
    const curMap = await this.getBalanceMap(this.accounts);

    const deltas = this.accounts.map((k) => {
      const prev = new BN(this.prevMap[k] as string);
      const cur = new BN(curMap[k] || "0");
      const delta = cur.sub(prev);
      return [k, delta.toString()];
    });
    return deltas;
  }

  async get() {
    const map = await this.getBalanceMap(this.accounts);
    const balanceMap = {};
    Object.keys(map).forEach((k) => {
      balanceMap[k.toLowerCase()] = map[k];
    });

    this.prevMap = balanceMap;
  }
}

export const zilBalanceGetter = (zilliqa) => async (accounts) => {
  const balances = await Promise.all(
    accounts.map(async (addr) => {
      const res = await zilliqa.blockchain.getBalance(addr);
      const { result } = res;
      if (result === undefined) {
        return "0";
      }
      return result.balance;
    })
  );

  const balanceMap = {};
  balances.forEach((cur, i) => {
    balanceMap[accounts[i]] = cur;
  });

  return balanceMap;
};

export const zrc2BalancesGetter =
  (zilliqa, contractAddress) => async (accounts) => {
    const state = await zilliqa.contracts.at(contractAddress).getState();
    const balanceMap = {};
    accounts.forEach((addr) => {
      balanceMap[addr] = state.balances[addr.toLowerCase()] || "0";
    });
    return balanceMap;
  };

export const zrc2AllowncesGetter =
  (zilliqa, contractAddress) => async (accounts) => {
    const state = await zilliqa.contracts.at(contractAddress).getState();
    const balanceMap = {};
    accounts.forEach((cur) => {
      const [tokenOwner, spender] = cur.split(",").map((x) => x.toLowerCase());

      balanceMap[cur] = state.allowances[tokenOwner][spender] || "0";
    });
    return balanceMap;
  };

export const getErrorMsg = (code) =>
  `Exception thrown: (Message [(_exception : (String "Error")) ; (code : (Int32 ${code}))])`;

export const getBNum = async (zilliqa) => {
  const response = await zilliqa.provider.send("GetBlocknum", "");
  return Number(response.result);
};

export const increaseBNum = async (zilliqa, n) =>
  zilliqa.provider.send("IncreaseBlocknum", n);

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

export const expectDeltas = (deltas, want, tx?, sender?: string) => {
  const deltasExpected = Object.keys(want).reduce((acc, cur) => {
    acc[cur.toLowerCase()] = want[cur];
    return acc;
  }, {});

  deltas.forEach(([account, delta]) => {
    if (tx && account === sender?.toLowerCase()) {
      const txFee = new BN(tx.receipt.cumulative_gas).mul(tx.gasPrice);
      const deltaWithFee = new BN(delta).add(txFee);
      expect(`${account}:${deltaWithFee.toString()}`).toBe(
        `${account}:${deltasExpected[account]?.toString()}`
      );
    } else {
      expect(`${account}:${delta}`).toBe(
        `${account}:${deltasExpected[account]?.toString()}`
      );
    }
  });
};
