import { Construct, CustomResource, CustomResourceProvider, CustomResourceProviderRuntime, Stack, Stage } from 'monocdk'
import { StringParameter } from 'monocdk/aws-ssm'
import * as path from 'path'

// Because the CustomResource we create is a singleton-per-stack,
// we need to namespace our parameter keys so that we can grant
// access to the CustomResource to read all of them.
const PARAMETER_NAMESPACE = '/crossRegionParam'

export const CLOUDFRONT_REGION = 'us-east-1'

export const createCrossRegionStack = (scope: Construct, region: string, stackId: string): Stack => {
  const stage = Stage.of(scope)
  
  if (!stage) {
    throw new Error('Stacks which use CloudFrontDnsValidatedCertificates must be part of a CDK app or stage.')
  }
 
  // The stack may have already been created, so we'll try to find it (if it's found, we know it's a Stack, so
  // we can cast to that type).
  const stack = stage.node.tryFindChild(stackId) as Stack ||
    new Stack(stage, stackId, { env: { account: Stack.of(scope).account, region }})
  
  Stack.of(scope).addDependency(stack)
  return stack
}

export const storeCrossRegionString = (scope: Construct, parameterName: string, stringValue: string): void => {
  new StringParameter(scope, 'Parameter', {
    parameterName: namespaceParamName(parameterName),
    stringValue,
  })
}

export const getCrossRegionString = (
  scope: Construct,
  parameterName: string,
  region: string,
  refreshToken?: string,
): string => {
  const stack = Stack.of(scope)
  const allParametersArn = stack.formatArn({
    service: 'ssm',
    region,
    resource: 'parameter',
    resourceName: `${PARAMETER_NAMESPACE}/*`,
    sep: '',
  })

  const resourceType = 'Custom::CrossRegionStringParameterReader'
  const serviceToken = CustomResourceProvider.getOrCreate(scope, resourceType, {
    codeDirectory: path.join(__dirname, 'cross-region'),
    runtime: CustomResourceProviderRuntime.NODEJS_14_X,
    policyStatements: [{
      Effect: 'Allow',
      Resource: allParametersArn,
      Action: ['ssm:GetParameter'],
    }],
  })
  const resource = new CustomResource(scope, 'ARNReader', {
    resourceType,
    serviceToken,
    properties: {
      region,
      parameterName: namespaceParamName(parameterName),
      refreshToken,
    },
  })

  return resource.getAttString('stringValue')
}

const namespaceParamName = (parameterName: string): string => {
  const fullyQualifiedName = `${PARAMETER_NAMESPACE}/${parameterName}`
  return fullyQualifiedName.replace(/\/+/g, '/')
}