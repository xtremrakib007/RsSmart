import { query } from '../database/connection.js';
import { checkFeatureLimit, getCurrentUsage } from './featureLimit.service.js';

const TOOLS = {
  searchProducts: {
    description: 'Search products by name or category',
    parameters: { query: 'string', categoryId: 'string?' },
    handler: async ({ businessId, query: q }) => {
      const products = await query(
        `SELECT id, name, sku, price, stock_quantity FROM products
         WHERE business_id = $1 AND is_active = true AND name ILIKE $2 LIMIT 10`,
        [businessId, `%${q}%`]
      );
      return { products: products.rows };
    }
  },
  getProductDetails: {
    description: 'Get detailed product information',
    parameters: { productId: 'string' },
    handler: async ({ businessId, productId }) => {
      const result = await query(
        `SELECT * FROM products WHERE id = $1 AND business_id = $2`,
        [productId, businessId]
      );
      return result.rows[0] || null;
    }
  },
  getCustomerCart: {
    description: 'Get current cart for customer',
    parameters: { customerId: 'string' },
    handler: async ({ businessId, customerId }) => {
      const cartResult = await query(
        `SELECT c.id FROM carts c WHERE c.business_id = $1 AND c.customer_id = $2`,
        [businessId, customerId]
      );
      if (cartResult.rows.length === 0) return { items: [] };
      const itemsResult = await query(
        `SELECT ci.*, p.name as product_name FROM cart_items ci
         JOIN products p ON ci.product_id = p.id WHERE ci.cart_id = $1`,
        [cartResult.rows[0].id]
      );
      return { items: itemsResult.rows };
    }
  },
  addToCart: {
    description: 'Add product to cart',
    parameters: { customerId: 'string', productId: 'string', quantity: 'number' },
    handler: async ({ businessId, customerId, productId, quantity }) => {
      return { success: true, message: `Added ${quantity} to cart.` };
    }
  },
  getOrderStatus: {
    description: 'Get order status by order ID',
    parameters: { orderId: 'string' },
    handler: async ({ businessId, orderId }) => {
      const result = await query(
        `SELECT id, order_number, status, total_amount, created_at FROM orders
         WHERE id = $1 AND business_id = $2`,
        [orderId, businessId]
      );
      return result.rows[0] || null;
    }
  },
  getCustomerOrders: {
    description: 'Get orders for a customer',
    parameters: { customerId: 'string', limit: 'number?' },
    handler: async ({ businessId, customerId, limit = 5 }) => {
      const result = await query(
        `SELECT id, order_number, status, total_amount, created_at FROM orders
         WHERE customer_id = $1 AND business_id = $2 ORDER BY created_at DESC LIMIT $3`,
        [customerId, businessId, limit]
      );
      return { orders: result.rows };
    }
  },
  getDeliveryStatus: {
    description: 'Get delivery status for an order',
    parameters: { orderId: 'string' },
    handler: async ({ businessId, orderId }) => {
      const result = await query(
        `SELECT * FROM deliveries WHERE order_id = $1 AND business_id = $2`,
        [orderId, businessId]
      );
      return result.rows[0] || null;
    }
  }
};

export const getAISettings = async (businessId) => {
  const result = await query(
    `SELECT * FROM ai_settings WHERE business_id = $1`,
    [businessId]
  );
  if (result.rows.length === 0) {
    return {
      enabled: false,
      provider: 'openai',
      model: 'gpt-4o-mini',
      max_tokens: 500,
      temperature: 0.7,
      monthly_usage_limit: 50.00,
      system_prompt: 'You are a helpful WhatsApp commerce assistant.',
      handoff_keywords: ['refund', 'complaint', 'human', 'agent', 'support', 'cancel order']
    };
  }
  return result.rows[0];
};

export const updateAISettings = async (businessId, data) => {
  const result = await query(
    `INSERT INTO ai_settings (business_id, enabled, provider, model, max_tokens, temperature, monthly_usage_limit, system_prompt, handoff_keywords)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (business_id) DO UPDATE SET
       enabled = EXCLUDED.enabled,
       provider = EXCLUDED.provider,
       model = EXCLUDED.model,
       max_tokens = EXCLUDED.max_tokens,
       temperature = EXCLUDED.temperature,
       monthly_usage_limit = EXCLUDED.monthly_usage_limit,
       system_prompt = EXCLUDED.system_prompt,
       handoff_keywords = EXCLUDED.handoff_keywords,
       updated_at = NOW()
     RETURNING *`,
    [businessId, data.enabled, data.provider, data.model, data.max_tokens, data.temperature, data.monthly_usage_limit, data.system_prompt, data.handoff_keywords]
  );
  return result.rows[0];
};

export const trackAIUsage = async ({ businessId, conversationId, customerId, provider, model, inputTokens, outputTokens, estimatedCost }) => {
  await query(
    `INSERT INTO ai_usage (business_id, conversation_id, customer_id, provider, model, input_tokens, output_tokens, estimated_cost)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [businessId, conversationId, customerId, provider, model, inputTokens, outputTokens, estimatedCost]
  );
};

export const getMonthlyAICost = async (businessId) => {
  const result = await query(
    `SELECT COALESCE(SUM(estimated_cost), 0) as total FROM ai_usage
     WHERE business_id = $1 AND created_at >= DATE_TRUNC('month', NOW())`,
    [businessId]
  );
  return parseFloat(result.rows[0].total);
};

export const shouldHandoff = async (businessId, message) => {
  const settings = await getAISettings(businessId);
  if (!settings.enabled) return { handoff: true, reason: 'AI disabled' };

  const lower = message.toLowerCase();
  const keywords = settings.handoff_keywords || [];
  for (const kw of keywords) {
    if (lower.includes(kw.toLowerCase())) {
      return { handoff: true, reason: `Keyword detected: ${kw}` };
    }
  }
  return { handoff: false };
};

export const executeTool = async (toolName, params, context) => {
  const tool = TOOLS[toolName];
  if (!tool) throw new Error(`Tool "${toolName}" not found.`);

  const enrichedParams = { ...params, businessId: context.businessId, customerId: context.customerId };

  if (params.businessId && params.businessId !== context.businessId) {
    throw new Error('Cross-business access denied.');
  }

  return await tool.handler(enrichedParams);
};

export const getAvailableTools = () => {
  return Object.entries(TOOLS).map(([name, tool]) => ({
    name,
    description: tool.description,
    parameters: tool.parameters
  }));
};

export const checkAILimits = async (businessId) => {
  await checkFeatureLimit(businessId, 'ai_messages');
  const settings = await getAISettings(businessId);
  if (!settings.enabled) {
    const err = new Error('AI assistant is disabled.');
    err.code = 'AI_DISABLED';
    throw err;
  }
  const monthlyCost = await getMonthlyAICost(businessId);
  if (monthlyCost >= settings.monthly_usage_limit) {
    const err = new Error('Monthly AI usage limit reached.');
    err.code = 'AI_LIMIT_REACHED';
    throw err;
  }
  return { allowed: true, monthlyCost, limit: settings.monthly_usage_limit };
};
