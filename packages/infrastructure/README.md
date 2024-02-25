# `@wfribley/westonfribleycom-infrastructure`

Infrastructure-as-code package to provision AWS resources and deploy content for [westonfribley.com](https://westonfribley.com).

The website consists of the following infrastructure:

1. An S3 bucket where static website assets are stored.
2. A CloudFront distribution with the S3 bucket as its origin, configured to serve website assets over HTTPS.
3. A Certificate linked to the CloudFront distribution to enable HTTPS.
4. A HostedZone configured to provide a custom domain name for the CloudFront distribution. This is also used to validate the Certificate, support redirecting subdomains to the root (e.g. www.example.com -> example.com), and contain arbitrary additional records (e.g. MX records).

These resources are split into two Stacks (due to a limitation requiring the Certificate to exist in a specific AWS region), one containing the HostedZone and related resources, the other containing the CloudFront distribution.

## Prerequisites

This package requires the [AWS CLI](https://aws.amazon.com/cli/) to manage authenticating to AWS accounts where [AWS CDK](https://aws.amazon.com/cdk/) will deploy.

While the CDK tool is installed when running `npm install`, the AWS CLI is not. Follow [the getting started guide](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-getting-started.html) to install the AWS CLI and configure it with the proper credentials to access your AWS account. 

Once AWS CLI is installed and running `aws sts get-caller-identity` successfully prints info about your authenticated identity, and `npm install` has completed, this package is ready for use. 

## Usage

Configuration is found in the `./config/stages.ts` file. Currently only a single production stage is configured.

### Deploying

Simply run `npx cdk deploy`. It's a good practice to run `npx cdk synth` and `npx cdk diff` before deploying to verify expected changes.

## Next steps?

Future work could support features such as:

1. User authentication (e.g. via AWS Cognito) to a specified subdomain or path.
2. Staging environment.
3. Integration with GitHub Actions.
4. Separating the S3 bucket deployment into its own Stack, so website content can be deployed without risk of deploying changes to other resources.