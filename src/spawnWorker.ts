import type { PrimaryChars, CryptoName, XPub, Fingerprint, MnemonicPassphrase } from "@vanice/types"
import type { SuccessMessage, ProgressMessage } from "./worker.ts"
import type { WorkerStatus } from "./Status.ts"
import isDeno from "./lib/isDeno.ts"
import type { KeyPair } from "./generateKeyPair.ts"

export type Result = KeyPair & {
  xPub?: XPub
  index?: number
}

export type WorkerId = number
type WorkerMessage = SuccessMessage | ProgressMessage
type StatusChangeCallback = (status: WorkerStatus) => void

const displayNum = (num: number) => num + 1

const defaultUrl = new URL(isDeno ? "./worker.ts" : "/worker.js", import.meta.url)

export const spawnWorker = (
  cryptoName: CryptoName,
  id: WorkerStatus["workerId"], 
  primaryName: PrimaryChars, 
  fingerprint?: Fingerprint,
  url: URL = defaultUrl,
  onStatusChange: StatusChangeCallback = () => {},
  shouldGenerateMnemonic = false,
  mnemonicPassphrase?: MnemonicPassphrase,
  xPub?: XPub,
  offset?: number,
  maxAttempts?: number,
  progressIntervalMs = 100
) : [WorkerStatus, Promise<Result>, () => void] => {

  const status: WorkerStatus = {
    workerId: id,
    errors: [],
    start: Date.now(),
    attempts: 0
  }

  let workerInstance: Worker

  const terminate = () => {
    if (workerInstance) {
      console.log(`Terminating worker ${ displayNum(id) }...`)
      workerInstance.terminate()
    }
  }

  const MAX_RESPAWNS = 12
  let respawnCount = 0

  return [status, new Promise((resolve, reject) => {

    const spawnNewWorker = () => {

      const worker = new Worker(
        url.href,
        { type: "module" }
      )

      worker.onerror = (error) => {
        status.errors.push({ datetime: Date.now(), error })
        onStatusChange(status)
        terminate()
        if (respawnCount >= MAX_RESPAWNS) {
          reject(new Error(`Worker ${ displayNum(id) } failed ${ MAX_RESPAWNS } times and will not be respawned.`))
          return
        }
        respawnCount++
        setTimeout(() => {
          workerInstance = spawnNewWorker()
        }, 1000)
      }

      worker.onmessage = (event: MessageEvent) => {
        const { success } = event.data as WorkerMessage
        if (success) {
          const { cryptoName, privateKey, privateKeyDisplay, publicKey, publicKeyDisplay, mnemonicDisplay, xPub, index } = event.data as SuccessMessage
          if (privateKey !== undefined) {
            resolve({
              cryptoName,
              privateKey,
              privateKeyDisplay,
              publicKey,
              publicKeyDisplay,
              mnemonicDisplay,
              mnemonicPassphrase
            })
          } else if (xPub !== undefined && index !== undefined) {
            resolve({
              cryptoName,
              publicKey,
              publicKeyDisplay,
              xPub,
              index
            })
          }
        } else {
          if ("maxAttemptsReached" in event.data) {
            terminate()
            reject(new Error(`Worker ${ displayNum(id) } reached max attempts without finding a match.`))
          }
          const { totalAttempts } = event.data as ProgressMessage
          status.attempts = totalAttempts
          onStatusChange(status)
        }
      }

      worker.postMessage({
        cryptoName,
        primaryName,
        fingerprint,
        shouldGenerateMnemonic,
        mnemonicPassphrase,
        xPub,
        offset,
        maxAttempts,
        progressIntervalMs
      })
      return worker
    }

    workerInstance = spawnNewWorker()
  }), terminate]
}
