import {
  getFallbackHandlerDeployment,
  getMultiSendCallOnlyDeployment,
  getMultiSendDeployment,
  getProxyFactoryDeployment,
  getSafeL2SingletonDeployment,
  getSafeSingletonDeployment,
  getSignMessageLibDeployment,
  type SingletonDeployment,
} from '@safe-global/safe-deployments'
import { LATEST_SAFE_VERSION } from '@/config/constants'
import semverSatisfies from 'semver/functions/satisfies'
import { ImplementationVersionState } from '@safe-global/safe-gateway-typescript-sdk'
import type { ChainInfo, SafeInfo } from '@safe-global/safe-gateway-typescript-sdk'
import type { GetContractProps, SafeVersion } from '@safe-global/safe-core-sdk-types'
import { assertValidSafeVersion, createEthersAdapter } from '@/hooks/coreSDK/safeCoreSDK'
import type SignMessageLibEthersContract from '@safe-global/safe-ethers-lib/dist/src/contracts/SignMessageLib/SignMessageLibEthersContract'
import type CompatibilityFallbackHandlerEthersContract from '@safe-global/safe-ethers-lib/dist/src/contracts/CompatibilityFallbackHandler/CompatibilityFallbackHandlerEthersContract'
import type { Web3Provider } from '@ethersproject/providers'

// `UNKNOWN` is returned if the mastercopy does not match supported ones
// @see https://github.com/safe-global/safe-client-gateway/blob/main/src/routes/safes/handlers/safes.rs#L28-L31
//      https://github.com/safe-global/safe-client-gateway/blob/main/src/routes/safes/converters.rs#L77-L79
export const isValidMasterCopy = (safe: SafeInfo): boolean => {
  return safe.implementationVersionState !== ImplementationVersionState.UNKNOWN
}

export const _getValidatedGetContractProps = (
  chainId: string,
  safeVersion: SafeInfo['version'],
): Pick<GetContractProps, 'chainId' | 'safeVersion'> => {
  assertValidSafeVersion(safeVersion)

  // SDK request here: https://github.com/safe-global/safe-core-sdk/issues/261
  // Remove '+L2'/'+Circles' metadata from version
  const [noMetadataVersion] = safeVersion.split('+')

  return {
    chainId: +chainId,
    safeVersion: noMetadataVersion as SafeVersion,
  }
}

// GnosisSafe

export const getSpecificGnosisSafeContractInstance = (safe: SafeInfo, provider?: Web3Provider) => {
  const ethAdapter = createEthersAdapter(provider)

  return ethAdapter.getSafeContract({
    customContractAddress: safe.address.value,
    ..._getValidatedGetContractProps(safe.chainId, safe.version),
  })
}

const isOldestVersion = (safeVersion: string): boolean => {
  return semverSatisfies(safeVersion, '<=1.0.0')
}

export const _getSafeContractDeployment = (chain: ChainInfo, safeVersion: string): SingletonDeployment | undefined => {
  // We check if version is prior to v1.0.0 as they are not supported but still we want to keep a minimum compatibility
  const useOldestContractVersion = isOldestVersion(safeVersion)

  // We had L1 contracts in three L2 networks, xDai, EWC and Volta so even if network is L2 we have to check that safe version is after v1.3.0
  const useL2ContractVersion = chain.l2 && semverSatisfies(safeVersion, '>=1.3.0')
  const getDeployment = useL2ContractVersion ? getSafeL2SingletonDeployment : getSafeSingletonDeployment

  return (
    getDeployment({
      version: safeVersion,
      network: chain.chainId,
    }) ||
    getDeployment({
      version: safeVersion,
    }) ||
    // In case we couldn't find a valid deployment and it's a version before 1.0.0 we return v1.0.0 to allow a minimum compatibility
    (useOldestContractVersion
      ? getDeployment({
          version: '1.0.0',
        })
      : undefined)
  )
}

export const getGnosisSafeContractInstance = (chain: ChainInfo, safeVersion: string = LATEST_SAFE_VERSION) => {
  const ethAdapter = createEthersAdapter()

  return ethAdapter.getSafeContract({
    singletonDeployment: _getSafeContractDeployment(chain, safeVersion),
    ..._getValidatedGetContractProps(chain.chainId, safeVersion),
  })
}

