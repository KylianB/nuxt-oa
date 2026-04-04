import { defineEventHandler } from 'h3'
import { useOaConfig } from './helpers/config'

const { openApiPath, openApiGeneralInfo, scalar } = useOaConfig()

export default defineEventHandler(event => `<!DOCTYPE html>
<html>
  <head>
    <title>${openApiGeneralInfo?.title ?? 'API Documentation'}</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <div id="app"></div>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
    <script>
      Scalar.createApiReference('#app', {
        url: '${openApiPath}',
        showDeveloperTools: 'never',
        ...${JSON.stringify(scalar || {})}
      })
    </script>
  </body>
</html>`)
