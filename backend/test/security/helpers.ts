import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

export interface TestTenant {
  tenantId: string;
  ownerToken: string;
  managerToken: string;
  staffToken: string;
  outletId: string;
  secondOutletId: string;
  productId: string;
  customerId: string;
  orderId: string;
}

/**
 * Seeds a complete tenant with owner, manager, staff, two outlets,
 * one product, one customer, one order. Returns IDs and JWTs.
 */
export async function seedTenant(app: INestApplication, suffix: string): Promise<TestTenant> {
  // Register company (triggers trial subscription, Phase 18)
  const companyRes = await request(app.getHttpServer())
    .post('/auth/register-company')
    .send({
      companyName: `TestCo-${suffix}`,
      email: `owner-${suffix}@test.com`,
      password: 'Password123!',
      firstName: 'Owner',
      lastName: `Test-${suffix}`,
      phone: `+6012${suffix}`,
    })
    .expect(201);

  const ownerToken = companyRes.body.accessToken;
  const tenantId = companyRes.body.user.tenantId;

  // Create second outlet
  const outlet2Res = await request(app.getHttpServer())
    .post('/outlets')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ code: `OUT2-${suffix}`, name: `Second Outlet ${suffix}`, address: 'Jalan 2' })
    .expect(201);
  const secondOutletId = outlet2Res.body.id;

  // Fetch default outlet
  const outletsRes = await request(app.getHttpServer())
    .get('/outlets')
    .set('Authorization', `Bearer ${ownerToken}`)
    .expect(200);
  const outletId = outletsRes.body.find((o: any) => o.isDefault)?.id || outletsRes.body[0].id;

  // Create product
  const productRes = await request(app.getHttpServer())
    .post('/products')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({
      sku: `SKU-${suffix}`,
      name: `Product ${suffix}`,
      basePrice: 10,
      categoryId: null,
      unitId: null,
    })
    .expect(201);
  const productId = productRes.body.id;

  // Create customer
  const customerRes = await request(app.getHttpServer())
    .post('/customers')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ name: `Customer ${suffix}`, phone: `+6013${suffix}` })
    .expect(201);
  const customerId = customerRes.body.id;

  // Create order
  const orderRes = await request(app.getHttpServer())
    .post('/orders')
    .set('Authorization', `Bearer ${ownerToken}`)
    .set('x-outlet-id', outletId)
    .send({
      customerId,
      items: [{ productId, quantity: 1, unitPrice: 10 }],
    })
    .expect(201);
  const orderId = orderRes.body.id;

  // Invite manager
  const inviteRes = await request(app.getHttpServer())
    .post('/invitations')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({
      email: `manager-${suffix}@test.com`,
      firstName: 'Manager',
      lastName: 'Test',
      roleIds: [],
      outletIds: [outletId],
    })
    .expect(201);

  // Accept invitation as manager
  const acceptRes = await request(app.getHttpServer())
    .post('/invitations/accept')
    .send({
      token: inviteRes.body.token,
      password: 'Password123!',
    })
    .expect(201);
  const managerToken = acceptRes.body.accessToken;

  // Invite staff (scoped to one outlet only)
  const staffInviteRes = await request(app.getHttpServer())
    .post('/invitations')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({
      email: `staff-${suffix}@test.com`,
      firstName: 'Staff',
      lastName: 'Test',
      roleIds: [],
      outletIds: [outletId],
    })
    .expect(201);

  const staffAcceptRes = await request(app.getHttpServer())
    .post('/invitations/accept')
    .send({
      token: staffInviteRes.body.token,
      password: 'Password123!',
    })
    .expect(201);
  const staffToken = staffAcceptRes.body.accessToken;

  return {
    tenantId,
    ownerToken,
    managerToken,
    staffToken,
    outletId,
    secondOutletId,
    productId,
    customerId,
    orderId,
  };
}
