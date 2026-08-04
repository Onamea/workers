import type { CryptoName, XPub, Name, FingerprintDisplay, MnemonicPassphrase, NameKey } from "@vanice/types"
import { isCryptoName, isFingerprintDisplay, isName, maxIndex, fromFingerprintDisplay, toPrimaryName, publicKeyToPrimaryKey, toNameKey } from "@vanice/types"
import { type Result, spawnWorker } from "./spawnWorker.ts"
import { type WorkerPoolStatus, type WorkerStatus, createWorkerPoolStatus, updateWorkerPoolStatus } from "./Status.ts"
import throttle from "./lib/throttle.ts"

type WorkerPoolResult = Result & {
  nameKey: NameKey
}

const createWorkerPoolResult = (name: Name, result: Result): WorkerPoolResult => {
  const primaryKey = publicKeyToPrimaryKey(result.cryptoName, result.publicKey)
  const nameKey = toNameKey(name, primaryKey)
  return {
    ...result,
    nameKey
  }
}

type WorkerPoolStatusChangeCallback = (status: WorkerPoolStatus) => void

export default (
  cryptoName: CryptoName,
  name: Name, 
  fingerprintDisplay?: FingerprintDisplay,
  numWorkers = 8, 
  url?: URL,
  onWorkerPoolStatusChange?: WorkerPoolStatusChangeCallback,
  throttleLimit = 1000,
  shouldGenerateMnemonic = false,
  mnemonicPassphrase?: MnemonicPassphrase,
  xPub?: XPub,
  progressIntervalMs = 100
): { promise: Promise<WorkerPoolResult | void>, abort: () => void } => {

  if (isCryptoName(cryptoName) === false) { 
    throw new Error(`Unsupported CryptoName: ${ cryptoName } (Ed25519, ECDSA, Schnorr are supported)`)
  }

  if (isName(name) === false) {
    throw new Error(`Invalid Name: ${ name }`)
  }

  if (fingerprintDisplay !== undefined && isFingerprintDisplay(fingerprintDisplay) === false) {
    throw new Error(`Invalid Fingerprint: ${ fingerprintDisplay }`)
  }

  const primaryName = toPrimaryName(name)
  const fingerprint = fingerprintDisplay ? fromFingerprintDisplay(fingerprintDisplay) : undefined

  const promises: Promise<Result>[] = []
  const terminationMethods: (() => void)[] = []
  const workerPoolStatus = createWorkerPoolStatus()

  const terminateAll = () => {
    terminationMethods.forEach(terminate => terminate())
  }

  const throttledOnWorkerPoolStatusChange = onWorkerPoolStatusChange ? throttle(onWorkerPoolStatusChange, throttleLimit) : undefined

  const statusChangeCallback = (status: WorkerStatus) => {
    updateWorkerPoolStatus(workerPoolStatus, status)
    throttledOnWorkerPoolStatusChange?.(workerPoolStatus)
  }

  const totalAttempts = maxIndex 
  const maxAttemptsPerWorker = Math.ceil(totalAttempts / numWorkers)

  for (let i = 0; i < numWorkers; i++) {

    const offset = i * maxAttemptsPerWorker
    
    const [status, promise, terminationMethod] = spawnWorker(
      cryptoName, 
      i, 
      primaryName, 
      fingerprint,
      url, 
      statusChangeCallback, 
      shouldGenerateMnemonic,
      mnemonicPassphrase,
      xPub, 
      maxAttemptsPerWorker, 
      offset,
      progressIntervalMs
    )
    workerPoolStatus.workers.push(status)
    promises.push(promise)
    terminationMethods.push(terminationMethod)
  }

  const abortController = new AbortController()
  const { signal } = abortController

  const abortPromise = new Promise<never>((_, reject) => {
    signal.addEventListener("abort", () => {
      terminateAll()
      reject(new DOMException("Aborted", "AbortError"))
    })
  })

  const abort = () => {
    abortController.abort()
  }

  const promise = Promise.race([
    Promise.any(promises).then(result => {
      // Terminate all other workers
      terminateAll()
      return createWorkerPoolResult(name, result)
    }).catch(() => {
      if (xPub !== undefined) {
        throw new Error("XPub derivation exhausted")
      } else {
        throw new Error("All workers failed")
      }
    }),
    abortPromise
  ])

  return { promise, abort }
}
