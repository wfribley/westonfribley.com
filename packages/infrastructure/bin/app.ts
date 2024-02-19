#!/usr/bin/env node
import 'source-map-support/register'
import { App } from 'monocdk'
import { LambdaEdgeEventType } from 'monocdk/aws-cloudfront'
import { Code, Runtime } from 'monocdk/aws-lambda'
import { stages } from '../config/stages'
import { importDir } from '../helpers/import-dir'
import { CloudFrontStack } from '../stacks/cloudfront-stack'
import { HostedZoneStack } from '../stacks/hosted-zone-stack'

const websiteAssets = importDir('@wfribley/website-frontend')
const oidcLambdaAssets = importDir('@wfribley/lambda-interceptors/dist')

const app = new App()

stages.forEach(stage => {
  const hostedZone = stage.hostedZone
    ? new HostedZoneStack(app, 'HostedZoneStack', {
      env: stage.env,
      zoneName: stage.hostedZone.zoneName
    }).hostedZone
    : undefined

  const edgeLambdas = [
    {
      props: {
        runtime: Runtime.NODEJS_14_X,
        handler: 'index.handler',
        code: Code.fromAsset(oidcLambdaAssets),
      },
      eventType: LambdaEdgeEventType.VIEWER_REQUEST,
    },
  ]

  new CloudFrontStack(app, 'CloudFrontStack', {
    env: stage.env,
    hostedZone,
    websiteAssets,
    edgeLambdas,
  })
})
