import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';

function pdfEscape(value: string): string {
  return value.replace(/[^\x20-\x7E]/g, '?').replace(/([\\()])/g, '\\$1');
}

/** Minimal dependency-free PDF writer: text-only, paginated, Helvetica, US Letter. */
function makePdf(lines: string[]): Buffer {
  const pageLines: string[][] = [];
  for (let i = 0; i < lines.length; i += 48) pageLines.push(lines.slice(i, i + 48));
  if (!pageLines.length) pageLines.push(['No acceptance records found.']);
  const objects: string[] = [];
  const pageIds: number[] = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>'); // object 1
  objects.push(''); // object 2 replaced after pages are known
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'); // object 3
  pageLines.forEach((page, index) => {
    const pageId = 4 + index * 2;
    const streamId = pageId + 1;
    pageIds.push(pageId);
    const commands = ['BT', '/F1 9 Tf', '45 750 Td', '12 TL'];
    page.forEach((line, lineIndex) => {
      if (lineIndex > 0) commands.push('T*');
      commands.push('(' + pdfEscape(line.slice(0, 150)) + ') Tj');
    });
    commands.push('ET');
    const stream = commands.join('\n');
    objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ' + streamId + ' 0 R >>');
    objects.push('<< /Length ' + Buffer.byteLength(stream, 'ascii') + ' >>\nstream\n' + stream + '\nendstream');
  });
  objects[1] = '<< /Type /Pages /Kids [' + pageIds.map((id) => id + ' 0 R').join(' ') + '] /Count ' + pageIds.length + ' >>';
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((obj, index) => {
    offsets.push(Buffer.byteLength(pdf, 'ascii'));
    pdf += (index + 1) + ' 0 obj\n' + obj + '\nendobj\n';
  });
  const xrefOffset = Buffer.byteLength(pdf, 'ascii');
  pdf += 'xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n';
  offsets.slice(1).forEach((offset) => { pdf += String(offset).padStart(10, '0') + ' 00000 n \n'; });
  pdf += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xrefOffset + '\n%%EOF';
  return Buffer.from(pdf, 'ascii');
}

@Injectable()
export class LegalPoliciesService {
  constructor(private readonly prisma: PrismaService) {}

  listAcceptances(tenantId: string) {
    return this.prisma.policyAcceptance.findMany({
      where: { tenantId },
      orderBy: [{ acceptedAt: 'asc' }, { policyKey: 'asc' }],
      select: {
        id: true, tenantId: true, userId: true, policyKey: true, policyTitle: true,
        policyVersion: true, contentHash: true, action: true, flow: true,
        subscriptionId: true, acceptedAt: true,
      },
    });
  }

  async createPdf(tenantId: string): Promise<Buffer> {
    const [tenant, records] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true, slug: true } }),
      this.listAcceptances(tenantId),
    ]);
    const generatedAt = new Date().toISOString();
    const lines = [
      'RsSmart - Company Policy Acceptance Register',
      'Company: ' + (tenant?.name || 'Unknown'),
      'Tenant ID: ' + tenantId,
      'Company slug: ' + (tenant?.slug || 'Unknown'),
      'Generated at (UTC): ' + generatedAt,
      'Records: ' + records.length,
      'Evidence note: server-recorded acceptance events; retain original system records.',
      'Verification SHA-256: ' + createHash('sha256').update(JSON.stringify(records)).digest('hex'),
      '--------------------------------------------------------------------------',
    ];
    for (const record of records) {
      lines.push('Record ID: ' + record.id);
      lines.push('Policy: ' + record.policyTitle + ' [' + record.policyKey + ']');
      lines.push('Version: ' + record.policyVersion + ' | Action: ' + record.action + ' | Flow: ' + record.flow);
      lines.push('Accepted at (UTC): ' + record.acceptedAt.toISOString());
      lines.push('Accepting user ID: ' + record.userId);
      lines.push('Policy content SHA-256: ' + record.contentHash);
      lines.push('Subscription reference: ' + (record.subscriptionId || 'N/A'));
      lines.push('--------------------------------------------------------------------------');
    }
    return makePdf(lines);
  }
}
