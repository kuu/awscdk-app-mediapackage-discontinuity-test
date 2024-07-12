import * as fs from 'fs';
import * as path from 'path';
import { Duration, aws_logs as logs } from 'aws-cdk-lib';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';

export interface LambdaProps {
  readonly url: string; // Playlist URL
  readonly offsetInMinutes: number; // Offset in minutes
  readonly topicArn: string; // SNS Topic ARN
}

export class Lambda extends Construct {
  public readonly func: NodejsFunction;

  constructor(scope: Construct, id: string, props: LambdaProps) {
    super(scope, id);

    const { url, offsetInMinutes, topicArn } = props;

    const TS_ENTRY = path.resolve(__dirname, 'code', 'index.ts');
    const JS_ENTRY = path.resolve(__dirname, 'code', 'index.js');

    this.func = new NodejsFunction(scope, `ScheduleInputSwitch${id}`, {
      runtime: Runtime.NODEJS_18_X,
      entry: fs.existsSync(TS_ENTRY) ? TS_ENTRY : JS_ENTRY,
      handler: 'handler',
      timeout: Duration.seconds(30),
      environment: {
        NODE_ENV: process.env.NODE_ENV as string,
        REGION: process.env.CDK_DEFAULT_REGION as string,
        MASTER_PLAYLIST_URL: url,
        OFFSET_IN_MINUTE: offsetInMinutes.toString(10),
        SNS_TOPIC_ARN: topicArn,
      },
      logRetention: logs.RetentionDays.TWO_WEEKS,
    });
    // Add a statement to call MediaLive schedule API
    this.func.addToRolePolicy(
      PolicyStatement.fromJson({
        Effect: 'Allow',
        Action: 'medialive:*',
        Resource: '*',
      }),
    );
  }
}