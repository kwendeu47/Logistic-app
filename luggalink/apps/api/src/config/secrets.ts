import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

/**
 * In production we pull a JSON blob of secrets from AWS Secrets Manager at
 * boot and merge it into process.env before anything else reads from it.
 * Locally, dotenv (loaded in index.ts) is sufficient — dotenv-vault can be
 * layered in by running `npx dotenv-vault pull` in CI before build, which
 * populates the same `.env` file this app already reads via `dotenv/config`.
 */
export async function loadProductionSecrets(): Promise<void> {
  const secretId = process.env.AWS_SECRETS_MANAGER_SECRET_ID;
  if (process.env.NODE_ENV !== "production" || !secretId) {
    return;
  }

  const client = new SecretsManagerClient({ region: process.env.AWS_REGION });
  const response = await client.send(new GetSecretValueCommand({ SecretId: secretId }));

  if (!response.SecretString) {
    return;
  }

  const secrets = JSON.parse(response.SecretString) as Record<string, string>;
  for (const [key, value] of Object.entries(secrets)) {
    process.env[key] ??= value;
  }
}
