<template>
  <div>
    <h1>Tests</h1>
    <p v-if="pending">
      Loading...
    </p>
    <template v-else>
      <button @click="openTodo({ id: 'new', text: '' })">
        + Add a todo
      </button>
      <json-list
        :items="todos"
        :schema="schema"
      >
        <template #table-header="{ sortBy, sortDesc }">
          <div :style="{ display: 'grid', gridTemplateColumns: '100px 40px 1fr', gap: '20px', userSelect: 'none' }">
            <span>Text {{ sortBy === 'text' ? (sortDesc ? '↑' : '↓') : '' }}</span>
            <span>Cost</span>
            <span>Actions</span>
          </div>
        </template>
        <template #item="{ item: t, view }">
          <div
            class="item"
            :style="view === 'card' ? {} : { display: 'grid', gridTemplateColumns: '100px 40px 1fr', alignItems: 'center', gap: '20px' }"
          >
            <p><b>{{ t.text }}</b></p>
            <p>{{ t.cost }}</p>
            <div>
              <button
                :disabled="t.deletedAt"
                @click="openTodo(t)"
              >
                ✏️
              </button>
              <button @click="archiveTodo(t)">
                🗃️
              </button>
              <button @click="rmTodo(t)">
                🗑️
              </button>
            </div>
          </div>
        </template>
      </json-list>
      <dialog ref="dialog">
        <json-schema
          ref="form"
          v-model="editedTodo"
          :schema="schema"
          :defs-schema="defsSchema"
          :keywords="keywords"
        />
        <menu>
          <button
            value="cancel"
            @click="closeTodo"
          >
            Cancel
          </button>
          <button
            value="default"
            @click="updateTodo"
          >
            Save
          </button>
        </menu>
      </dialog>
      <button @click="testWithRandomId">
        Delete with random id
      </button>
      <button
        v-if="todos.length"
        @click="testWithBadData"
      >
        Update with bad data
      </button>
      <button
        v-if="todos.length"
        @click="testWriteReadOnly"
      >
        Update a read only property
      </button>
      <br><br>
      <button @click="bulkCreate(false)">
        + Bulk create (3 todos)
      </button>
      <button @click="bulkCreate(true)">
        + Bulk create (partial fail)
      </button>
      <button @click="bulkCreateFullFail">
        + Bulk create (full fail → 400)
      </button>
      <button @click="bulkDelete(false)">
        - Bulk delete (top 3)
      </button>
      <button @click="bulkDelete(true)">
        - Bulk delete (+ 1 malformed id)
      </button>
      <button @click="bulkDeleteFullFail">
        - Bulk delete (full fail → 400)
      </button>
      <button @click="bulkArchiveTest()">
        Bulk archive (top 3 + 1 not found)
      </button>
      <button @click="bulkArchiveTest({ archive: false })">
        Bulk unarchive (top 3 + 1 not found)
      </button>
      <button @click="bulkArchiveTest({ mode: 'malformed' })">
        Bulk archive (+ 1 malformed id)
      </button>
      <button @click="bulkArchiveFullFail">
        Bulk archive (full fail → 400)
      </button>
      <button @click="bulkUpdateTest('ok')">
        ~ Bulk update (top 3)
      </button>
      <button @click="bulkUpdateTest('notfound')">
        ~ Bulk update (top 3 / 1 not found + 1 invalid)
      </button>
      <button @click="bulkUpdateTest('malformed')">
        ~ Bulk update (+ 1 malformed id)
      </button>
      <button @click="bulkUpdateTest('blocked')">
        ~ Bulk update (+ 1 blocked by hook)
      </button>
      <button @click="bulkUpdateFullFail">
        ~ Bulk update (full fail → 400)
      </button>
    </template>
    <pre
      v-if="msg"
      :style="{ color: msgColor }"
    >{{ msg }}</pre>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import { JsonSchema } from 'j2u'
import { keywords } from '~/ajv-keywords'
import { useOaSchema, useOaDefsSchema, oaTodoSchema, useNuxtApp } from '#imports'

const schema = useOaSchema('Todo')
// OR: const schema = oaTodoSchema
// OR: const schema = useNuxtApp().$oaTodoSchema
const defsSchema = useOaDefsSchema('defs')

