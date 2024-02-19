import { CloudFrontRequestEvent, CloudFrontResponseEvent, Handler } from 'aws-lambda'

export type HandlerFactory<Req, Res> = (next: Handler<Req, Res>) => Handler<Req, Res>

export type ChainableHandler<Req, Res> = (...args: any[]) => HandlerFactory<Req, Res>

const createUnimplementedHandler = (): Handler => async event => {
  throw new Error('The handler chain contains a code path which does not return a ' +
  'result -- instead, `next` is called by every handler in the chain. For every ' +
  'event, there must be a handler which returns a result.')
}

export const createHandlerChain = <Req, Res>(
  handlerFactories: HandlerFactory<Req, Res>[]
) => {
  return handlerFactories.reduceRight((next, handlerFactory) => {
    return handlerFactory(next)
  }, createUnimplementedHandler())
}