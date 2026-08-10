import { type XPub, publicKeyToFingerprint, publicKeyToPrimaryKey } from "@onamea/types"
import { type KeyPair, generateKeyPair } from "./generateKeyPair.ts"
import equalArrays from "./lib/utils/equalArrays.ts"

export type SuccessMessage = KeyPair & {
  success: true
  xPub?: XPub
  index?: number
}

export type FailureMessage = {
  success: false
  totalAttempts: number
  maxAttemptsReached: boolean
}

export type ProgressMessage = {
  success: false
  totalAttempts: number
}

const worker = self as unknown as Worker

worker.onmessage = async (event: MessageEvent) => {

  const {
    primaryName,
    fingerprint,
    cryptoName,
    shouldGenerateMnemonic,
    mnemonicPassphrase,
    xPub,
    offset = 0,
    maxAttempts,
    progressIntervalMs = 100
  } = event.data
  const searchLength = primaryName.length
  const fingerprintLength = fingerprint?.length

  let match = false
  let totalAttempts = 0
  let lastProgressSent = 0

  const postProgress = () => {
    const now = Date.now()
    if (now - lastProgressSent < progressIntervalMs) {
      return
    }
    lastProgressSent = now
    worker.postMessage({
      success: false,
      totalAttempts
    })
  }

  while (match === false) {
    const index = offset + totalAttempts 
    const keyPair = await generateKeyPair(cryptoName, shouldGenerateMnemonic, mnemonicPassphrase, xPub, index) 
    const { publicKey } = keyPair
    const primaryKey = publicKeyToPrimaryKey(cryptoName, publicKey)
    const value = primaryKey.substring(0, searchLength)
    const isNameMatch = value === primaryName
    let isFingerprintMatch = true
    if (fingerprint !== undefined) {
      const fullFingerprint = await publicKeyToFingerprint(publicKey)
      isFingerprintMatch = equalArrays(fullFingerprint.slice(0, fingerprintLength), fingerprint)
    }
    if (isNameMatch && isFingerprintMatch) {
      worker.postMessage({
        success: true,
        ...keyPair,
        xPub,
        index
      })
      match = true
    } else {
      totalAttempts++
      if (maxAttempts !== undefined && totalAttempts >= maxAttempts) {
        worker.postMessage({
          success: false,
          totalAttempts,
          maxAttemptsReached: true
        })
        break
      }
      postProgress()
    }
  }
  self.close()
}