const msg = ref<string | null>(null)
const msgColor = ref('green')
const todos = ref<OaTodo[]>([])
const pending = ref(true)

onMounted(async () => {
  todos.value = await $fetch('/api/todos')
  pending.value = false
})

const randStr = (base = 36) => Math.random().toString(base).slice(3, 9)

function msgWrapper<T>(func: (arg: T) => Promise<unknown>, finallyFunc?: () => unknown) {
  return async (d: T) => {
    msg.value = null
    msgColor.value = 'green'
    try {
      const data = await func(d)
      msg.value = JSON.stringify(data, null, ' ') || ''
    } catch (error) {
      msgColor.value = 'red'
      msg.value = error instanceof Error ? error.message : String(error)
      if (error && typeof error === 'object' && 'data' in error && error.data && typeof error.data === 'object' && 'data' in error.data) {
        msg.value += '\n' + JSON.stringify(error.data.data, null, ' ')
      }
    } finally {
      finallyFunc?.()
    }
  }
}

const editedTodo = ref<OaTodo | null>(null)
const dialog = ref<HTMLDialogElement | null>(null)
const openTodo = (todo: OaTodo) => {
  dialog.value?.showModal()
  editedTodo.value = JSON.parse(JSON.stringify(todo))
}
const closeTodo = () => {
  dialog.value?.close()
  editedTodo.value = null
}

const form = ref<InstanceType<typeof JsonSchema> | null>(null)
const updateTodo = msgWrapper(async () => {
  if (!await form.value?.validate()) return {}
  if (!editedTodo.value) return
  const isNew = editedTodo.value.id === 'new'
  const { id, ...body } = editedTodo.value
  const data = await $fetch<OaTodo>(`/api/todos/${isNew ? '' : id}`, {
    method: isNew ? 'POST' : 'PUT', body
  })
  if (isNew) todos.value.push(data)
  else todos.value.splice(todos.value.findIndex((t: OaTodo) => t.id === id), 1, data)
  return data
}, closeTodo)

const archiveTodo = msgWrapper(async ({ id, deletedAt }: OaTodo) => {
  const data = await $fetch<OaTodo>('/api/todos/' + id + '/archive', { method: 'POST', body: { archive: !deletedAt } })
  todos.value.splice(todos.value.findIndex((t: OaTodo) => t.id === id), 1, data)
  return data
})

const rmTodo = msgWrapper(async ({ id }: OaTodo) => {
  const data = await $fetch('/api/todos/' + id, { method: 'DELETE' })
  todos.value.splice(todos.value.findIndex((t: OaTodo) => t.id === id), 1)
  return data
})

const bulkCreate = msgWrapper(async (fail = false) => {
  const data = await $fetch<{ results: OaTodo[], errors: unknown[] }>('/api/todos/bulk', {
    method: 'POST',
    body: [
      { text: 'Bulk 1 ' + randStr() },
      { text: fail ? 'no' : 'Bulk 2 ' + randStr() },
      { text: 'Bulk 3 ' + randStr() }
    ]
  })
  todos.value.push(...data.results)
  return data
})

const bulkDelete = msgWrapper(async (malformed = false) => {
  const ids = todos.value.slice(0, 3).map(t => t.id)
  if (!ids.length) return
  if (malformed) ids.push('not-an-id') // invalid ObjectId format, isolated as an error instead of failing the whole batch
  const data = await $fetch<{ deletedCount: number, errors: unknown[] }>('/api/todos/bulk', {
    method: 'DELETE',
    body: { ids }
  })
  todos.value = todos.value.filter(t => !ids.includes(t.id))
  return data
})

const bulkArchiveTest = msgWrapper(async ({ archive = true, mode = 'notfound' }: { archive?: boolean, mode?: 'ok' | 'notfound' | 'malformed' } = {}) => {
  const ids = todos.value.slice(0, 3).map(t => t.id)
  const allIds = [...ids]
  if (mode === 'notfound') allIds.push('63cf86ff1541f5505b' + randStr(16)) // valid format, but doesn't exist
  if (mode === 'malformed') allIds.push('not-an-id') // invalid ObjectId format

  const data = await $fetch<{ results: OaTodo[], errors: unknown[] }>('/api/todos/bulk/archive', {
    method: 'POST', body: { ids: allIds, archive }
  })
  for (const updated of data.results) {
    const index = todos.value.findIndex(t => t.id === updated.id)
    if (index !== -1) todos.value.splice(index, 1, updated)
  }
  return data
})

