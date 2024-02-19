export interface StageConfig {
  env: {
    account: string
    region: string
  }
  hostedZone?: {
    zoneName: string
  }
}

export const stages: StageConfig[] = [
  {
    env: { account: '472667146672', region: 'us-west-2' },
    hostedZone: { zoneName: 'dev.westonfribley.com' },
  },
]