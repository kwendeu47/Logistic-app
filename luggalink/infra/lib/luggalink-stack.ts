import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecsPatterns from "aws-cdk-lib/aws-ecs-patterns";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as rds from "aws-cdk-lib/aws-rds";
import * as elasticache from "aws-cdk-lib/aws-elasticache";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as logs from "aws-cdk-lib/aws-logs";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";

export class LuggaLinkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const certificateArn = new cdk.CfnParameter(this, "CertificateArn", {
      type: "String",
      description: "ACM certificate ARN for the ALB HTTPS listener",
      default: "",
    });

    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        { name: "Public", subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: "Private", subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 24 },
        { name: "Isolated", subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
      ],
    });

    // ── ECR repository for the API image ────────────────────────────────
    const repository = new ecr.Repository(this, "ApiRepository", {
      repositoryName: "luggalink-api",
      imageScanOnPush: true,
      lifecycleRules: [{ maxImageCount: 20 }],
    });

    // ── RDS PostgreSQL ───────────────────────────────────────────────────
    const dbCredentials = rds.Credentials.fromGeneratedSecret("luggalink");

    const database = new rds.DatabaseInstance(this, "Database", {
      engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_16 }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      credentials: dbCredentials,
      databaseName: "luggalink",
      allocatedStorage: 50,
      maxAllocatedStorage: 200,
      multiAz: true,
      storageEncrypted: true,
      backupRetention: cdk.Duration.days(7),
      deletionProtection: true,
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
    });

    // ── ElastiCache Redis ─────────────────────────────────────────────────
    const redisSubnetGroup = new elasticache.CfnSubnetGroup(this, "RedisSubnetGroup", {
      description: "Subnet group for LuggaLink Redis",
      subnetIds: vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_ISOLATED }).subnetIds,
    });

    const redisSecurityGroup = new ec2.SecurityGroup(this, "RedisSecurityGroup", {
      vpc,
      description: "Security group for LuggaLink Redis",
      allowAllOutbound: false,
    });

    const redis = new elasticache.CfnCacheCluster(this, "Redis", {
      engine: "redis",
      cacheNodeType: "cache.t3.micro",
      numCacheNodes: 1,
      cacheSubnetGroupName: redisSubnetGroup.ref,
      vpcSecurityGroupIds: [redisSecurityGroup.securityGroupId],
    });

    // ── S3 bucket for uploads, served via CloudFront ────────────────────
    const uploadsBucket = new s3.Bucket(this, "UploadsBucket", {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
          allowedOrigins: ["*"],
          allowedHeaders: ["*"],
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const distribution = new cloudfront.Distribution(this, "UploadsDistribution", {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(uploadsBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
    });

    // ── ECS Fargate cluster running the API behind an ALB ───────────────
    const cluster = new ecs.Cluster(this, "Cluster", { vpc, clusterName: "luggalink-cluster" });

    const hasCertificate = certificateArn.valueAsString !== "";
    const certificate = hasCertificate
      ? acm.Certificate.fromCertificateArn(this, "Certificate", certificateArn.valueAsString)
      : undefined;

    const appSecrets = secretsmanager.Secret.fromSecretNameV2(this, "AppSecrets", "luggalink/api");

    const service = new ecsPatterns.ApplicationLoadBalancedFargateService(this, "ApiService", {
      cluster,
      serviceName: "luggalink-api-service",
      cpu: 512,
      memoryLimitMiB: 1024,
      desiredCount: 2,
      certificate,
      redirectHTTP: hasCertificate,
      taskImageOptions: {
        image: ecs.ContainerImage.fromEcrRepository(repository, "latest"),
        containerName: "luggalink-api",
        containerPort: 4000,
        environment: {
          NODE_ENV: "production",
          PORT: "4000",
          AWS_SECRETS_MANAGER_SECRET_ID: "luggalink/api",
          AWS_S3_BUCKET_NAME: uploadsBucket.bucketName,
        },
        secrets: {
          DATABASE_URL: ecs.Secret.fromSecretsManager(database.secret!, "password"),
          JWT_ACCESS_SECRET: ecs.Secret.fromSecretsManager(appSecrets, "JWT_ACCESS_SECRET"),
          JWT_REFRESH_SECRET: ecs.Secret.fromSecretsManager(appSecrets, "JWT_REFRESH_SECRET"),
          STRIPE_SECRET_KEY: ecs.Secret.fromSecretsManager(appSecrets, "STRIPE_SECRET_KEY"),
          STRIPE_WEBHOOK_SECRET: ecs.Secret.fromSecretsManager(appSecrets, "STRIPE_WEBHOOK_SECRET"),
        },
        logDriver: ecs.LogDrivers.awsLogs({
          streamPrefix: "luggalink-api",
          logRetention: logs.RetentionDays.TWO_WEEKS,
        }),
      },
    });

    service.targetGroup.configureHealthCheck({
      path: "/health",
      healthyHttpCodes: "200",
    });

    database.connections.allowFrom(service.service, ec2.Port.tcp(5432));
    redisSecurityGroup.addIngressRule(service.service.connections.securityGroups[0], ec2.Port.tcp(6379));
    uploadsBucket.grantReadWrite(service.taskDefinition.taskRole);
    appSecrets.grantRead(service.taskDefinition.taskRole);

    const scaling = service.service.autoScaleTaskCount({ minCapacity: 2, maxCapacity: 10 });
    scaling.scaleOnCpuUtilization("CpuScaling", { targetUtilizationPercent: 65 });

    new cdk.CfnOutput(this, "ApiUrl", { value: `https://${service.loadBalancer.loadBalancerDnsName}` });
    new cdk.CfnOutput(this, "DatabaseEndpoint", { value: database.instanceEndpoint.hostname });
    new cdk.CfnOutput(this, "RedisEndpoint", { value: redis.attrRedisEndpointAddress });
    new cdk.CfnOutput(this, "UploadsBucketName", { value: uploadsBucket.bucketName });
    new cdk.CfnOutput(this, "CloudFrontDomain", { value: distribution.distributionDomainName });
    new cdk.CfnOutput(this, "EcrRepositoryUri", { value: repository.repositoryUri });
  }
}
