import {
    Stack,
    StackProps,
    aws_route53 as route53,
    aws_route53_targets as route53Targets,
    aws_certificatemanager as acm,
    aws_s3 as s3
} from "aws-cdk-lib";
import { Construct } from "constructs";
import { StageConfig } from "../config/stages";

// Certificates created by AWS Certificate Manager (ACM) for use with CloudFront
// distribution must be created in us-east-1.
const ACM_REGION = 'us-east-1'

export interface HostedZoneStackProps extends StackProps {
    zoneName: string,
    redirectSubdomains?: Exclude<StageConfig['hostedZone'], undefined>['redirectSubdomains'],
    additionalRecords?: Exclude<StageConfig['hostedZone'], undefined>['additionalRecords']
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

        // Additional records may be created by calling passed in functions that
        // return a RecordSet (we don't need to do anything with the return value, simply
        // instantiating the RecordSet will add it to this Stack).
        props.additionalRecords?.forEach((createRecord) => createRecord(this, this.hostedZone))

        // We may want to redirect a subdomain (e.g. www) to our root zoneName -- we'll do this
        // by creating an S3 bucket configured to response with a 304 to the zoneName and a
        // CNAME record pointing to the S3 bucket.
        props.redirectSubdomains?.forEach((subdomain) => {
            const redirectBucket = new s3.Bucket(this, `RedirectBucket_${subdomain}`, {
                websiteRedirect: { hostName: props.zoneName, protocol: s3.RedirectProtocol.HTTPS }
            })
            new route53.ARecord(this, `ARecord_${subdomain}`, {
                zone: this.hostedZone,
                recordName: 'www',
                target: route53.RecordTarget.fromAlias(new route53Targets.BucketWebsiteTarget(redirectBucket)) 
            })
        })
    }
}