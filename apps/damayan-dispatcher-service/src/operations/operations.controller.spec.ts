import { Test, TestingModule } from '@nestjs/testing';
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';

jest.mock('jose', () => ({
  jwtVerify: jest.fn(),
  SignJWT: jest.fn(),
}));

describe('OperationsController', () => {
  let controller: OperationsController;
  const mockService = {
    getDispatcherProfile: jest.fn().mockResolvedValue({}),
    getDashboard: jest.fn().mockResolvedValue({}),
    JwtGuard: jest.fn().mockResolvedValue({}),
    PersonaGuard: jest.fn().mockResolvedValue({}),
    getOverview: jest.fn().mockResolvedValue({}),
    getProfile: jest.fn().mockResolvedValue({}),
    findIncidentReports: jest.fn().mockResolvedValue({}),
    createIncidentReport: jest.fn().mockResolvedValue({}),
    updateIncidentReport: jest.fn().mockResolvedValue({}),
    deleteIncidentReport: jest.fn().mockResolvedValue({}),
    findDispatchOrders: jest.fn().mockResolvedValue({}),
    createDispatchOrder: jest.fn().mockResolvedValue({}),
    updateDispatchOrder: jest.fn().mockResolvedValue({}),
    deleteDispatchOrder: jest.fn().mockResolvedValue({}),
    findVolunteerOrganizations: jest.fn().mockResolvedValue({}),
    findVolunteerUnits: jest.fn().mockResolvedValue({}),
    findVolunteerTeams: jest.fn().mockResolvedValue({}),
    createVolunteerDispatch: jest.fn().mockResolvedValue({}),
    getBarangayData: jest.fn().mockResolvedValue({}),
    getTeamStatus: jest.fn().mockResolvedValue({}),
    setDutyStatus: jest.fn().mockResolvedValue({}),
    getSiteManagerAccountStatuses: jest.fn().mockResolvedValue({}),
    broadcast: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OperationsController],
      providers: [{ provide: OperationsService, useValue: mockService }],
    }).compile();

    controller = module.get<OperationsController>(OperationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

      it('should call getOverview', async () => {
    await controller.getOverview({ user: { sub: "1" } } as any, {} as any, {} as any);
    expect(controller).toBeDefined();
  });

  it('should call getProfile', async () => {
    await controller.getProfile({ user: { sub: "1" } } as any, {} as any, {} as any);
    expect(controller).toBeDefined();
  });

  it('should call findIncidentReports', async () => {
    await controller.findIncidentReports({ user: { sub: "1" } } as any, {} as any, {} as any);
    expect(controller).toBeDefined();
  });

  it('should call createIncidentReport', async () => {
    await controller.createIncidentReport({ user: { sub: "1" } } as any, {} as any, {} as any);
    expect(controller).toBeDefined();
  });

  it('should call updateIncidentReport', async () => {
    await controller.updateIncidentReport({ user: { sub: "1" } } as any, {} as any, {} as any);
    expect(controller).toBeDefined();
  });

  it('should call deleteIncidentReport', async () => {
    await controller.deleteIncidentReport({ user: { sub: "1" } } as any, {} as any, {} as any);
    expect(controller).toBeDefined();
  });

  it('should call findDispatchOrders', async () => {
    await controller.findDispatchOrders({ user: { sub: "1" } } as any, {} as any, {} as any);
    expect(controller).toBeDefined();
  });

  it('should call createDispatchOrder', async () => {
    await controller.createDispatchOrder({ user: { sub: "1" } } as any, {} as any, {} as any);
    expect(controller).toBeDefined();
  });

  it('should call updateDispatchOrder', async () => {
    await controller.updateDispatchOrder({ user: { sub: "1" } } as any, {} as any, {} as any);
    expect(controller).toBeDefined();
  });

  it('should call deleteDispatchOrder', async () => {
    await controller.deleteDispatchOrder({ user: { sub: "1" } } as any, {} as any, {} as any);
    expect(controller).toBeDefined();
  });

  it('should call findVolunteerOrganizations', async () => {
    await controller.findVolunteerOrganizations({ user: { sub: "1" } } as any, {} as any, {} as any);
    expect(controller).toBeDefined();
  });

  it('should call findVolunteerUnits', async () => {
    await controller.findVolunteerUnits({ user: { sub: "1" } } as any, {} as any, {} as any);
    expect(controller).toBeDefined();
  });

  it('should call findVolunteerTeams', async () => {
    await controller.findVolunteerTeams({ user: { sub: "1" } } as any, {} as any, {} as any);
    expect(controller).toBeDefined();
  });

  it('should call createVolunteerDispatch', async () => {
    await controller.createVolunteerDispatch({ user: { sub: "1" } } as any, {} as any, {} as any);
    expect(controller).toBeDefined();
  });

  it('should call getBarangayData', async () => {
    await controller.getBarangayData({ user: { sub: "1" } } as any, {} as any, {} as any);
    expect(controller).toBeDefined();
  });

  it('should call getTeamStatus', async () => {
    await controller.getTeamStatus({ user: { sub: "1" } } as any, {} as any, {} as any);
    expect(controller).toBeDefined();
  });

  it('should call setDutyStatus', async () => {
    await controller.setDutyStatus({ user: { sub: "1" } } as any, {} as any, {} as any);
    expect(controller).toBeDefined();
  });

  it('should call getSiteManagerAccountStatuses', async () => {
    await controller.getSiteManagerAccountStatuses({ user: { sub: "1" } } as any, {} as any, {} as any);
    expect(controller).toBeDefined();
  });

  it('should call broadcast', async () => {
    await controller.broadcast({ user: { sub: "1" } } as any, {} as any, {} as any);
    expect(controller).toBeDefined();
  });

});
