const { default: BigNumber } = require('bignumber.js')

function inputFor(outputAmt, inputReserv, outputReserv, afterFee) {
  let n1 = new BigNumber(inputReserv).multipliedBy(new BigNumber(outputAmt))
  let numerator = n1.multipliedBy(new BigNumber('10000'))
  let d1 = new BigNumber(outputReserv).minus(new BigNumber(outputAmt))
  let denominator = d1.multipliedBy(new BigNumber(afterFee))
  let res = numerator.dividedBy(denominator)
  return res.integerValue(BigNumber.ROUND_FLOOR)
}

function outputFor(inputAmt, inputReserv, outputReserv, afterFee) {
  const inputAmtAfterFee = new BigNumber(inputAmt).multipliedBy(
    new BigNumber(afterFee)
  )
  const numerator = inputAmtAfterFee.multipliedBy(new BigNumber(outputReserv))
  const d1 = new BigNumber(inputReserv).multipliedBy(new BigNumber('10000'))
  const denominator = d1.plus(inputAmtAfterFee)
  const res = numerator.dividedBy(denominator)
  return res
    .integerValue(BigNumber.ROUND_FLOOR)
    .integerValue(BigNumber.ROUND_FLOOR)
    .toString()
}

async function getFraction(d, x, y) {
  return new BigNumber(d)
    .multipliedBy(new BigNumber(y))
    .dividedBy(new BigNumber(x))
    .integerValue(BigNumber.ROUND_FLOOR)
    .toString()
}


async function getBlockNumber(zilliqa) {
  const response = await zilliqa.provider.send("GetBlocknum", "");
  return Number(response.result);
};

async function calculateMinToken0AmtForRemoveLiquidity(
  token0ContribAmt,
  totalContrib,
  token0Reserve
) {
  const newContribution = await getFraction(
    token0ContribAmt,
    totalContrib,
    token0Reserve
  )
  return new BigNumber(newContribution)
    .integerValue(BigNumber.ROUND_FLOOR)
    .toString()
}

async function calculateMinToken1AmtForRemoveLiquidity(
  token0ContribAmt,
  totalContrib,
  token1Reserve
) {
  const newContribution = await getFraction(
    token0ContribAmt,
    totalContrib,
    token1Reserve
  )
  return new BigNumber(newContribution)
    .integerValue(BigNumber.ROUND_FLOOR)
    .toString()
}

async function calculateMaxToken1AmountForAddLiquidity(
  token0Amt,
  token0Reserve,
  token1Reserve
) {
  const result = await getFraction(token0Amt, token0Reserve, token1Reserve)
  const deltaY = new BigNumber(result)
    .plus(new BigNumber('1'))
    .integerValue(BigNumber.ROUND_FLOOR)
    .toString()
  return deltaY
}

async function calculateMinToken0AmountForAddLiquidity(
  token0Amt,
  token0Reserve,
  totalContribution
) {
  const newContribution = await getFraction(
    token0Amt,
    token0Reserve,
    totalContribution
  )
  return new BigNumber(newContribution)
    .integerValue(BigNumber.ROUND_FLOOR)
    .toString()
}

async function removeLiquidityMinToken0Amt(
  contribAmount,
  totalContribAmount,
  token0Reserve
) {
  return await getFraction(contribAmount, totalContribAmount, token0Reserve)
}

async function removeLiquidityMinToken1Amt(
  contribAmount,
  totalContribAmount,
  token1Reserve
) {
  return await getFraction(contribAmount, totalContribAmount, token1Reserve)
}

function mulDiv(x, y, z) {
  return new BigNumber(x)
    .multipliedBy(new BigNumber(y))
    .dividedBy(new BigNumber(z))
    .integerValue(BigNumber.ROUND_FLOOR)
    .toString()
}

exports.calculateMinToken1AmtForRemoveLiquidity =
  calculateMinToken1AmtForRemoveLiquidity
exports.calculateMinToken0AmtForRemoveLiquidity =
  calculateMinToken0AmtForRemoveLiquidity
exports.calculateMaxToken1AmountForAddLiquidity =
  calculateMaxToken1AmountForAddLiquidity
exports.calculateMinToken0AmountForAddLiquidity =
  calculateMinToken0AmountForAddLiquidity
exports.outputFor = outputFor
exports.inputFor = inputFor
exports.removeLiquidityMinToken0Amt = removeLiquidityMinToken0Amt
exports.removeLiquidityMinToken1Amt = removeLiquidityMinToken1Amt
exports.mulDiv = mulDiv
exports.getBlockNumber = getBlockNumber
