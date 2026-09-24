import { Body, Controller, Get, Headers, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { SkipThrottle } from '@nestjs/throttler';
import { CreateWhatsAppAccountDto } from './dto/create-whatsapp-account.dto';
import { ReceiveWhatsAppWebhookDto } from './dto/receive-webhook.dto';
import { SendWhatsAppMessageDto } from './dto/send-whatsapp-message.dto';
import { WhatsAppService } from './whatsapp.service';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { AddNoteDto } from './dto/add-note.dto';
import { UpdateCartDto } from './dto/update-cart.dto';
import { CheckoutCartDto } from './dto/checkout-cart.dto';
import { AssignCustomerDto } from './dto/assign-customer.dto';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { CreateAutomationRuleDto } from './dto/create-automation-rule.dto';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { SendTemplateDto } from './dto/send-template.dto';
import { SendMediaDto } from './dto/send-media.dto';
import { WhatsAppCampaignService } from './whatsapp-campaign.service';

@ApiTags('WhatsApp')
@Controller('whatsapp')
export class WhatsAppController {
  constructor(private readonly service: WhatsAppService, private readonly campaigns: WhatsAppCampaignService) {}

  @Get('accounts')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List WhatsApp numbers for current tenant' })
  list(@CurrentUser() user: any) { return this.service.listAccounts(user.tenantId); }

  @Post('accounts')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  create(@CurrentUser() user: any, @Body() dto: CreateWhatsAppAccountDto) { return this.service.createAccount(user.tenantId, user.userId, dto); }

  @Post('accounts/:id/connect')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  connect(@CurrentUser() user: any, @Param('id') id: string) { return this.service.connect(user.tenantId, user.userId, id); }

  @Post('accounts/:id/disconnect')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  disconnect(@CurrentUser() user: any, @Param('id') id: string) { return this.service.disconnect(user.tenantId, user.userId, id); }

  @Post('accounts/:id/messages')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  send(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: SendWhatsAppMessageDto) { return this.service.sendMessage(user.tenantId, user.userId, id, dto); }

  @Get('conversations')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  conversations(@CurrentUser() user: any, @Query('search') search?: string, @Query('status') status?: any, @Query('assignedUserId') assignedUserId?: string) { return this.service.getConversations(user.tenantId, search, status, assignedUserId); }

  @Get('conversations/:id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  getConversation(@CurrentUser() user: any, @Param('id') id: string) { return this.service.getConversation(user.tenantId, id); }

  @Put('conversations/:id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  updateConversation(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateConversationDto) { return this.service.updateConversation(user.tenantId, user.userId, id, dto); }

  @Post('conversations/:id/read')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  markRead(@CurrentUser() user: any, @Param('id') id: string) { return this.service.markRead(user.tenantId, user.userId, id); }

  @Post('conversations/:id/notes')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  addNote(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: AddNoteDto) { return this.service.addNote(user.tenantId, user.userId, id, dto); }

  @Get('failed-messages')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List failed / permanently-failed WhatsApp messages for retry monitoring' })
  listFailed(@CurrentUser() user: any, @Query('limit') limit?: string) {
    return this.service.listFailedMessages(user.tenantId, limit ? parseInt(limit, 10) : 50);
  }

  @Get('conversations/:id/messages')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  messages(@CurrentUser() user: any, @Param('id') id: string) { return this.service.getMessages(user.tenantId, id); }

  @Get('conversations/:id/cart')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get active WhatsApp commerce cart' })
  cart(@CurrentUser() user: any, @Param('id') id: string) { return this.service.getCart(user.tenantId, id); }

  @Put('conversations/:id/cart')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Replace WhatsApp commerce cart items' })
  updateCart(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateCartDto) { return this.service.updateCart(user.tenantId, user.userId, id, dto); }

  @Post('conversations/:id/customer')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Link WhatsApp contact to an ERP customer' })
  assignCustomer(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: AssignCustomerDto) { return this.service.assignCustomer(user.tenantId, user.userId, id, dto); }

  @Post('conversations/:id/cart/checkout')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Convert WhatsApp cart into ERP order' })
  checkout(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: CheckoutCartDto) { return this.service.checkoutCart(user.tenantId, user.userId, id, dto); }

  @Get('campaigns')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  campaignsList(@CurrentUser() user: any) { return this.campaigns.listCampaigns(user.tenantId); }

  @Post('campaigns')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  createCampaign(@CurrentUser() user: any, @Body() dto: CreateCampaignDto) { return this.campaigns.createCampaign(user.tenantId, user.userId, dto); }

  @Post('campaigns/:id/start')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  startCampaign(@CurrentUser() user: any, @Param('id') id: string) { return this.campaigns.startCampaign(user.tenantId, user.userId, id); }

  @Post('campaigns/:id/cancel')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  cancelCampaign(@CurrentUser() user: any, @Param('id') id: string) { return this.campaigns.cancelCampaign(user.tenantId, user.userId, id); }

  @Get('automation-rules')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  rules(@CurrentUser() user: any) { return this.campaigns.listRules(user.tenantId); }

  @Post('automation-rules')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  createRule(@CurrentUser() user: any, @Body() dto: CreateAutomationRuleDto) { return this.campaigns.createRule(user.tenantId, user.userId, dto); }

  @Post('automation-rules/:id/delete')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  deleteRule(@CurrentUser() user: any, @Param('id') id: string) { return this.campaigns.deleteRule(user.tenantId, user.userId, id); }

  @Get('meta/webhook')
  @Public()
  @SkipThrottle()
  @ApiOperation({ summary: 'Meta WhatsApp webhook verification' })
  verifyMetaWebhook(@Query('hub.mode') mode: string, @Query('hub.verify_token') token: string, @Query('hub.challenge') challenge: string) { return this.service.verifyMetaWebhook(mode, token, challenge); }

  @Post('meta/webhook')
  @Public()
  @SkipThrottle()
  @ApiOperation({ summary: 'Meta WhatsApp webhook receiver' })
  receiveMetaWebhook(@Body() payload: any, @Headers('x-hub-signature-256') signature: string, @Req() req: any) {
    const rawBody = req.rawBody || Buffer.from(JSON.stringify(payload));
    this.service.verifyMetaSignature(rawBody, signature);
    return this.service.receiveMetaWebhook(payload, rawBody).then(async (result) => ({
      ...result,
      ...(await this.service.processMetaStatuses(payload, rawBody)),
    }));
  }

  @Post('webhook')
  webhook(@Body() dto: ReceiveWhatsAppWebhookDto, @CurrentUser() user: any) { return this.service.receiveWebhook(user.tenantId, dto); }

  // ── Phase 29: Templates ──
  @Get('templates')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List WhatsApp templates' })
  listTemplates(@CurrentUser() user: any, @Query('accountId') accountId?: string) {
    return this.service.listTemplates(user.tenantId, accountId);
  }

  @Post('templates')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create WhatsApp template' })
  createTemplate(@CurrentUser() user: any, @Body() dto: CreateTemplateDto) {
    return this.service.createTemplate(user.tenantId, user.userId, dto);
  }

  @Get('templates/:id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get WhatsApp template' })
  getTemplate(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.getTemplate(user.tenantId, id);
  }

  @Put('templates/:id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update WhatsApp template' })
  updateTemplate(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    return this.service.updateTemplate(user.tenantId, user.userId, id, dto);
  }

  @Post('templates/:id/delete')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete (soft) WhatsApp template' })
  deleteTemplate(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.deleteTemplate(user.tenantId, user.userId, id);
  }

  @Post('accounts/:id/templates/send')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send a template message' })
  sendTemplateMessage(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: SendTemplateDto) {
    return this.service.sendTemplateMessage(user.tenantId, user.userId, id, dto);
  }

  @Post('accounts/:id/media/send')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send a media message' })
  sendMediaMessage(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: SendMediaDto) {
    return this.service.sendMediaMessage(user.tenantId, user.userId, id, dto);
  }

}
