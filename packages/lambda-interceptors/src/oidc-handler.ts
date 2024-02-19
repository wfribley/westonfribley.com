import { CloudFrontRequestEvent, CloudFrontRequestResult, CloudFrontResultResponse, Handler } from 'aws-lambda'
import { ChainableHandler } from './chainable-handler'

export const oidcHandler: ChainableHandler<
  CloudFrontRequestEvent,
  CloudFrontRequestResult
> = (body: string) => {
  return (next: Handler<CloudFrontRequestEvent, CloudFrontRequestResult>) => {
    const response: CloudFrontResultResponse = {
      status: '200',
      body,
    }
    return async () => response
  }
}