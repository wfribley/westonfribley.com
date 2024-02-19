import { Construct, Duration, RemovalPolicy, Stack, StackProps } from 'monocdk'
import { Distribution, LambdaEdgeEventType, PriceClass, ViewerProtocolPolicy } from 'monocdk/aws-cloudfront'
import { S3Origin } from 'monocdk/aws-cloudfront-origins'
import { FunctionProps } from 'monocdk/aws-lambda'
import { AaaaRecord, ARecord, ARecordProps, HostedZone, RecordTarget } from 'monocdk/aws-route53'
import { CloudFrontTarget } from 'monocdk/aws-route53-targets'
import { Bucket } from 'monocdk/aws-s3'
import { BucketDeployment, Source } from 'monocdk/aws-s3-deployment'
import { CloudFrontDnsValidatedCertificate } from '../constructs/cloud-front-dns-validated-certificate'
import { EdgeFunction } from '../constructs/edge-function'

interface EdgeFunctionTypeAndProps {
  eventType: LambdaEdgeEventType
  props: FunctionProps
}

export interface CloudFrontStackProps extends StackProps {
  websiteAssets?: string,
  hostedZone?: HostedZone
  edgeLambdas?: EdgeFunctionTypeAndProps[]
}

/**
 * Deploy a CloudFront distribution with an S3 Bucket origin.
 * 
 * Provide a HostedZone to give the distribution a custom domain name.
 */
export class CloudFrontStack extends Stack {  
  constructor(scope: Construct, id: string, props?: CloudFrontStackProps) {
    super(scope, id, props)

    // If a HostedZone has been created for this CloudFront distribution,
    // we'll declare a dependency on its Stack (so it will be created first
    // during deployments, allowing us to reference it here). 
    const hostedZone = props?.hostedZone
    if (hostedZone) this.addDependency(Stack.of(hostedZone))

    const originBucket = new Bucket(this, 'CFOriginBucket', {
      // This is dangerous, but it will make infrastructure development
      // and iteration easier -- the bucket will be destroyed when the
      // stack is destroyed, even if it is not empty.
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    })

    // If provided a HostedZone, we'll create a new TLS/SSL certificate
    // (via ACM) and bind that cert to the distribution.
    const certificate = hostedZone
      ? new CloudFrontDnsValidatedCertificate(this, 'CFCertificate', {
          domainName: hostedZone.zoneName,
          hostedZone,
        })
      : undefined

    // By default, the OriginAccessIdentity created by S3Origin only grants
    // GetObject access to the origin S3 bucket. This means that requests
    // for non-existent objects will return a 403, instead of a 404 (S3 only
    // returns a 404 to principals that have ListBucket access, since a 404
    // provides information as to the contents of the bucket).
    //
    // We want to add ListBucket access so that we get true 404s back from
    // the origin -- which the CloudFront distribution will re-write to 200
    // responses of index.html. We could rewrite 403 responses, but this could
    // mask unrelated issues (say, some subset of S3 objects suddenly start
    // returning 403 due to a bad configuration). Instead, we'll grant ListBucket
    // permissions, and then rewrite true 404s.
    // const originAccessIdentity = new OriginAccessIdentity(this, 'CFOriginAccessIdentity')
    // originBucket.addToResourcePolicy(new PolicyStatement({
    //   resources: [
    //     originBucket.arnForObjects('*'),
    //     originBucket.bucketArn,
    //   ],
    //   actions: [
    //     's3:GetObject',
    //     's3:List*',
    //   ],
    //   principals: [originAccessIdentity.grantPrincipal],
    // }))

    const distribution = new Distribution(this, 'CFDistribution', {
      certificate,
      domainNames: hostedZone ? [hostedZone.zoneName] : undefined,
      defaultBehavior: {
        origin: new S3Origin(originBucket), //, { originAccessIdentity }),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        edgeLambdas: (props?.edgeLambdas || []).map(({ eventType, props }) => {
          const lambda = new EdgeFunction(this, `CFEdgeFunction${normalize(eventType)}`, props)
          return { functionVersion: lambda.currentVersion, eventType }
        }),
      },
      
      // Always serve index.html, unless the request is for a specific file. This
      // allows the website to handle its own routing (i.e. it's a single-page app).
      // defaultRootObject: 'index.html',
      // errorResponses: [
      //   { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
      // ],
      priceClass: PriceClass.PRICE_CLASS_100,
    })

    // If a HostedZone has been created for this CloudFront distribution,
    // we need to add Address records pointing to our distribution.
    if (hostedZone) {
      const target = RecordTarget.fromAlias(new CloudFrontTarget(distribution))
      const recordProps: ARecordProps = { target, zone: hostedZone, ttl: Duration.hours(48) }
      new ARecord(this, 'CFIPv4AddressRecord', recordProps)
      new AaaaRecord(this, 'CFIPv6AddressRecord', recordProps)
    }

    // If we've been given front-end code to deploy, do that now. The BucketDeployment will
    // copy the given directory into our S3 bucket, and invalidate the CloudFront cache.
    if (props?.websiteAssets) {
      new BucketDeployment(this, 'CFBucketDeployment', {
        sources: [Source.asset(props.websiteAssets)],
        destinationBucket: originBucket,
        distribution,
      })
    }
  }
}

const normalize = (str: string) => {
  return str.split('-').map(s => s[0].toUpperCase() + s.slice(1)).join('')
}