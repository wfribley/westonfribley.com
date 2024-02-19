import { Construct, Resource, Stack, Token } from 'monocdk'
import { DnsValidatedCertificate, DnsValidatedCertificateProps, ICertificate } from 'monocdk/aws-certificatemanager'
import { Metric, MetricOptions } from 'monocdk/aws-cloudwatch'
import { HostedZone } from 'monocdk/aws-route53'
import { CLOUDFRONT_REGION, createCrossRegionStack, getCrossRegionString, storeCrossRegionString } from '../helpers/cross-region'

interface CrossRegionCertificate {
  certificate: DnsValidatedCertificate
  certificateArn: string
}

export type CloudFrontDnsValidatedCertificateProps = Omit<DnsValidatedCertificateProps, 'region'>

/**
 * A DNS-validated ACM Certificate for use with CloudFront distributions.
 * 
 * CloudFront distributions require certificates be created in us-east-1. This Resource manages
 * the creation of a supporting Stack in us-east-1, the creation of the certificate, and the
 * cross-region reference of the certificateArn.
 * 
 * Cross-region support inspired by / copied from @amzn/aws-cloudfront.expirmental EdgeFunction.
 * https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-cloudfront.experimental.EdgeFunction.html
 */
export class CloudFrontDnsValidatedCertificate extends Resource implements ICertificate {

  readonly certificateArn: string

  private readonly certificate: DnsValidatedCertificate

  constructor(scope: Construct, id: string, props: CloudFrontDnsValidatedCertificateProps) {
    super(scope, id)

    const inCloudFrontRegion = !Token.isUnresolved(this.stack.region) && this.stack.region === CLOUDFRONT_REGION

    if (inCloudFrontRegion) {
      this.certificate = new DnsValidatedCertificate(this, 'CloudFrontCertificate', {
        ...props,
        region: CLOUDFRONT_REGION,
      })
      this.certificateArn = this.certificate.certificateArn
    } else {
      const { certificate, certificateArn } = this.createCrossRegionCertificate(props)
      this.certificate = certificate
      this.certificateArn = certificateArn
    }
  }

  metricDaysToExpiry(props?: MetricOptions): Metric {
    return this.certificate.metricDaysToExpiry(props)
  }

  /**
  * Creates the cross-region stack, creates the certificate in that stack, stores the certificateArn in
  * an SSM parameter in that stack's region, creates a CustomResource with a Lambda that retrieves the
  * SSM parameter in the original region.
  */
 private createCrossRegionCertificate(props: CloudFrontDnsValidatedCertificateProps): CrossRegionCertificate {
   const region = Stack.of(this).region
   if (Token.isUnresolved(region)) {
     throw new Error('Stacks which use CloudFrontDnsValidatedCertificates must have an explicitly set region.')
   }
 
   const crossRegionStack = createCrossRegionStack(this, CLOUDFRONT_REGION, 'CloudFrontCertificateSupportStack')
 
   // The HostedZone may be in another region. If so, we'll need to store its ID in an SSM parameter
   // and then retrieve it using a CustomResource in the CLOUDFRONT_REGION.
   let hostedZone = props.hostedZone
   if (props.hostedZone.env.region !== CLOUDFRONT_REGION) {
     
     crossRegionStack.addDependency(Stack.of(hostedZone))
 
     const hostedZoneIdKey = `/cloudFrontHostedZone/${region}/${this.node.path}`
     storeCrossRegionString(hostedZone.stack, hostedZoneIdKey, props.hostedZone.hostedZoneId)
     hostedZone = HostedZone.fromHostedZoneAttributes(crossRegionStack, 'CloudFrontCrossRegionHostedZone', {
       hostedZoneId: getCrossRegionString(crossRegionStack, hostedZoneIdKey, props.hostedZone.env.region),
       zoneName: props.hostedZone.zoneName,
     })
   }
 
   const certificate = new DnsValidatedCertificate(crossRegionStack, 'CloudFrontCertificate', {
     ...props,
     hostedZone,
     region: CLOUDFRONT_REGION,
   })
 
   // Here we do the opposite of what we did with the HostedZone -- we store the certificate's ARN
   // in its region, then get it in this region.
   const certificateArnKey = `/cloudFrontCertificate/${region}/${this.node.path}`
   storeCrossRegionString(certificate, certificateArnKey, certificate.certificateArn)
   
   return {
     certificate,
     certificateArn: getCrossRegionString(this, certificateArnKey, CLOUDFRONT_REGION),
   }
 }
}
