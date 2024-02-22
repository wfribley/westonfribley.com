import { Stack, StackProps, aws_route53 as route53, aws_certificatemanager as acm } from "aws-cdk-lib";
import { Construct } from "constructs";

// Certificates created by AWS Certificate Manager (ACM) for use with CloudFront
// distribution must be created in us-east-1.
const ACM_REGION = 'us-east-1'

export interface HostedZoneStackProps extends StackProps {
    zoneName: string
}

export class HostedZoneStack extends Stack {

    readonly certificate: acm.Certificate
    readonly hostedZone: route53.HostedZone

    constructor(scope: Construct, id: string, props: HostedZoneStackProps) {
        super(scope, id, {
            ...props,
            env: props.env ? { account: props.env.account, region: ACM_REGION } : undefined,
            crossRegionReferences: true,
        })
        this.hostedZone = new route53.PublicHostedZone(this, 'HostedZone', { zoneName: props.zoneName })
        this.certificate = new acm.Certificate(this, 'CloudFrontCertificate', {
            domainName: this.hostedZone.zoneName,
            validation: acm.CertificateValidation.fromDns(this.hostedZone)
        })
    }
}