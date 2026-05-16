export class TribeClient {
  constructor(_options?: Record<string, unknown>) {}
  authenticate = jest.fn().mockResolvedValue(undefined);
  geotagResolve = jest.fn().mockResolvedValue({});
  geofenceCheck = jest.fn().mockResolvedValue({});
  [key: string]: unknown;
}
