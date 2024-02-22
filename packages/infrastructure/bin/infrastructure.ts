#!/usr/bin/env node
import 'source-map-support/register';
import { App } from 'aws-cdk-lib';
import { stages } from '../config/stages';
import { HostedZoneStack } from '../lib/hosted-zone-stack';
import { CloudFrontStack } from '../lib/cloudfront-stack';
import { resolvePackage } from '../lib/resolve-package';

const frontendAssetDirectory = resolvePackage('@wfribley/westonfribleycom-frontend')

const app = new App();

stages.forEach((stage) => {
    const hostedZone = stage.hostedZone
        ? new HostedZoneStack(app, 'HostedZoneStack', {
            env: stage.env,
            zoneName: stage.hostedZone.zoneName,
        })
        : undefined
  
    new CloudFrontStack(app, 'CloudFrontStack', {
        env: stage.env,
        hostedZone,
        frontendAssetDirectory,
    })
})
