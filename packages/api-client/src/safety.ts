export type SafetyClientConfig = {
  baseUrl: string;
  getAuthToken?: () => Promise<string | null>;
};

export function createSafetyClientConfig(config: SafetyClientConfig) {
  return {
    baseUrl: config.baseUrl.replace(/\/$/, ""),
    getAuthToken: config.getAuthToken,
  };
}
