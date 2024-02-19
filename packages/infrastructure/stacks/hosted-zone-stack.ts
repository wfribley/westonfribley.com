import { Construct, Stack, StackProps } from 'monocdk'
import { HostedZone, PublicHostedZone } from 'monocdk/aws-route53'

export interface HostedZoneStackProps extends StackProps {
  zoneName: string
}

export class HostedZoneStack extends Stack {

  readonly hostedZone: HostedZone

  constructor(scope: Construct, id: string, props: HostedZoneStackProps) {
    super(scope, id, props)

    this.hostedZone = new PublicHostedZone(this, 'HostedZone', { zoneName: props.zoneName })
  }
}