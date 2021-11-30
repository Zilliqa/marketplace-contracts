export const getBNum = async (zilliqa) => {
  const response = await zilliqa.provider.send("GetBlocknum", "");
  return response.result;
};

export const increaseBNum = async (zilliqa, n) => {
  const response = await zilliqa.provider.send("IncreaseBlocknum", n);
  if (!response.result) {
    throw new Error(
      `Failed to advanced block! Error: ${JSON.stringify(response.error)}`
    );
  }
};

export const getUsrDefADTValue = (contractAddress, name, values) =>
  `{"argtypes":[],"arguments":${JSON.stringify(
    values
  )},"constructor":"${contractAddress.toLowerCase()}.${name}"}`;
