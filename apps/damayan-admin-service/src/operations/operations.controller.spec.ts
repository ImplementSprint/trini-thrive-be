import { Test, TestingModule } from '@nestjs/testing';
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';

jest.mock('jose', () => ({
  jwtVerify: jest.fn(),
  SignJWT: jest.fn(),
}));

describe('OperationsController', () => {
  let controller: OperationsController;

  const mockOperationsService = {
    getDashboard: jest.fn(),
    getSystemHealth: jest.fn(),
    findPendingApprovals: jest.fn(),
    approvePendingUser: jest.fn(),
    rejectPendingUser: jest.fn(),
    triggerVerification: jest.fn(),
    findInventory: jest.fn(),
    getInventoryStats: jest.fn(),
    createInventoryItem: jest.fn(),
    updateInventoryItem: jest.fn(),
    adjustInventoryItem: jest.fn(),
    findCapacity: jest.fn(),
    getCapacityStats: jest.fn(),
    createEvacuationCenter: jest.fn(),
    findOrganizations: jest.fn(),
    getOrganizationStats: jest.fn(),
    createOrganization: jest.fn(),
    updateOrganization: jest.fn(),
    deleteOrganization: jest.fn(),
    findDisasterEvents: jest.fn(),
    getDisasterEventStats: jest.fn(),
    createDisasterEvent: jest.fn(),
    updateDisasterEvent: jest.fn(),
    deleteDisasterEvent: jest.fn(),
    findDispatchOrders: jest.fn(),
    getDispatchOrderStats: jest.fn(),
    createDispatchOrder: jest.fn(),
    updateDispatchOrder: jest.fn(),
    deleteDispatchOrder: jest.fn(),
    findReliefOperations: jest.fn(),
    getReliefOperationStats: jest.fn(),
    createReliefOperation: jest.fn(),
    updateReliefOperation: jest.fn(),
    deleteReliefOperation: jest.fn(),
    findIncidentReports: jest.fn(),
    getIncidentReportStats: jest.fn(),
    createIncidentReport: jest.fn(),
    updateIncidentReport: jest.fn(),
    deleteIncidentReport: jest.fn(),
    findDistributions: jest.fn(),
    getDistributionStats: jest.fn(),
    createDistribution: jest.fn(),
    updateDistribution: jest.fn(),
    deleteDistribution: jest.fn(),
    findCitizens: jest.fn(),
    createCitizen: jest.fn(),
    updateCitizen: jest.fn(),
    deleteCitizen: jest.fn(),
    findFamilies: jest.fn(),
    createFamily: jest.fn(),
    updateFamily: jest.fn(),
    deleteFamily: jest.fn(),
    getRegistrationStats: jest.fn(),
    findCheckIns: jest.fn(),
    getCheckInStats: jest.fn(),
    getRecentCheckIns: jest.fn(),
    createDisasterCoverUploadUrl: jest.fn(),
    createIncidentAttachmentUploadUrl: jest.fn(),
    createObjectViewUrl: jest.fn(),
    broadcastWarning: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OperationsController],
      providers: [
        {
          provide: OperationsService,
          useValue: mockOperationsService,
        },
      ],
    }).compile();

    controller = module.get<OperationsController>(OperationsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should get dashboard data', async () => {
    const expected = { ok: true };
    mockOperationsService.getDashboard.mockResolvedValue(expected);
    const result = await controller.getDashboard();
    expect(result).toEqual(expected);
    expect(mockOperationsService.getDashboard).toHaveBeenCalled();
  });

  it('should find inventory', async () => {
    const expected = [{ id: '1' }];
    mockOperationsService.findInventory.mockResolvedValue(expected);
    const result = await controller.findInventory('food');
    expect(result).toEqual(expected);
    expect(mockOperationsService.findInventory).toHaveBeenCalledWith('food');
  });

  it('should create disaster event', async () => {
    const expected = { id: '1' };
    const dto = { name: 'Typhoon', type: 'typhoon', severity: 'high', locationName: 'Manila' };
    mockOperationsService.createDisasterEvent.mockResolvedValue(expected);
    const result = await controller.createDisasterEvent(dto as any);
    expect(result).toEqual(expected);
    expect(mockOperationsService.createDisasterEvent).toHaveBeenCalledWith(dto);
  });
});
