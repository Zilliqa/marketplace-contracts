import { scillaJSONParams } from "@zilliqa-js/scilla-json-utils";
import { BN } from "@zilliqa-js/util";
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export class BalanceTracker {
  zilliqa: any;
  keys: string[];
  prevMap: { [x: string]: string };
  getMap: (keys: string[]) => Promise<{}>;

  constructor(
    zilliqa,
    keys: string[],
    getMap: (keys: string[]) => Promise<{}>
  ) {
    this.zilliqa = zilliqa;
    this.keys = keys.map((x) => x.toLowerCase());
    this.prevMap = {};
    this.getMap = getMap;
  }

  async deltas() {
    const curMap = await this.getMap(this.keys);

    const deltas = this.keys.map((k) => {
      const prev = new BN(this.prevMap[k] as string);
      const cur = new BN(curMap[k] || "0");
      const delta = cur.sub(prev);
      return [k, delta.toString()];
    });
    return deltas;
  }

  async init() {
    const map = await this.getMap(this.keys);
    this.prevMap = {};

    Object.keys(map).forEach((k) => {
      this.prevMap[k.toLowerCase()] = map[k];
    });
  }
}

export const zilBalancesGetter = (zilliqa) => async (accounts) => {
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

  const result = {};
  balances.forEach((cur, i) => {
    result[accounts[i]] = cur;
  });

  return result;
};

export const zrc2BalancesGetter =
  (zilliqa, contractAddress) => async (accounts) => {
    const state = await zilliqa.contracts.at(contractAddress).getState();
    const result = {};
    accounts.forEach((addr) => {
      result[addr] = state.balances[addr.toLowerCase()] || "0";
    });
    return result;
  };

export const zrc2AllowncesGetter =
  (zilliqa, contractAddress) => async (accounts) => {
    const state = await zilliqa.contracts.at(contractAddress).getState();
    const result = {};
    accounts.forEach((cur) => {
      const [tokenOwner, spender] = cur.split(",").map((x) => x.toLowerCase());

      result[cur] = state.allowances[tokenOwner][spender] || "0";
    });
    return result;
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
    const wantParams = scillaJSONParams(want[index].getParams());
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
    const wantParams = scillaJSONParams(want[index].getParams());
    expect(JSON.stringify(msg.params)).toBe(JSON.stringify(wantParams));
  }
};

export const expectDeltas = (deltas, want, tx?, sender?: string) => {
  const deltasExpected = Object.keys(want).reduce((acc, cur) => {
    acc[cur.toLowerCase()] = want[cur];
    return acc;
  }, {});

  deltas.forEach(([key, delta]) => {
    if (tx && key === sender?.toLowerCase()) {
      const txFee = new BN(tx.receipt.cumulative_gas).mul(tx.gasPrice);
      const deltaWithFee = new BN(delta).add(txFee);
      expect(`${key}:${deltaWithFee.toString()}`).toBe(
        `${key}:${deltasExpected[key]?.toString()}`
      );
    } else {
      expect(`${key}:${delta}`).toBe(
        `${key}:${deltasExpected[key]?.toString()}`
      );
    }
  });
};

export const expectTokenOwners = async (tokenOwners, want) => {
  Object.keys(want).forEach((k) => {
    expect(tokenOwners[k.toLowerCase()]).toBe(want[k].toLowerCase());
  });
};
