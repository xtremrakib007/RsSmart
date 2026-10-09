import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

const METHODS = ['CASH','CARD','CHEQUE','BANK_TRANSFER','CREDIT','MOBILE_MONEY'];

@Injectable()
export class PosTransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async checkout(tenantId: string, userId: string, data: any, outletId?: string) {
    if (!data?.sessionId || typeof data.sessionId !== 'string' || !Array.isArray(data.items) || !data.items.length) {
      throw new BadRequestException('sessionId and items are required');
    }
    if (data.items.length > 100) throw new BadRequestException('A POS sale cannot contain more than 100 items');
    if (data.allowCredit !== undefined && typeof data.allowCredit !== 'boolean') {
      throw new BadRequestException('allowCredit must be a boolean');
    }
    if (data.notes !== undefined && data.notes !== null && typeof data.notes !== 'string') {
      throw new BadRequestException('Order notes must be text');
    }
    if (data.clientTransactionId !== undefined &&
        (typeof data.clientTransactionId !== 'string' || data.clientTransactionId.length < 1 || data.clientTransactionId.length > 200)) {
      throw new BadRequestException('clientTransactionId must be between 1 and 200 characters');
    }
    const session = await this.prisma.posSession.findFirst({ where: { id: data.sessionId, tenantId, userId, status: 'OPEN', ...(outletId ? { outletId } : {}) } });
    if (!session) throw new BadRequestException('An open POS session is required');
    const customer = data.customerId ? await this.prisma.customer.findFirst({ where: { id: data.customerId, tenantId, isActive: true } }) : await this.getWalkInCustomer(tenantId);
    if (!customer) throw new NotFoundException('Customer not found');
    if (data.items.some((item: any) => !item || typeof item.productId !== 'string' || !item.productId)) {
      throw new BadRequestException('Every item must reference a product');
    }
    const ids = data.items.map((x: any) => x.productId);
    const products = await this.prisma.product.findMany({ where: { tenantId, id: { in: ids }, isActive: true } });
    if (products.length !== new Set(ids).size) throw new BadRequestException('One or more products are invalid or inactive');
    const map = new Map(products.map(p => [p.id, p]));
    const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
    const items = data.items.map((x: any) => {
      const p: any = map.get(x.productId);
      if (!p) throw new BadRequestException('Every item must reference an active product');
      const quantity = Number(x.quantity);
      const unitPrice = Number(p.basePrice);
      const discount = Number(x.discount ?? 0);
      const taxRate = Number(p.taxRate ?? 0);
      if (!Number.isFinite(quantity) || quantity <= 0 ||
          !Number.isFinite(unitPrice) || unitPrice < 0 ||
          !Number.isFinite(discount) || discount < 0 ||
          !Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
        throw new BadRequestException('Invalid quantity, price, discount, or tax rate');
      }
      const lineSubtotal = money(quantity * unitPrice);
      if (discount > lineSubtotal) throw new BadRequestException('Item discount cannot exceed its subtotal');
      const taxable = money(lineSubtotal - discount);
      const taxAmount = money(taxable * taxRate / 100);
      return { p, quantity, unitPrice, discount: money(discount), taxRate, taxAmount, total: money(taxable + taxAmount) };
    });
    const subtotal = money(items.reduce((s, i) => s + i.quantity * i.unitPrice, 0));
    const lineDiscount = money(items.reduce((s, i) => s + i.discount, 0));
    const orderDiscount = Number(data.discount ?? 0);
    const taxAmount = money(items.reduce((s, i) => s + i.taxAmount, 0));
    const beforeOrderDiscount = money(subtotal - lineDiscount + taxAmount);
    if (!Number.isFinite(orderDiscount) || orderDiscount < 0 || orderDiscount > beforeOrderDiscount) {
      throw new BadRequestException('Order discount must be non-negative and cannot exceed the remaining total');
    }
    const discount = money(lineDiscount + orderDiscount);
    const total = money(beforeOrderDiscount - orderDiscount);
    const payments = Array.isArray(data.payments) ? data.payments : [];
    if (payments.length > 20) throw new BadRequestException('A POS sale cannot contain more than 20 payments');
    if (payments.some((p: any) => !p || !METHODS.includes(p.method))) throw new BadRequestException('Unsupported payment method');
    const paid = money(payments.reduce((sum: number, p: any) => {
      const amount = Number(p.amount);
      if (!Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) / 100 !== amount) {
        throw new BadRequestException('Payment amounts must be positive and have at most two decimal places');
      }
      return sum + amount;
    }, 0));
    if (paid > total) throw new BadRequestException('Payments cannot exceed the order total');
    if (paid + 0.0001 < total && !data.allowCredit) throw new BadRequestException(`Payment is short by ${(total - paid).toFixed(2)}`);
    // Phase 25: idempotency fast path — 99 % of retries hit this and return immediately.
    if (data.clientTransactionId) {
      const existing = await this.prisma.order.findUnique({
        where: { tenantId_clientTransactionId: { tenantId, clientTransactionId: data.clientTransactionId } },
      });
      if (existing) return this.getReceipt(tenantId, existing.id);
    }

    // Phase 25: race-condition safety — if two requests with the same
    // clientTransactionId arrive simultaneously, the DB unique constraint
    // rejects the second. We catch P2002 and return the existing receipt
    // instead of a 500.
    try {
      return await this.prisma.$transaction(async tx => {
      // Serialize the sale transaction with session closure and manual cash entries.
      const lockedSession = await tx.posSession.updateMany({
        where: { id: data.sessionId, tenantId, userId, status: 'OPEN', ...(outletId ? { outletId } : {}) },
        data: { status: 'OPEN' },
      });
      if (lockedSession.count !== 1) throw new BadRequestException('POS session is no longer open');
      const orderNumber = await this.generateOrderNumber(tx, tenantId);
      const order = await tx.order.create({ data: { tenantId, outletId: session.outletId, orderNumber, customerId: customer.id, salesRepId: userId, source: 'POS', status: 'APPROVED', subtotal, taxAmount, discount, total, paidAmount: Math.min(paid,total), balanceDue: Math.max(0,total-paid), notes: typeof data.notes === 'string' ? data.notes.slice(0, 2000) : undefined, clientTransactionId: data.clientTransactionId || undefined, items: { create: items.map(i=>({ productId:i.p.id, quantity:i.quantity, unitPrice:i.unitPrice, discount:i.discount, taxRate:i.taxRate, taxAmount:i.taxAmount, total:i.total })) } } });
      for (const item of items) {
        if (!item.p.trackInventory) continue;
        const inv = await tx.inventory.findFirst({ where: { tenantId, outletId: session.outletId, productId: item.p.id, warehouseId: data.warehouseId || null } });
        if (!inv) throw new BadRequestException(`Inventory not found for ${item.p.name} at this outlet`);

        // Phase 26: atomic check-and-deduct. The UPDATE ... WHERE (quantity - reserved) >= requested
        // is a single atomic statement — no race condition between the read and the write.
        // If no row is returned, stock was insufficient at the exact moment of the update.
        const deducted = await tx.$queryRaw<Array<{ id: string }>>`
          UPDATE inventory
          SET quantity = quantity - ${item.quantity},
              version  = version + 1
          WHERE id = ${inv.id}
            AND (quantity - reserved) >= ${item.quantity}
          RETURNING id`;

        if (deducted.length === 0) {
          throw new BadRequestException(
            `Insufficient stock for ${item.p.name}. Available: ${Number(inv.quantity) - Number(inv.reserved)}`,
          );
        }

        await tx.stockMovement.create({ data:{ tenantId, outletId: session.outletId, inventoryId:inv.id, type:'OUTBOUND', quantity:item.quantity, referenceId:order.id, referenceType:'POS_ORDER', createdBy:userId } });
      }
      for (const p of payments) { const amount=Number(p.amount); if(!Number.isFinite(amount)||amount<=0) throw new BadRequestException('Invalid payment amount'); await tx.payment.create({data:{orderId:order.id,amount,method:p.method,reference:p.reference,notes:p.notes,createdBy:userId}}); if(p.method==='CASH') await tx.posCashMovement.create({data:{tenantId,outletId:session.outletId,sessionId:session.id,type:'SALE',amount,referenceId:order.id,notes:`Cash sale ${order.orderNumber}`,createdBy:userId}}); }
      return this.getReceiptTx(tx,tenantId,order.id);
    });
    } catch (error: any) {
      if (error.code === 'P2002' && data.clientTransactionId) {
        const existing = await this.prisma.order.findUnique({
          where: { tenantId_clientTransactionId: { tenantId, clientTransactionId: data.clientTransactionId } },
        });
        if (existing) return this.getReceipt(tenantId, existing.id);
      }
      throw error;
    }
  }

  async refund(tenantId: string, userId: string, orderId: string, data: any, outletId?: string) {
    if (!data || typeof data.sessionId !== 'string' || !data.sessionId) {
      throw new BadRequestException('An open POS session is required');
    }
    if (data.method !== undefined && (typeof data.method !== 'string' || !METHODS.includes(data.method))) {
      throw new BadRequestException('Unsupported refund method');
    }
    if (data.reference !== undefined && data.reference !== null &&
        (typeof data.reference !== 'string' || data.reference.length > 200)) {
      throw new BadRequestException('Refund reference must be at most 200 characters');
    }

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId, source: 'POS', ...(outletId ? { outletId } : {}) },
      include: { items: { include: { product: { select: { trackInventory: true } } } } },
    });
    if (!order) throw new NotFoundException('POS order not found');
    if (order.status !== 'APPROVED') throw new BadRequestException('Only completed POS sales can be refunded');

    const session = await this.prisma.posSession.findFirst({
      where: { id: data.sessionId, tenantId, userId, status: 'OPEN', ...(outletId ? { outletId } : {}) },
    });
    if (!session) throw new BadRequestException('An open POS session is required');
    if (session.outletId !== order.outletId) {
      throw new BadRequestException('Refund session must belong to the original sale outlet');
    }

    // This operation restores every sold item and marks the order returned.
    // Therefore partial refunds are deliberately rejected instead of returning
    // stock while retaining part of the sale as if it were still fulfilled.
    const paidAmount = Number(order.paidAmount);
    const amount = data.amount == null ? paidAmount : Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0 ||
        Math.round(amount * 100) / 100 !== amount ||
        !Number.isFinite(paidAmount) || paidAmount <= 0 ||
        Math.round((amount - paidAmount) * 100) / 100 !== 0) {
      throw new BadRequestException('A refund must equal the full paid amount and use at most two decimal places');
    }
    const method = data.method || 'CASH';

    return this.prisma.$transaction(async tx => {
      // Serialize refunds with closure of the cashier session.
      const lockedSession = await tx.posSession.updateMany({
        where: { id: data.sessionId, tenantId, userId, status: 'OPEN' },
        data: { status: 'OPEN' },
      });
      if (lockedSession.count !== 1) throw new BadRequestException('POS session is no longer open');
      const currentSession = await tx.posSession.findFirst({
        where: { id: data.sessionId, tenantId, userId, status: 'OPEN' },
      });
      if (!currentSession || currentSession.outletId !== order.outletId) {
        throw new BadRequestException('Refund session must be open at the original sale outlet');
      }
      // Claim the refund atomically. A concurrent duplicate refund loses this
      // conditional update; throwing rolls back any stock/payment mutations.
      const claimed = await tx.order.updateMany({
        where: { id: order.id, tenantId, source: 'POS', status: 'APPROVED' },
        data: { status: 'RETURNED', paidAmount: 0, balanceDue: 0 },
      });
      if (claimed.count !== 1) throw new BadRequestException('Order already refunded');

      for (const item of order.items) {
        // Only tracked products consume stock. Restore the exact inventory row
        // recorded by the original sale, never a warehouse chosen during refund.
        if (!item.product?.trackInventory) continue;
        const originalMovement = await tx.stockMovement.findFirst({
          where: {
            tenantId, referenceId: order.id, referenceType: 'POS_ORDER',
            inventory: { productId: item.productId },
          },
          select: { inventoryId: true },
        });
        if (!originalMovement) {
          throw new BadRequestException('Original stock movement not found; refund requires inventory review');
        }
        const inv = await tx.inventory.findFirst({
          where: { id: originalMovement.inventoryId, tenantId, outletId: order.outletId, productId: item.productId },
        });
        if (!inv) throw new BadRequestException('Original inventory record not found for refund item');
        await tx.inventory.update({
          where: { id: inv.id },
          data: { quantity: { increment: item.quantity }, version: { increment: 1 } },
        });
        await tx.stockMovement.create({
          data: {
            tenantId, outletId: order.outletId, inventoryId: inv.id,
            type: 'INBOUND', quantity: item.quantity, referenceId: order.id,
            referenceType: 'POS_REFUND', createdBy: userId, notes: 'POS refund',
          },
        });
      }

      await tx.payment.create({
        data: {
          orderId: order.id, amount: -amount, method,
          reference: data.reference, notes: 'POS refund', createdBy: userId,
        },
      });
      if (method === 'CASH') {
        await tx.posCashMovement.create({
          data: {
            tenantId, outletId: session.outletId, sessionId: session.id,
            type: 'REFUND', amount, referenceId: order.id,
            notes: `Cash refund ${order.orderNumber}`, createdBy: userId,
          },
        });
      }
      return this.getReceiptTx(tx, tenantId, order.id);
    });
  }

  async cashMovement(tenantId: string, userId: string, data: any, outletId?: string) {
    const type = data?.type;
    const amount = Number(data?.amount);
    if (typeof data?.sessionId !== 'string' || !data.sessionId ||
        !['IN', 'OUT'].includes(type) ||
        !Number.isFinite(amount) || amount <= 0 ||
        Math.round(amount * 100) / 100 !== amount) {
      throw new BadRequestException('Valid session, type IN/OUT, and positive amount with at most two decimals are required');
    }
    if (data.referenceId !== undefined && data.referenceId !== null &&
        (typeof data.referenceId !== 'string' || data.referenceId.length > 200)) {
      throw new BadRequestException('Reference must be at most 200 characters');
    }
    if (data.notes !== undefined && data.notes !== null &&
        (typeof data.notes !== 'string' || data.notes.length > 2000)) {
      throw new BadRequestException('Notes must be text with at most 2000 characters');
    }
    // Serialize cash entries against session closure by locking the OPEN row
    // inside the same transaction that records the movement.
    return this.prisma.$transaction(async (tx: any) => {
      const locked = await tx.posSession.updateMany({
        where: { id: data.sessionId, tenantId, userId, status: 'OPEN' },
        data: { status: 'OPEN' },
      });
      if (locked.count !== 1) throw new BadRequestException('Open POS session not found');
      const session = await tx.posSession.findFirst({
        where: { id: data.sessionId, tenantId, userId, status: 'OPEN' },
      });
      if (!session) throw new BadRequestException('Open POS session not found');
      return tx.posCashMovement.create({
        data: {
          tenantId, outletId: session.outletId, sessionId: session.id, type, amount,
          referenceId: data.referenceId || undefined,
          notes: data.notes || undefined,
          createdBy: userId,
        },
      });
    });
  }

  async dailySummary(tenantId:string,sessionId:string,outletId?:string){const session=await this.prisma.posSession.findFirst({where:{id:sessionId,tenantId,...(outletId ? { outletId } : {})}}); if(!session) throw new NotFoundException('Session not found'); const orders=await this.prisma.order.findMany({where:{tenantId,outletId:session.outletId,source:'POS',salesRepId:session.userId,createdAt:{gte:session.openedAt,...(session.closedAt?{lte:session.closedAt}:{})}},include:{payments:true}}); const movements=await this.prisma.posCashMovement.findMany({where:{tenantId,outletId:session.outletId,sessionId},orderBy:{createdAt:'asc'}}); const paymentSummary:any={}; for(const o of orders) for(const p of o.payments) paymentSummary[p.method]=(paymentSummary[p.method]||0)+Number(p.amount); const sum=(t:string)=>movements.filter(m=>m.type===t).reduce((s,m)=>s+Number(m.amount),0); return {session,totalOrders:orders.length,grossSales:orders.reduce((s,o)=>s+Number(o.total),0),paymentSummary,cash:{opening:Number(session.openingCash),sales:sum('SALE'),refunds:sum('REFUND'),cashIn:sum('IN'),cashOut:sum('OUT'),expected:Number(session.openingCash)+sum('SALE')-sum('REFUND')+sum('IN')-sum('OUT')}};}
  getReceipt(tenantId:string,orderId:string,outletId?:string){return this.getReceiptTx(this.prisma,tenantId,orderId,outletId);}
  private async getReceiptTx(tx:any,tenantId:string,orderId:string,outletId?:string){const order=await tx.order.findFirst({where:{id:orderId,tenantId,source:'POS',...(outletId ? { outletId } : {})},include:{customer:{select:{id:true,name:true}},items:{include:{product:{select:{id:true,name:true,sku:true,barcode:true}}}},payments:{select:{id:true,amount:true,method:true,reference:true,createdAt:true}}}}); if(!order) throw new NotFoundException('POS receipt not found'); return {receiptNumber:order.orderNumber,order,printable:{currency:'MYR',number:order.orderNumber,customer:order.customer.name,items:order.items.map((i:any)=>({name:i.product.name,quantity:Number(i.quantity),unitPrice:Number(i.unitPrice),total:Number(i.total)})),subtotal:Number(order.subtotal),discount:Number(order.discount),tax:Number(order.taxAmount),total:Number(order.total),paid:Number(order.paidAmount),balance:Number(order.balanceDue),payments:order.payments.map((p:any)=>({method:p.method,amount:Number(p.amount),reference:p.reference}))}};}
  private async generateOrderNumber(tx:any,tenantId:string){const d=new Date();const prefix=`POS-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}`;const count=await tx.order.count({where:{tenantId,source:'POS',orderNumber:{startsWith:prefix}}});return `${prefix}-${String(count+1).padStart(5,'0')}`;}
  private async getWalkInCustomer(tenantId:string){let c=await this.prisma.customer.findFirst({where:{tenantId,name:'Walk-in Customer'}});if(!c)c=await this.prisma.customer.create({data:{tenantId,name:'Walk-in Customer',country:'Malaysia'}});return c;}
}
