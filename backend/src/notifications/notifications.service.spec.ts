import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { EmailService } from './email.service';
import { WhatsAppService } from './whatsapp.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let email: { sendOrderConfirmation: jest.Mock };
  let whatsapp: { sendOrderConfirmation: jest.Mock };

  const baseOrder = {
    orderNumber: 'ORD-202608-00001',
    total: 150,
    createdAt: new Date('2026-08-22T00:00:00Z'),
    customer: { name: 'Jane Tan', email: 'jane@example.com', phone: '+60123456789' },
    items: [{ quantity: 2, total: 150, product: { name: 'Widget' } }],
  };

  beforeEach(async () => {
    email = { sendOrderConfirmation: jest.fn().mockResolvedValue(undefined) };
    whatsapp = { sendOrderConfirmation: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: EmailService, useValue: email },
        { provide: WhatsAppService, useValue: whatsapp },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  it('never sends a confirmation for POS sales, regardless of contact info', async () => {
    await service.sendOrderConfirmationIfApplicable({ ...baseOrder, source: 'POS' });

    expect(email.sendOrderConfirmation).not.toHaveBeenCalled();
    expect(whatsapp.sendOrderConfirmation).not.toHaveBeenCalled();
  });

  it.each(['SALES_APP', 'ERP', 'WEB'])(
    'sends both email and WhatsApp for a %s sales order with full contact info',
    async (source) => {
      await service.sendOrderConfirmationIfApplicable({ ...baseOrder, source });

      expect(email.sendOrderConfirmation).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'jane@example.com', orderNumber: baseOrder.orderNumber }),
      );
      expect(whatsapp.sendOrderConfirmation).toHaveBeenCalledWith(
        expect.objectContaining({ to: '+60123456789', orderNumber: baseOrder.orderNumber }),
      );
    },
  );

  it('sends only email when the customer has no phone on file', async () => {
    await service.sendOrderConfirmationIfApplicable({
      ...baseOrder,
      source: 'ERP',
      customer: { ...baseOrder.customer, phone: null },
    });

    expect(email.sendOrderConfirmation).toHaveBeenCalled();
    expect(whatsapp.sendOrderConfirmation).not.toHaveBeenCalled();
  });

  it('sends only WhatsApp when the customer has no email on file', async () => {
    await service.sendOrderConfirmationIfApplicable({
      ...baseOrder,
      source: 'ERP',
      customer: { ...baseOrder.customer, email: null },
    });

    expect(email.sendOrderConfirmation).not.toHaveBeenCalled();
    expect(whatsapp.sendOrderConfirmation).toHaveBeenCalled();
  });

  it('sends nothing, without throwing, when the customer has neither email nor phone', async () => {
    await expect(
      service.sendOrderConfirmationIfApplicable({
        ...baseOrder,
        source: 'ERP',
        customer: { name: 'Jane Tan', email: null, phone: null },
      }),
    ).resolves.not.toThrow();

    expect(email.sendOrderConfirmation).not.toHaveBeenCalled();
    expect(whatsapp.sendOrderConfirmation).not.toHaveBeenCalled();
  });
});
