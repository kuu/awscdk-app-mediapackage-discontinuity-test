# awscdk-app-mediapackage-discontinuity-test

AWS CDK app for deploying a test environment to reproduce MediaPackage HLS endpoint's discontinyity sequence mismatch issue:
* Start MediaLive channel and switch inputs every 10 minutes
* Set up MediaPackage V1 and V2 channels/endpoints
* Invoke a Lambda function to check the V1/V2 HLS endpoints every minute

## Install
```
$ git clone https://github.com/kuu/awscdk-app-mediapackage-discontinuity-test.git
$ cd awscdk-app-mediapackage-discontinuity-test
$ npm i
```

## Deploy
```
$ vi lib/awscdk-app-mediapackage-discontinuity-test-stack.ts
~~~ Replace YOUR-EMAIL-ADDRESS with your email address to receive notifications ~~~
$ npm run build
$ npx cdk deploy
```

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template
