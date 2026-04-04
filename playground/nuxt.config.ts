import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  extends: [
    './base'
  ],
  modules: ['../src/module'],
  runtimeConfig: {
    oa: {
      dbUrl: '',
      cipherKey: ''
    }
  },
  oa: {
    openApiGeneralInfo: {
      title: 'Nuxt-OA Playground API',
      description: 'Scalar API Documentation for the Playground API of nuxt-oa module.',
      version: '1.0.0'
    }
  }
})
