import '@monocdk-experiment/assert/jest'
import { App } from 'monocdk'
import { CloudFrontStack } from './cloudfront-stack'

test('Empty Stack', () => {
    const app = new App()
    // WHEN
    const stack = new CloudFrontStack(app, 'TestCloudFrontStack')
    // THEN
    expect(stack).toMatchTemplate({
      'Resources': {}
    })
})
