import { CloudFrontRequestEvent, CloudFrontRequestResult, Handler } from 'aws-lambda'
import { extname } from 'path'
import { ChainableHandler } from './chainable-handler'

export const clientSideRoutingSupportHandler: ChainableHandler<
  CloudFrontRequestEvent,
  CloudFrontRequestResult
> = (rootURI: string) => {
  const absoluteRootURI = rootURI.startsWith('/') ? rootURI : `/${rootURI}`

  return (next: Handler<CloudFrontRequestEvent, CloudFrontRequestResult>) => {
    return (event, context, callback) => {
      const request = event.Records[0].cf.request

      // If the request is for a specific file, this handler no-ops and passes
      // the request to the next handler in the chain.
      if (extname(request.uri)) {
        return next(event, context, callback)
      }

      // Otherwise we'll rewrite the request to get the configured root path
      // (e.g. /index.html) which is capable of client-side routing.
      const rootEvent = { ...event.Records[0].cf, request: {
        ...request,
        uri: absoluteRootURI,
      }}
      return next({Records: [{cf: rootEvent}]}, context, callback)
    } 
  }
}