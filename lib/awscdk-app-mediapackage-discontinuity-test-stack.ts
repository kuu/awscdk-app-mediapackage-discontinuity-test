import { Stack, StackProps, CfnOutput, Fn } from 'aws-cdk-lib';
import { CfnChannel } from 'aws-cdk-lib/aws-medialive';
import { Construct } from 'constructs';
import { LiveChannelFromMp4 } from 'awscdk-construct-live-channel-from-mp4-file';
import { InputSwitchScheduler, EventBridgeSchedule } from 'awscdk-construct-input-switch-scheduler';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { EmailSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import { Lambda } from './Lambda';

const emalAddress = 'YOUR_EMAIL_ADDRESS';

export class AwscdkAppMediapackageDiscontinuityTestStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Create a live channel (MediaLive + MediaPackage)
    const {eml, empv1, empv2} = new LiveChannelFromMp4(this, 'LiveChannelFromMp4', {
      source: [
        {
          url: 's3ssl://aems-input/dog.mp4',
        },
        {
          url: 's3ssl://aems-input/dog-snow.mp4',
          conversionType: 'RTP_PUSH',
        },
      ],
      channelClass: 'STANDARD',
      encoderSpec: {
        timecodeBurninPrefix: 'DISCONTINUITY-TEST',
      },
      packagerSpec: {
        startoverWindowSeconds: 1209600,
        separateAudioRendition: true,
        mediaPackageV2Settings: {
          channelGroupName: 'my-first-channel-group',
          omitLlHls: true,
        },
      },
      autoStart: true,
    });

    const channelStartTime = Math.floor(Date.now() / 1000);

    const inputAttachments = (eml.channel.inputAttachments as CfnChannel.InputAttachmentProperty[])
      .map(({inputAttachmentName}) => inputAttachmentName ? inputAttachmentName : '')
      .filter(inputAttachmentName => inputAttachmentName !== '');

    // Perform input switch every 5 minutes
    new InputSwitchScheduler(this, 'InputSwitchScheduler', {
      channelId: eml.channel.ref,
      inputAttachments,
      intervalInMinutes: 5,
    });

    const notificationTopic = new Topic(this, 'notification-of-discontinuity-mismatch', {
      topicName: 'notification-of-discontinuity-mismatch',
    });
    notificationTopic.addSubscription(new EmailSubscription(emalAddress));

    if (empv1 && empv1.endpoints.hls) {
      // Create Lambda function to fetch the MediaPackage endpoint URL
      const lambdaV1 = new Lambda(this, 'UrlFetchLambdaFunction-V1', {
        url: empv1.endpoints.hls.attrUrl,
        channelStartTime,
        topicArn: notificationTopic.topicArn,
      });

      // Create an EventBridge rule to invoke the lambda function every minute
      const eventBridgeV1 = new EventBridgeSchedule(this, 'EventBridgeSchedule-V1', {
        func:  lambdaV1.func,
        intervalInSeconds: 60,
      });

      // Print MediaPackage endpoint URL (HLS)
      new CfnOutput(this, "EventBridgeRuleARN-V1", {
        value: eventBridgeV1.rule.ruleArn,
        exportName: "EventBridgeRuleARN-V1",
        description: "ARN of EventBridge Rule - V1",
      });
    }

    if (empv2 && empv2.endpointUrls.hls) {
      // Create Lambda function to fetch the MediaPackage endpoint URL
      const lambdaV2 = new Lambda(this, 'UrlFetchLambdaFunction-V2', {
        url: empv2.endpointUrls.hls,
        channelStartTime,
        topicArn: notificationTopic.topicArn,
      });

      // Create an EventBridge rule to invoke the lambda function every minute
      const eventBridgeV2 = new EventBridgeSchedule(this, 'EventBridgeSchedule-V2', {
        func:  lambdaV2.func,
        intervalInSeconds: 60,
      });

      // Print MediaPackage endpoint URL (HLS)
      new CfnOutput(this, "EventBridgeRuleARN-V2", {
        value: eventBridgeV2.rule.ruleArn,
        exportName: "EventBridgeRuleARN-V2",
        description: "ARN of EventBridge Rule - V2",
      });
    }
  }
}
