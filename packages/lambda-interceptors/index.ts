import { createHandlerChain } from './src/chainable-handler'
import { clientSideRoutingSupportHandler } from './src/client-side-routing-support-handler'

export const handler = createHandlerChain([
  clientSideRoutingSupportHandler('index.html'),
  () => async (event) => event.Records[0].cf.request
])