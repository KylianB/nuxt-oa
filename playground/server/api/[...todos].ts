import { ObjectId } from 'mongodb'
import { consola } from 'consola'
import type { H3Event } from 'h3'
import { useOaModel, useOaModelAjv } from '../../../src/runtime/server/helpers/model'
import { createOaRouter, oaHandler } from '../../../src/runtime/server/helpers/router'
import { useArchive, useCreate, useBulkCreate, useBulkDelete, useBulkArchive, useDelete, useGetAll, useUpdate } from '../../../src/runtime/server/helpers/controllers'
import { keywords } from '~/ajv-keywords'

const { addKeywords } = useOaModelAjv() // need to be called before any useOaModel()
addKeywords(keywords)

const Layer = useOaModel('Layer')
consola.log(Layer.name) // model from layer base

const Todo = useOaModel('Todo')

const auth = oaHandler((ev: H3Event) => {
  ev.context.user = { fake_user: true, id: new ObjectId() }
}, {
  security: [{ jwtCookie: [] }]
})

const setReadOnlyProp = (d: { readOnlyProp?: string, privateN?: number }) => {
  d.readOnlyProp = 'privateN=' + (d.privateN ?? 0)
}

Todo.hook('create:after', ({ data }) => setReadOnlyProp(data))

Todo.hook('update:after', ({ data }) => setReadOnlyProp(data))
Todo.hook('archive:done', ({ event }) => consola.log(`Todo #${event?.context.params?.id} archived`))
Todo.hook('update:document', ({ document }) => consola.log(`Todo mongodb document (from findOne) => ${JSON.stringify(document)}`))
Todo.hook('delete:document', ({ document }) => consola.log(`Todo mongodb document deleted => ${JSON.stringify(document)}`))
Todo.hook('bulkDelete:documents', ({ documents }) => consola.log(`Todo mongodb documents deleted => ${JSON.stringify(documents)}`))
Todo.hook('delete:done', ({ data }) => consola.log(`Todo #${data?.id} deleted`))
Todo.hook('bulkDelete:done', ({ data }) => consola.log(`Todos #[${data?.ids}] deleted`))

const log = oaHandler((ev: H3Event) => {
  consola.log('log::', ev.node.req.method)
}, (doc: { summary: string } | null) => {
  if (!doc) return
  doc.summary = `${doc.summary || ''} (and log method)`
})
const log2 = (ev: H3Event) => consola.log('log::', ev.node.req.url)

export default createOaRouter('/api/todos')
  .get('/', auth, log, useGetAll(Todo))
  .post('/', auth, log, log2, useCreate(Todo))
  .post('/bulk', auth, useBulkCreate(Todo))
  .post('/bulk/archive', auth, useBulkArchive(Todo))
  .post('/:id/archive', auth, useArchive(Todo))
  .put('/:id', auth, useUpdate(Todo))
  .delete('/:id', auth, useDelete(Todo))
  .delete('/bulk', auth, useBulkDelete(Todo))