// MultiSend

const getMultiSendContractDeployment = (chainId: string) => {
  return getMultiSendDeployment({ network: chainId }) || getMultiSendDeployment()
}

export const getMultiSendContractAddress = (chainId: string): string | undefined => {
  const deployment = getMultiSendContractDeployment(chainId)

  return deployment?.networkAddresses[chainId]
}

export const getMultiSendContractInstance = (chainId: string, safeVersion: string = LATEST_SAFE_VERSION) => {
  const ethAdapter = createEthersAdapter()

  return ethAdapter.getMultiSendContract({
    singletonDeployment: getMultiSendContractDeployment(chainId),
    ..._getValidatedGetContractProps(chainId, safeVersion),
  })
}

// MultiSendCallOnly

const getMultiSendCallOnlyContractDeployment = (chainId: string) => {
  return getMultiSendCallOnlyDeployment({ network: chainId }) || getMultiSendCallOnlyDeployment()
}

export const getMultiSendCallOnlyContractAddress = (chainId: string): string | undefined => {
  const deployment = getMultiSendCallOnlyContractDeployment(chainId)

  return deployment?.networkAddresses[chainId]
}

export const getMultiSendCallOnlyContractInstance = (
  chainId: string,
  safeVersion: SafeInfo['version'] = LATEST_SAFE_VERSION,
) => {
  const ethAdapter = createEthersAdapter()

  return ethAdapter.getMultiSendCallOnlyContract({
    singletonDeployment: getMultiSendCallOnlyContractDeployment(chainId),
    ..._getValidatedGetContractProps(chainId, safeVersion),
  })
}

// GnosisSafeProxyFactory

const getProxyFactoryContractDeployment = (chainId: string) => {
  return (
    getProxyFactoryDeployment({
      version: LATEST_SAFE_VERSION,
      network: chainId,
    }) ||
    getProxyFactoryDeployment({
      version: LATEST_SAFE_VERSION,
    })
  )
}

export const getProxyFactoryContractInstance = (chainId: string, safeVersion: string = LATEST_SAFE_VERSION) => {
  const ethAdapter = createEthersAdapter()

  return ethAdapter.getSafeProxyFactoryContract({
    singletonDeployment: getProxyFactoryContractDeployment(chainId),
    ..._getValidatedGetContractProps(chainId, safeVersion),
  })
}

// Fallback handler

const getFallbackHandlerContractDeployment = (chainId: string) => {
  return (
    getFallbackHandlerDeployment({
      version: LATEST_SAFE_VERSION,
      network: chainId,
    }) ||
    getFallbackHandlerDeployment({
      version: LATEST_SAFE_VERSION,
    })
  )
}

export const getFallbackHandlerContractInstance = (
  chainId: string,
  safeVersion: string = LATEST_SAFE_VERSION,
): CompatibilityFallbackHandlerEthersContract => {
  const ethAdapter = createEthersAdapter()
  return ethAdapter.getCompatibilityFallbackHandlerContract({
    singletonDeployment: getFallbackHandlerContractDeployment(chainId),
    ..._getValidatedGetContractProps(chainId, safeVersion),
  })
}

// Sign messages deployment
const getSignMessageLibContractDeployment = (chainId: string) => {
  return getSignMessageLibDeployment({ network: chainId }) || getSignMessageLibDeployment()
}

export const getSignMessageLibContractAddress = (chainId: string): string | undefined => {
  const deployment = getSignMessageLibContractDeployment(chainId)

  return deployment?.networkAddresses[chainId]
}

export const getSignMessageLibDeploymentContractInstance = (
  chainId: string,
  safeVersion: string = LATEST_SAFE_VERSION,
): SignMessageLibEthersContract => {
  const ethAdapter = createEthersAdapter()

  return ethAdapter.getSignMessageLibContract({
    singletonDeployment: getSignMessageLibContractDeployment(chainId),
    ..._getValidatedGetContractProps(chainId, safeVersion),
  })
}
