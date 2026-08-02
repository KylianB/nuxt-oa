import type { ModuleOptions } from '../../types'
import config from '#oa-config'
import { useRuntimeConfig } from '#imports'

export const useOaConfig = (): ModuleOptions => ({ ...config, ...useRuntimeConfig().oa })