const bulkUpdateTest = msgWrapper(async (mode: 'ok' | 'notfound' | 'malformed' | 'blocked' = 'ok') => {
  const body = todos.value.slice(0, 3).map(todo => ({ id: todo.id, d: { text: todo.text, cost: (todo.cost ?? 0) + 1 } }))
  if (!body.length) return
  if (mode === 'notfound') {
    body.push({ id: '63cf86ff1541f5505b' + randStr(16), d: { text: 'not found', cost: 0 } }) // valid format & valid data, but doesn't exist
    if (body.length > 1 && body[1]) body[1].d.cost = 260 // invalid, max is 250
  } else if (mode === 'malformed') {
    body.push({ id: 'not-an-id', d: { text: 'no', cost: 0 } }) // invalid ObjectId format
  } else if (mode === 'blocked' && body[0]) {
    body[0].d.text = 'blocked' // rejected by the demo update:before hook, others still go through
  }
  const data = await $fetch<{ results: OaTodo[], errors: unknown[] }>('/api/todos/bulk', {
    method: 'PUT', body
  })
  for (const updated of data.results) {
    const index = todos.value.findIndex(t => t.id === updated.id)
    if (index !== -1) todos.value.splice(index, 1, updated)
  }
  return data
})

// Every item fails (all invalid data) → bulkCreate now throws a 400 instead of a 200 with empty results
const bulkCreateFullFail = msgWrapper(async () =>
  await $fetch<{ results: OaTodo[], errors: unknown[] }>('/api/todos/bulk', {
    method: 'POST',
    body: [
      { text: 'no' },
      { text: 'x' }
    ]
  })
)

// Every id is a well-formed but nonexistent ObjectId → bulkDelete now throws a 400 instead of a 200 with deletedCount: 0
const bulkDeleteFullFail = msgWrapper(async () =>
  await $fetch<{ deletedCount: number, errors: unknown[] }>('/api/todos/bulk', {
    method: 'DELETE',
    body: { ids: ['63cf86ff1541f5505b' + randStr(16), '63cf86ff1541f5505b' + randStr(16)] }
  })
)

// Every id is a well-formed but nonexistent ObjectId → bulkArchive now throws a 400 instead of a 200 with empty results
const bulkArchiveFullFail = msgWrapper(async () =>
  await $fetch<{ results: OaTodo[], errors: unknown[] }>('/api/todos/bulk/archive', {
    method: 'POST',
    body: { ids: ['63cf86ff1541f5505b' + randStr(16), '63cf86ff1541f5505b' + randStr(16)], archive: true }
  })
)

// Every id is a well-formed but nonexistent ObjectId → bulkUpdate now throws a 400 instead of a 200 with empty results
const bulkUpdateFullFail = msgWrapper(async () =>
  await $fetch<{ results: OaTodo[], errors: unknown[] }>('/api/todos/bulk', {
    method: 'PUT',
    body: [
      { id: '63cf86ff1541f5505b' + randStr(16), d: { text: 'not found 1', cost: 0 } },
      { id: '63cf86ff1541f5505b' + randStr(16), d: { text: 'not found 2', cost: 0 } }
    ]
  })
)

const testWithRandomId = msgWrapper(async () =>
  await $fetch('/api/todos/63cf86ff1541f5505b' + randStr(16), { method: 'DELETE', body: { text: 'U-test' } })
)

const testWithBadData = msgWrapper(async () =>
  await $fetch('/api/todos/' + todos.value[0]?.id, { method: 'PUT', body: { noInSchema: 'test', text: 'no' } })
)

const testWriteReadOnly = msgWrapper(async () =>
  await $fetch('/api/todos/' + todos.value[0]?.id, { method: 'PUT', body: { text: todos.value[0]?.text, readOnlyProp: 'test' } })
)
</script>

<style>
dialog::backdrop {
  background: rgba(0, 0, 0, 0.25);
}
</style>
