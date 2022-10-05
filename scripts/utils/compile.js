const fs = require('fs')
const util = require('util')
const readFile = util.promisify(fs.readFile)

const compile = async (contractName) => {
  const code = (
    await readFile(process.env.CONTRACTS_DIR + '/' + contractName)
  ).toString()
  return compress(code)
}

const compress = (code) => {
  return code.replace(matchComments, '').replace(matchWhitespace, ' ')
}

const matchComments = /[(][*].*?[*][)]/gs
const matchWhitespace = /\s+/g

exports.compile = compile
exports.compress = compress