import { 
  isName, 
  toPrimaryName, 
  displayFingerprint, 
  toNameKey,
  isCryptoName,
  isXPub,
  isFingerprintedName,
  parseName,
  isMnemonicPassphrase,
  nameKeyToPrimaryKey,
  nameKeyToFingerprintedName,
  nameKeyToFingerprint
} from "@onamea/types"
import { getPositionalArg, getArgByName, hasArg } from "./lib/args.ts"
import createWorkerPool from "./createWorkerPool.ts"

const nameArg = getPositionalArg(Deno.args)
const cryptoName = getArgByName("crypto", Deno.args, "Schnorr")
const xPub = getArgByName("xpub", Deno.args)
const passphrase = getArgByName("passphrase", Deno.args)
const shouldGenerateMnemonic = hasArg("mnemonic", Deno.args) || passphrase !== undefined

if (nameArg === undefined) {
  console.error("No name provided")
  Deno.exit(1)
}
if (isName(nameArg) === false && isFingerprintedName(nameArg) === false) {
  console.error(`Invalid Name or FingerprintedName: ${ nameArg }`)
  Deno.exit(1)
}

if (isCryptoName(cryptoName) === false) {
  console.error(`Unsupported crypto name: ${ cryptoName } (Ed25519, ECDSA, Schnorr are supported)`)
  Deno.exit(1)
}

if (xPub !== undefined && isXPub(xPub) === false) {
  console.error(`Invalid XPub: ${ xPub }`)
  Deno.exit(1)
}

if (passphrase !== undefined && isMnemonicPassphrase(passphrase) === false) {
  console.error(`Invalid passphrase: ${ passphrase } (must be a non empty string)`)
  Deno.exit(1)
}

// Search string

const [name, fingerprintDisplay] = parseName(nameArg)

console.log(`Searching for: ${ nameArg } (${ name }, ${ toPrimaryName(name) }, ${ fingerprintDisplay })`)

const numWorkers = undefined
const url = undefined
const throttleLimit = undefined

try {

  const { promise, abort } = createWorkerPool(
    cryptoName,
    name, 
    fingerprintDisplay,
    numWorkers, 
    url, 
    workerPoolStatus => { console.log(`${ workerPoolStatus.totalAttempts } guesses (${ workerPoolStatus.attemptsPerSecond }/second)`) },
    throttleLimit,
    shouldGenerateMnemonic,
    passphrase,
    xPub
  )

  // Clean up
  Deno.addSignalListener("SIGINT", () => {
    abort()
    Deno.exit()
  })

  const result = await promise

  if (result === undefined) {
    console.error("createWorkerPool returned undefined result")
    Deno.exit(1)
  }

  const { privateKey, privateKeyDisplay, publicKey, publicKeyDisplay, mnemonicDisplay, nameKey, index } = result
  const primaryKey = nameKeyToPrimaryKey(nameKey)
  const fingerprintedName = await nameKeyToFingerprintedName(nameKey)

  console.log(`\nName found!: ${ fingerprintedName }`)

  console.log("\n================================\n")

  console.log("Name:", name)
  console.log("NameKey:", toNameKey(name, primaryKey))
  console.log("FingerprintedName:", fingerprintedName)
  console.log("Fingerprint:", displayFingerprint(await nameKeyToFingerprint(nameKey)))
  console.log("PrimaryKey:", primaryKey)
  console.log("PublicKeyDisplay:", publicKeyDisplay)
  console.log(`PublicKey (${ cryptoName }):`, publicKey)

  console.log("\n================================\n")

  if (privateKey !== undefined) {
    console.log(`PrivateKey (${ cryptoName }):`, privateKey)
    console.log("PrivateKeyDisplay:", privateKeyDisplay)
    if (mnemonicDisplay !== undefined) {
      console.log("MnemonicDisplay:", mnemonicDisplay)
    }
    if (passphrase !== undefined) {
      console.log("Passphrase:", passphrase)
    }
  } else if (xPub !== undefined) {
    console.log("xpub:", xPub)
    if (index === undefined) {
      console.error("Index is undefined despite xPub being provided")
    } else {
      console.log("Index:", index)
    }
  }

  Deno.exit(0)

} catch (error) {
  console.error(error)
  Deno.exit(1)
}
