import { CfnResource, Construct, ConstructNode, Lazy, Resource, Stack, Token } from 'monocdk'
import { Metric, MetricOptions } from 'monocdk/aws-cloudwatch'
import { Connections } from 'monocdk/aws-ec2'
import { Grant, IGrantable, IPrincipal, IRole, PolicyStatement, Role, ServicePrincipal } from 'monocdk/aws-iam'
import { Alias, AliasOptions, EventInvokeConfigOptions, EventSourceMapping, EventSourceMappingOptions, extractQualifierFromArn, Function as LambdaFunction, FunctionProps, IEventSource, IVersion, Permission } from 'monocdk/aws-lambda'
import { CLOUDFRONT_REGION, createCrossRegionStack, getCrossRegionString, storeCrossRegionString } from '../helpers/cross-region'

export class EdgeFunction extends Resource implements IVersion {

  readonly edgeArn: string
  readonly functionArn: string
  readonly functionName: string
  readonly grantPrincipal: IPrincipal
  readonly isBoundToVpc = false
  readonly lambda: LambdaFunction
  readonly permissionsNode: ConstructNode
  readonly role?: IRole
  readonly version: string

  constructor(scope: Construct, id: string, props: FunctionProps) {
    super(scope, id)

    const inCloudFrontRegion = !Token.isUnresolved(this.stack.region) && this.stack.region === CLOUDFRONT_REGION

    if (inCloudFrontRegion) {
      this.lambda = new LambdaFunction(this, 'EdgeFunction', props)
      this.edgeArn = this.lambda.currentVersion.edgeArn
    } else {
      const { fn, edgeArn } = this.createCrossRegionFunction(id, props)
      this.lambda = fn
      this.edgeArn = edgeArn
    }

    // LambdaFunction::role is mis-typed -- it's always defined.
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    addEdgeLambdaToRoleTrustStatement(this.lambda.role!)

    this.functionArn = this.edgeArn
    this.functionName = this.lambda.functionName
    this.grantPrincipal = this.lambda.grantPrincipal
    this.permissionsNode = this.lambda.permissionsNode
    this.version = extractQualifierFromArn(this.functionArn)
    this.node.defaultChild = this.lambda
  }

  get currentVersion(): IVersion { return this }

  public addAlias(aliasName: string, options: AliasOptions = {}): Alias {
    return new Alias(this.lambda, aliasName, {
      aliasName,
      version: this.lambda.currentVersion,
      ...options,
    })
  }

  /**
   * Not supported. Connections are only applicable to VPC-enabled functions.
   */
  public get connections(): Connections {
    throw new Error('Lambda@Edge does not support connections')
  }
  public get latestVersion(): IVersion {
    throw new Error('$LATEST function version cannot be used for Lambda@Edge')
  }

  public addEventSourceMapping(id: string, options: EventSourceMappingOptions): EventSourceMapping {
    return this.lambda.addEventSourceMapping(id, options)
  }
  public addPermission(id: string, permission: Permission): void {
    return this.lambda.addPermission(id, permission)
  }
  public addToRolePolicy(statement: PolicyStatement): void {
    return this.lambda.addToRolePolicy(statement)
  }
  public grantInvoke(identity: IGrantable): Grant {
    return this.lambda.grantInvoke(identity)
  }
  public metric(metricName: string, props?: MetricOptions): Metric {
    return this.lambda.metric(metricName, { ...props, region: CLOUDFRONT_REGION })
  }
  public metricDuration(props?: MetricOptions): Metric {
    return this.lambda.metricDuration({ ...props, region: CLOUDFRONT_REGION })
  }
  public metricErrors(props?: MetricOptions): Metric {
    return this.lambda.metricErrors({ ...props, region: CLOUDFRONT_REGION })
  }
  public metricInvocations(props?: MetricOptions): Metric {
    return this.lambda.metricInvocations({ ...props, region: CLOUDFRONT_REGION })
  }
  public metricThrottles(props?: MetricOptions): Metric {
    return this.lambda.metricThrottles({ ...props, region: CLOUDFRONT_REGION })
  }
  /** Adds an event source to this function. */
  public addEventSource(source: IEventSource): void {
    return this.lambda.addEventSource(source)
  }
  public configureAsyncInvoke(options: EventInvokeConfigOptions): void {
    return this.lambda.configureAsyncInvoke(options)
  }

  private createCrossRegionFunction(id: string, props: FunctionProps): {fn: LambdaFunction, edgeArn: string} {
    const stack = Stack.of(this)
    if (Token.isUnresolved(stack.region)) {
      throw new Error('Stacks which use EdgeFunction must have an explicitly set region.')
    }
 
    const crossRegionStack = createCrossRegionStack(this, CLOUDFRONT_REGION, 'CloudFrontEdgeFunctionSupportStack')
    const fn = new LambdaFunction(crossRegionStack, id, props)

    // Store the LambdaFunction's current version ARN in an SSM parameter in its region, then
    // read it back in this region.
    const fnVersionArnKey = `/edgeFunction/${stack.region}/${this.node.path}`
    storeCrossRegionString(fn, fnVersionArnKey, fn.currentVersion.edgeArn)
    const fnResource = fn.currentVersion.node.defaultChild
    if (!fnResource || !CfnResource.isCfnResource(fnResource)) {
      throw new Error('Lambda@Edge function current version did not create a CfnResource.')
    }
    const refreshToken = Lazy.uncachedString({ produce: () => {
      return stack.resolve(fnResource.logicalId)
    }})
    return { fn, edgeArn: getCrossRegionString(this, fnVersionArnKey, CLOUDFRONT_REGION, refreshToken) }
  }
}

function addEdgeLambdaToRoleTrustStatement(role: IRole) {
  if (role instanceof Role && role.assumeRolePolicy) {
    const statement = new PolicyStatement()
    const edgeLambdaServicePrincipal = new ServicePrincipal('edgelambda.amazonaws.com')
    statement.addPrincipals(edgeLambdaServicePrincipal)
    statement.addActions(edgeLambdaServicePrincipal.assumeRoleAction)
    role.assumeRolePolicy.addStatements(statement)
  }
}