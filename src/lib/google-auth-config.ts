export type GoogleAuthServerConfig = {
  clientId: string;
  clientSecret: string;
  enabled: boolean;
};

export function getGoogleAuthServerConfig(): GoogleAuthServerConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() || "";

  return {
    clientId,
    clientSecret,
    enabled: Boolean(clientId && clientSecret),
  };
}
