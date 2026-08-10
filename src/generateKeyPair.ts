import { 
  type PrivateKey,
  type PrivateKeyDisplay,
  type KeyPairDisplay, 
  type CryptoName, 
  type MnemonicPassphrase,
  type XPub, 
  generateKeyPair as generateKeyPairByCryptoName,
  derivePublicKeyFromXPub,
  displayPublicKey
} from "@onamea/types"

export type KeyPair = Omit<KeyPairDisplay, "privateKey" | "privateKeyDisplay"> & {
  privateKey?: PrivateKey
  privateKeyDisplay?: PrivateKeyDisplay
}

export const generateKeyPair = async (cryptoName: CryptoName, shouldGenerateMnemonic = false, mnemonicPassphrase?: MnemonicPassphrase, xPub?: XPub, index?: number): Promise<KeyPair> => {
  if (xPub !== undefined && index !== undefined) {
    const publicKey = derivePublicKeyFromXPub(cryptoName, xPub, index)
    const publicKeyDisplay = displayPublicKey(publicKey)
    return { cryptoName, publicKey, publicKeyDisplay }
  } else {
    return await generateKeyPairByCryptoName(cryptoName, shouldGenerateMnemonic ? 12 : undefined, mnemonicPassphrase)
  }
}
