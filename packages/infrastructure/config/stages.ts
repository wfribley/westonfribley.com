import { aws_route53 as route53 } from "aws-cdk-lib"
import { Construct } from "constructs"

export interface StageConfig {
    env: {
        account: string
        region: string
    }
    hostedZone?: {
        zoneName: string,

        /**
         * Redirect these subdomains to the root zoneName. This is done by creating an S3 bucket
         * configured to respond with a 304 to the zoneName, and a CNAME record pointing to the S3
         * bucket.
         */
        redirectSubdomains?: string[],

        /**
         * Specify any additional records (e.g. MX records pointing to an email service) to be
         * created in this HostedZone.
         * 
         * Note: CNAME records will be automatically created for any `redirectSubdomains` -- these
         * will point to an S3 bucket configured to redirect (via 304) to the zoneName.
         */
        additionalRecords?: Array<(
            scope: Construct,
            hostedZone: route53.HostedZone
        ) => route53.RecordSet>,
    }
}
  
export const stages: StageConfig[] = [
    {
        env: { account: '472667146672', region: 'us-west-2' },
        hostedZone: {
            zoneName: 'westonfribley.com',
            redirectSubdomains: ['www'],
            additionalRecords: [
                (scope, zone) => new route53.MxRecord(scope, 'MXRecord', {
                    zone,
                    values: [
                        { priority: 1, hostName: 'ASPMX.L.GOOGLE.COM.' },
                        { priority: 5, hostName: 'ALT1.ASPMX.L.GOOGLE.COM.' },
                        { priority: 5, hostName: 'ALT2.ASPMX.L.GOOGLE.COM.' },
                        { priority: 10, hostName: 'ASPMX2.GOOGLEMAIL.COM.' },
                        { priority: 10, hostName: 'ASPMX3.GOOGLEMAIL.COM.' },
                    ]
                })
            ]
        },
    },
]