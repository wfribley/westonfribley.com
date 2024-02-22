import {
    Duration,
    RemovalPolicy,
    Stack,
    StackProps,
    aws_cloudfront as cloudfront,
    aws_cloudfront_origins as cloudfrontOrigins,
    aws_iam as iam,
    aws_route53 as route53,
    aws_route53_targets as route53Targets,
    aws_s3 as s3,
    aws_s3_deployment as s3Deployment
} from "aws-cdk-lib";
import { Construct } from "constructs";
import { HostedZoneStack } from "./hosted-zone-stack";

export interface CloudFrontStackProps extends StackProps {
    frontendAssetDirectory?: string,
    hostedZone?: HostedZoneStack
}

export class CloudFrontStack extends Stack {

    constructor(scope: Construct, id: string, props?: CloudFrontStackProps) {
        super(scope, id, { ...props, crossRegionReferences: true })

        // If a HostedZoneStack has been created for this CloudFront distribution,
        // we'll make sure it's created first during deployments, allowing us to
        // reference its Constructs here). 
        if (props?.hostedZone) this.addDependency(props.hostedZone)
        const hostedZone = props?.hostedZone?.hostedZone
        const certificate = props?.hostedZone?.certificate

        const originBucket = new s3.Bucket(this, 'CFOriginBucket', {
            // This is dangerous, but it will make infrastructure development
            // and iteration easier -- the bucket will be destroyed when the
            // stack is destroyed, even if it is not empty.
            removalPolicy: RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
        })

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
        const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'CFOriginAccessIdentity')
        originBucket.addToResourcePolicy(new iam.PolicyStatement({
            resources: [
                originBucket.arnForObjects('*'),
                originBucket.bucketArn,
            ],
            actions: [
                's3:GetObject',
                's3:List*',
            ],
            principals: [originAccessIdentity.grantPrincipal],
        }))

        const distribution = new cloudfront.Distribution(this, 'CFDistribution', {
            certificate: certificate,
            domainNames: hostedZone ? [hostedZone.zoneName] : undefined,
            defaultBehavior: {
                origin: new cloudfrontOrigins.S3Origin(originBucket, { originAccessIdentity }),
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            },
            // Always serve index.html, unless the request is for a specific file. This
            // allows the website to handle its own routing (i.e. it's a single-page app).
            defaultRootObject: 'index.html',
            errorResponses: [
              { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
            ],
            priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
        })

        // If a HostedZone has been created for this CloudFront distribution,
        // we need to add Address records pointing to our distribution.
        if (hostedZone) {
            const target = route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(distribution))
            const recordProps: route53.ARecordProps = { target, zone: hostedZone, ttl: Duration.hours(48) }
            new route53.ARecord(this, 'CFIPv4AddressRecord', recordProps)
            new route53.AaaaRecord(this, 'CFIPv6AddressRecord', recordProps)
        }

        // If we have front-end code to deploy, do that now. The BucketDeployment will
        // copy the given directory into our S3 bucket, and invalidate the CloudFront cache.
        if (props?.frontendAssetDirectory) {
            new s3Deployment.BucketDeployment(this, 'CFBucketDeployment', {
                sources: [s3Deployment.Source.asset(props.frontendAssetDirectory)],
                destinationBucket: originBucket,
                distribution,
            })
        }
    }
}