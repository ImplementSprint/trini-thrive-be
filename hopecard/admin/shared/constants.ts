export const SERVICE_PORTS = {
  GATEWAY: 5000,
  AUTH: 5001,
  BENEFICIARY: 5002,
  APPROVALS: 5003,
  ANALYTICS: 5004,
  ANALYTICS_TCP: 5005,
};

export const JWT_SECRET = process.env.JWT_SECRET || "hopecard-admin-secret-key-change-in-production";
