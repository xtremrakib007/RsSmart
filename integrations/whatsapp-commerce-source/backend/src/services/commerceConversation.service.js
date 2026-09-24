import { query } from '../database/connection.js';
import * as conversationState from './conversationState.service.js';
import * as whatsappApi from './whatsappCloudApi.service.js';
import * as customerService from './customer.service.js';
import * as productService from './product.service.js';
import * as pricingService from './pricing.service.js';
import * as cartService from './cart.service.js';
import * as checkoutService from './checkout.service.js';
import * as orderService from './order.service.js';
import { normalizePhone } from '../utils/phone.js';

const ITEMS_PER_PAGE = 8;

// ============================================
// MAIN ENTRY: Handle incoming commerce message
// ============================================
export const handleMessage = async (message, customer, conversation, businessId) => {
  const { id: conversationId } = conversation;
  const { id: customerId } = customer;
  const phone = normalizePhone(customer.phone);

  // Get current state
  const state = await conversationState.getState(businessId, customerId, conversationId);

  // Check if staff is handling
  if (state.staff_handling) {
    // Just store the message - staff will handle via dashboard
    return { handled: false, reason: 'staff_handling' };
  }

  const input = extractInput(message);

  // Global navigation commands
  if (isMainMenuTrigger(input.text)) {
    await sendMainMenu(businessId, phone, customer, conversationId);
    await conversationState.resetToMainMenu(businessId, customerId, conversationId);
    return { handled: true };
  }

  // Route by state
  switch (state.state) {
    case conversationState.STATES.MAIN_MENU:
      return await handleMainMenu(input, businessId, customerId, conversationId, phone, customer);
    case conversationState.STATES.BROWSING_PRODUCTS:
      return await handleBrowsingProducts(input, businessId, customerId, conversationId, phone, state);
    case conversationState.STATES.VIEWING_PRODUCT:
      return await handleViewingProduct(input, businessId, customerId, conversationId, phone, state);
    case conversationState.STATES.SELECTING_QUANTITY:
      return await handleSelectingQuantity(input, businessId, customerId, conversationId, phone, state);
    case conversationState.STATES.CART:
      return await handleCart(input, businessId, customerId, conversationId, phone, state);
    case conversationState.STATES.CHECKOUT:
      return await handleCheckout(input, businessId, customerId, conversationId, phone, state, customer);
    case conversationState.STATES.SELECTING_ADDRESS:
      return await handleSelectingAddress(input, businessId, customerId, conversationId, phone, state);
    case conversationState.STATES.ADDING_ADDRESS:
      return await handleAddingAddress(input, businessId, customerId, conversationId, phone, state);
    case conversationState.STATES.ORDER_CONFIRMATION:
      return await handleOrderConfirmation(input, businessId, customerId, conversationId, phone, state);
    case conversationState.STATES.VIEWING_ORDERS:
      return await handleViewingOrders(input, businessId, customerId, conversationId, phone, state);
    case conversationState.STATES.VIEWING_ORDER:
      return await handleViewingOrder(input, businessId, customerId, conversationId, phone, state);
    case conversationState.STATES.SEARCHING_PRODUCTS:
      return await handleSearchingProducts(input, businessId, customerId, conversationId, phone, state);
    case conversationState.STATES.VIEWING_ACCOUNT:
      return await handleViewingAccount(input, businessId, customerId, conversationId, phone, state, customer);
    case conversationState.STATES.WAITING_FOR_STAFF:
      return await handleWaitingForStaff(input, businessId, customerId, conversationId, phone);
    default:
      await sendMainMenu(businessId, phone, customer, conversationId);
      await conversationState.resetToMainMenu(businessId, customerId, conversationId);
      return { handled: true };
  }
};

// ============================================
// INPUT EXTRACTION
// ============================================
const extractInput = (message) => {
  const type = message.message_type;
  let text = '';
  let buttonId = null;
  let listId = null;

  if (type === 'text') {
    text = message.content || '';
  } else if (type === 'button_reply') {
    text = message.content || '';
    // Try to parse button ID from raw payload if available
    try {
      const raw = message.raw_payload || {};
      buttonId = raw.interactive?.button_reply?.id || raw.button?.payload || text;
    } catch (e) { buttonId = text; }
  } else if (type === 'list_reply') {
    text = message.content || '';
    try {
      const raw = message.raw_payload || {};
      listId = raw.interactive?.list_reply?.id || text;
    } catch (e) { listId = text; }
  }

  return { type, text: text.trim(), buttonId, listId };
};

const isMainMenuTrigger = (text) => {
  const triggers = ['hi', 'hello', 'start', 'menu', 'home', 'main menu', 'hey', 'halo', 'assalamualaikum'];
  return triggers.includes(text.toLowerCase());
};

// ============================================
// MAIN MENU
// ============================================
const sendMainMenu = async (businessId, phone, customer, conversationId) => {
  const bizResult = await query(`SELECT name FROM businesses WHERE id = $1`, [businessId]);
  const businessName = bizResult.rows[0]?.name || 'Our Store';

  const greeting = customer.full_name
    ? `Welcome back, ${customer.full_name}! 👋\n\n${businessName}`
    : `Welcome to ${businessName} 👋`;

  const body = `${greeting}\n\nHow can we help you today?`;

  const sections = [{
    title: 'Menu Options',
    rows: [
      { id: 'MENU_PRODUCTS', title: '🛍️ Products', description: 'Browse our catalogue' },
      { id: 'MENU_SEARCH', title: '🔎 Search Products', description: 'Find what you need' },
      { id: 'MENU_CART', title: '🛒 My Cart', description: 'View your cart' },
      { id: 'MENU_ORDERS', title: '📦 My Orders', description: 'Track your orders' },
      { id: 'MENU_ACCOUNT', title: '👤 My Account', description: 'Your profile' },
      { id: 'MENU_STAFF', title: '💬 Talk to Staff', description: 'Speak with our team' },
    ]
  }];

  await whatsappApi.sendListMessage(businessId, phone, body, sections, {
    conversationId, customerId: customer.id, buttonText: 'Open Menu', header: businessName
  });
};

const handleMainMenu = async (input, businessId, customerId, conversationId, phone, customer) => {
  const text = input.text.toLowerCase();
  const id = (input.buttonId || input.listId || text).toUpperCase();

  if (id.includes('PRODUCTS') || id.includes('🛍️') || text === '1') {
    await showCategories(businessId, phone, customerId, conversationId, customer);
    return { handled: true };
  }
  if (id.includes('SEARCH') || id.includes('🔎') || text === '2') {
    await whatsappApi.sendText(businessId, phone,
      '🔎 What product are you looking for?\n\nType a keyword like "shirt", "phone", or "rice".',
      { conversationId, customerId }
    );
    await conversationState.setState(businessId, customerId, conversationId, conversationState.STATES.SEARCHING_PRODUCTS);
    return { handled: true };
  }
  if (id.includes('CART') || id.includes('🛒') || text === '3') {
    await showCart(businessId, phone, customerId, conversationId, customer);
    return { handled: true };
  }
  if (id.includes('ORDERS') || id.includes('📦') || text === '4') {
    await showOrders(businessId, phone, customerId, conversationId, customer, 1);
    return { handled: true };
  }
  if (id.includes('ACCOUNT') || id.includes('👤') || text === '5') {
    await showAccount(businessId, phone, customerId, conversationId, customer);
    return { handled: true };
  }
  if (id.includes('STAFF') || id.includes('💬') || text === '6') {
    await requestStaff(businessId, phone, customerId, conversationId, customer);
    return { handled: true };
  }

  // Unknown command - show menu again
  await sendMainMenu(businessId, phone, customer, conversationId);
  return { handled: true };
};

// ============================================
// BROWSING PRODUCTS (Categories)
// ============================================
const showCategories = async (businessId, phone, customerId, conversationId, customer) => {
  const categories = await productService.getAllCategories(businessId);

  if (categories.length === 0) {
    await whatsappApi.sendText(businessId, phone,
      'Sorry, no categories available at the moment.',
      { conversationId, customerId }
    );
    await sendMainMenu(businessId, phone, customer, conversationId);
    return;
  }

  const sections = [{
    title: 'Categories',
    rows: categories.map((cat, idx) => ({
      id: `CAT_${cat.id}`,
      title: cat.name,
      description: cat.description ? cat.description.substring(0, 50) : ''
    }))
  }];

  await whatsappApi.sendListMessage(businessId, phone, '🛍️ Select a category:', sections, {
    conversationId, customerId, buttonText: 'Browse Categories'
  });

  await conversationState.setState(businessId, customerId, conversationId, conversationState.STATES.BROWSING_PRODUCTS, { page: 1 });
};

const handleBrowsingProducts = async (input, businessId, customerId, conversationId, phone, state) => {
  const id = (input.buttonId || input.listId || '').toUpperCase();
  const text = input.text;

  // Check if a category was selected
  if (id.startsWith('CAT_')) {
    const categoryId = id.replace('CAT_', '');
    await showProductsByCategory(businessId, phone, customerId, conversationId, categoryId, 1, state);
    return { handled: true };
  }

  // Check if a product was selected
  if (id.startsWith('PROD_')) {
    const productId = id.replace('PROD_', '');
    await showProductDetail(businessId, phone, customerId, conversationId, productId, state);
    return { handled: true };
  }

  // Pagination
  if (id === 'NEXT_PAGE') {
    const nextPage = (state.state_data?.page || 1) + 1;
    const categoryId = state.state_data?.categoryId;
    if (categoryId) {
      await showProductsByCategory(businessId, phone, customerId, conversationId, categoryId, nextPage, state);
    } else {
      await showCategories(businessId, phone, customerId, conversationId, { id: customerId });
    }
    return { handled: true };
  }

  if (id === 'PREV_PAGE') {
    const prevPage = Math.max(1, (state.state_data?.page || 1) - 1);
    const categoryId = state.state_data?.categoryId;
    if (categoryId) {
      await showProductsByCategory(businessId, phone, customerId, conversationId, categoryId, prevPage, state);
    }
    return { handled: true };
  }

  if (id === 'BACK_TO_CATEGORIES') {
    await showCategories(businessId, phone, customerId, conversationId, { id: customerId });
    return { handled: true };
  }

  // Default: show categories
  await showCategories(businessId, phone, customerId, conversationId, { id: customerId });
  return { handled: true };
};

const showProductsByCategory = async (businessId, phone, customerId, conversationId, categoryId, page, state) => {
  const products = await productService.getProductsByCategory(categoryId, businessId);

  if (products.length === 0) {
    await whatsappApi.sendText(businessId, phone, 'No products found in this category.', { conversationId, customerId });
    await showCategories(businessId, phone, customerId, conversationId, { id: customerId });
    return;
  }

  const start = (page - 1) * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  const pageProducts = products.slice(start, end);
  const hasMore = end < products.length;
  const hasPrev = page > 1;

  const sections = [{
    title: 'Products',
    rows: pageProducts.map(p => ({
      id: `PROD_${p.id}`,
      title: p.name,
      description: `${p.price ? 'RM' + p.price : ''} | Stock: ${p.stock_quantity || 0}`
    }))
  }];

  if (hasMore) {
    sections.push({
      title: 'Navigation',
      rows: [{ id: 'NEXT_PAGE', title: '➡️ Next Page', description: 'More products' }]
    });
  }
  if (hasPrev) {
    sections.push({
      title: 'Navigation',
      rows: [{ id: 'PREV_PAGE', title: '⬅️ Previous Page', description: 'Go back' }]
    });
  }

  sections.push({
    title: 'Navigation',
    rows: [{ id: 'BACK_TO_CATEGORIES', title: '🔙 Back to Categories', description: 'Browse other categories' }]
  });

  await whatsappApi.sendListMessage(businessId, phone, `🛍️ Products (Page ${page}):`, sections, {
    conversationId, customerId, buttonText: 'View Products'
  });

  await conversationState.setState(businessId, customerId, conversationId, conversationState.STATES.BROWSING_PRODUCTS, {
    ...state.state_data, categoryId, page
  });
};

// ============================================
// PRODUCT DETAIL
// ============================================
const showProductDetail = async (businessId, phone, customerId, conversationId, productId, state) => {
  const product = await productService.getProductById(productId, businessId);

  if (!product) {
    await whatsappApi.sendText(businessId, phone, 'Sorry, that product is no longer available.', { conversationId, customerId });
    await showCategories(businessId, phone, customerId, conversationId, { id: customerId });
    return;
  }

  // Get price for this customer
  const price = await pricingService.getProductPrice(productId, customerId, businessId);
  const displayPrice = price !== null ? price : product.price;

  const body = `*${product.name}*\n\n${product.description || ''}\n\n💰 Price: RM${displayPrice}\n📦 Stock: ${product.stock_quantity || 0} available`;

  const buttons = [
    { id: `ADD_${product.id}`, title: '🛒 Add to Cart' },
    { id: 'BACK_TO_PRODUCTS', title: '🔙 Back' },
    { id: 'MAIN_MENU', title: '🏠 Menu' }
  ];

  await whatsappApi.sendButtonMessage(businessId, phone, body, buttons, {
    conversationId, customerId, header: product.name
  });

  await conversationState.setState(businessId, customerId, conversationId, conversationState.STATES.VIEWING_PRODUCT, {
    productId: product.id,
    categoryId: state.state_data?.categoryId,
    page: state.state_data?.page
  });
};

const handleViewingProduct = async (input, businessId, customerId, conversationId, phone, state) => {
  const id = (input.buttonId || input.listId || '').toUpperCase();

  if (id.startsWith('ADD_')) {
    const productId = id.replace('ADD_', '');
    const product = await productService.getProductById(productId, businessId);

    if (!product || product.stock_quantity <= 0) {
      await whatsappApi.sendText(businessId, phone, 'Sorry, this product is currently out of stock.', { conversationId, customerId });
      return { handled: true };
    }

    // Ask for quantity
    const buttons = [
      { id: 'QTY_1', title: '1' },
      { id: 'QTY_2', title: '2' },
      { id: 'QTY_5', title: '5' },
      { id: 'QTY_10', title: '10' }
    ];

    await whatsappApi.sendButtonMessage(businessId, phone,
      `How many *${product.name}* would you like?\n\nOr type any quantity.`,
      buttons, { conversationId, customerId }
    );

    await conversationState.setState(businessId, customerId, conversationId, conversationState.STATES.SELECTING_QUANTITY, {
      productId,
      categoryId: state.state_data?.categoryId,
      page: state.state_data?.page
    });
    return { handled: true };
  }

  if (id === 'BACK_TO_PRODUCTS') {
    const categoryId = state.state_data?.categoryId;
    const page = state.state_data?.page || 1;
    if (categoryId) {
      await showProductsByCategory(businessId, phone, customerId, conversationId, categoryId, page, state);
    } else {
      await showCategories(businessId, phone, customerId, conversationId, { id: customerId });
    }
    return { handled: true };
  }

  if (id === 'MAIN_MENU') {
    await sendMainMenu(businessId, phone, { id: customerId }, conversationId);
    await conversationState.resetToMainMenu(businessId, customerId, conversationId);
    return { handled: true };
  }

  // Default: stay on product
  return { handled: true };
};

// ============================================
// QUANTITY SELECTION
// ============================================
const handleSelectingQuantity = async (input, businessId, customerId, conversationId, phone, state) => {
  const id = (input.buttonId || input.listId || '').toUpperCase();
  const text = input.text.trim();
  const productId = state.state_data?.productId;

  if (!productId) {
    await whatsappApi.sendText(businessId, phone, 'Something went wrong. Let\'s start over.', { conversationId, customerId });
    await sendMainMenu(businessId, phone, { id: customerId }, conversationId);
    return { handled: true };
  }

  let quantity = 1;
  if (id.startsWith('QTY_')) {
    quantity = parseInt(id.replace('QTY_', '')) || 1;
  } else {
    quantity = parseInt(text) || 0;
  }

  if (!quantity || quantity <= 0 || !Number.isInteger(quantity)) {
    await whatsappApi.sendText(businessId, phone, 'Please enter a valid whole number greater than 0.', { conversationId, customerId });
    return { handled: true };
  }

  const product = await productService.getProductById(productId, businessId);
  if (!product) {
    await whatsappApi.sendText(businessId, phone, 'Product not found.', { conversationId, customerId });
    await showCategories(businessId, phone, customerId, conversationId, { id: customerId });
    return { handled: true };
  }

  if (quantity > product.stock_quantity) {
    await whatsappApi.sendText(businessId, phone,
      `Sorry, we only have ${product.stock_quantity} units of *${product.name}* in stock.`,
      { conversationId, customerId }
    );
    return { handled: true };
  }

  // Add to cart using existing cart service
  try {
    const price = await pricingService.getProductPrice(productId, customerId, businessId);
    const unitPrice = price !== null ? price : product.price;

    await cartService.addToCart(businessId, customerId, productId, quantity, unitPrice);

    const subtotal = (unitPrice * quantity).toFixed(2);
    const message = `✅ Added to your cart!\n\n*${product.name}*\nQuantity: ${quantity}\nUnit price: RM${unitPrice}\nSubtotal: RM${subtotal}`;

    const buttons = [
      { id: 'VIEW_CART', title: '🛒 View Cart' },
      { id: 'CONTINUE_SHOPPING', title: '🛍 Continue' },
      { id: 'CHECKOUT', title: '💳 Checkout' }
    ];

    await whatsappApi.sendButtonMessage(businessId, phone, message, buttons, { conversationId, customerId });
    await conversationState.setState(businessId, customerId, conversationId, conversationState.STATES.CART, {});
  } catch (error) {
    console.error('Add to cart error:', error);
    await whatsappApi.sendText(businessId, phone,
      'Sorry, something went wrong adding to cart. Please try again.',
      { conversationId, customerId }
    );
  }

  return { handled: true };
};

// ============================================
// SEARCH PRODUCTS
// ============================================
const handleSearchingProducts = async (input, businessId, customerId, conversationId, phone, state) => {
  const searchTerm = input.text.trim();

  if (!searchTerm || searchTerm.length < 2) {
    await whatsappApi.sendText(businessId, phone,
      'Please type at least 2 characters to search.',
      { conversationId, customerId }
    );
    return { handled: true };
  }

  const products = await productService.searchProducts(searchTerm, businessId);

  if (products.length === 0) {
    await whatsappApi.sendText(businessId, phone,
      `No products found for "${searchTerm}".\n\nTry another keyword or browse categories.`,
      { conversationId, customerId }
    );
    const buttons = [
      { id: 'MENU_PRODUCTS', title: '🛍️ Browse Products' },
      { id: 'MAIN_MENU', title: '🏠 Main Menu' }
    ];
    await whatsappApi.sendButtonMessage(businessId, phone, 'What would you like to do?', buttons, { conversationId, customerId });
    await conversationState.setState(businessId, customerId, conversationId, conversationState.STATES.MAIN_MENU);
    return { handled: true };
  }

  const sections = [{
    title: `Search Results (${products.length})`,
    rows: products.slice(0, ITEMS_PER_PAGE).map(p => ({
      id: `PROD_${p.id}`,
      title: p.name,
      description: `${p.price ? 'RM' + p.price : ''} | Stock: ${p.stock_quantity || 0}`
    }))
  }];

  if (products.length > ITEMS_PER_PAGE) {
    sections[0].rows.push({
      id: 'MORE_RESULTS',
      title: '➡️ More Results',
      description: 'Show more products'
    });
  }

  sections.push({
    title: 'Navigation',
    rows: [
      { id: 'SEARCH_AGAIN', title: '🔎 New Search', description: 'Search again' },
      { id: 'MAIN_MENU', title: '🏠 Main Menu', description: 'Back to menu' }
    ]
  });

  await whatsappApi.sendListMessage(businessId, phone, `Results for "${searchTerm}":`, sections, {
    conversationId, customerId, buttonText: 'View Results'
  });

  await conversationState.setState(businessId, customerId, conversationId, conversationState.STATES.BROWSING_PRODUCTS, {
    searchTerm, page: 1
  });

  return { handled: true };
};

// ============================================
// CART
// ============================================
const showCart = async (businessId, phone, customerId, conversationId, customer) => {
  const cart = await cartService.getCart(businessId, customerId);

  if (!cart || !cart.items || cart.items.length === 0) {
    await whatsappApi.sendText(businessId, phone,
      '🛒 Your cart is empty.\n\nBrowse our products to get started!',
      { conversationId, customerId }
    );
    await sendMainMenu(businessId, phone, customer, conversationId);
    await conversationState.resetToMainMenu(businessId, customerId, conversationId);
    return;
  }

  let message = '🛒 *Your Cart*\n\n';
  cart.items.forEach((item, idx) => {
    message += `${idx + 1}. ${item.product_name}\n   ${item.quantity} x RM${item.unit_price} = RM${item.subtotal}\n\n`;
  });
  message += `*Total: RM${cart.total}*`;

  const buttons = [
    { id: 'CHECKOUT', title: '💳 Checkout' },
    { id: 'CONTINUE_SHOPPING', title: '🛍 Continue' },
    { id: 'CLEAR_CART', title: '🗑 Clear' }
  ];

  await whatsappApi.sendButtonMessage(businessId, phone, message, buttons, { conversationId, customerId });
  await conversationState.setState(businessId, customerId, conversationId, conversationState.STATES.CART, {});
};

const handleCart = async (input, businessId, customerId, conversationId, phone, state) => {
  const id = (input.buttonId || input.listId || '').toUpperCase();

  if (id === 'CHECKOUT' || id.includes('CHECKOUT')) {
    await startCheckout(businessId, phone, customerId, conversationId);
    return { handled: true };
  }

  if (id === 'CONTINUE_SHOPPING' || id.includes('SHOPPING')) {
    await showCategories(businessId, phone, customerId, conversationId, { id: customerId });
    return { handled: true };
  }

  if (id === 'CLEAR_CART' || id.includes('CLEAR')) {
    await cartService.clearCart(businessId, customerId);
    await whatsappApi.sendText(businessId, phone, '🗑 Your cart has been cleared.', { conversationId, customerId });
    await sendMainMenu(businessId, phone, { id: customerId }, conversationId);
    await conversationState.resetToMainMenu(businessId, customerId, conversationId);
    return { handled: true };
  }

  if (id === 'MAIN_MENU') {
    await sendMainMenu(businessId, phone, { id: customerId }, conversationId);
    await conversationState.resetToMainMenu(businessId, customerId, conversationId);
    return { handled: true };
  }

  // Default: show cart again
  await showCart(businessId, phone, customerId, conversationId, { id: customerId });
  return { handled: true };
};

// ============================================
// CHECKOUT
// ============================================
const startCheckout = async (businessId, phone, customerId, conversationId) => {
  const cart = await cartService.getCart(businessId, customerId);

  if (!cart || !cart.items || cart.items.length === 0) {
    await whatsappApi.sendText(businessId, phone, 'Your cart is empty.', { conversationId, customerId });
    await sendMainMenu(businessId, phone, { id: customerId }, conversationId);
    return;
  }

  // Revalidate stock and prices
  let priceChanged = false;
  let stockIssue = false;
  const issues = [];

  for (const item of cart.items) {
    const product = await productService.getProductById(item.product_id, businessId);
    if (!product) {
      stockIssue = true;
      issues.push(`${item.product_name} is no longer available.`);
      continue;
    }
    if (product.stock_quantity < item.quantity) {
      stockIssue = true;
      issues.push(`${product.name}: Only ${product.stock_quantity} available (you have ${item.quantity}).`);
    }
    const currentPrice = await pricingService.getProductPrice(item.product_id, customerId, businessId);
    const displayPrice = currentPrice !== null ? currentPrice : product.price;
    if (parseFloat(displayPrice) !== parseFloat(item.unit_price)) {
      priceChanged = true;
      issues.push(`${product.name}: Price changed from RM${item.unit_price} to RM${displayPrice}.`);
    }
  }

  if (stockIssue || priceChanged) {
    let msg = '⚠️ Please review your cart:\n\n';
    msg += issues.join('\n');
    await whatsappApi.sendText(businessId, phone, msg, { conversationId, customerId });
    await showCart(businessId, phone, customerId, conversationId, { id: customerId });
    return;
  }

  // Get customer addresses
  const addresses = await getCustomerAddresses(customerId, businessId);

  if (addresses.length === 0) {
    await whatsappApi.sendText(businessId, phone,
      '📍 Please provide your delivery address.\n\nReply with your address in this format:\n\nFull Name\nPhone\nStreet Address\nCity\nState\nPostal Code\nCountry',
      { conversationId, customerId }
    );
    await conversationState.setState(businessId, customerId, conversationId, conversationState.STATES.ADDING_ADDRESS, { checkout: true });
    return;
  }

  // Show address selection
  const sections = [{
    title: 'Saved Addresses',
    rows: addresses.map((addr, idx) => ({
      id: `ADDR_${addr.id}`,
      title: addr.label || `Address ${idx + 1}`,
      description: `${addr.address}, ${addr.city}`.substring(0, 72)
    }))
  }];

  sections.push({
    title: 'Options',
    rows: [
      { id: 'ADD_NEW_ADDRESS', title: '➕ New Address', description: 'Add a new delivery address' },
      { id: 'CANCEL_CHECKOUT', title: '❌ Cancel', description: 'Back to cart' }
    ]
  });

  await whatsappApi.sendListMessage(businessId, phone, '📍 Select delivery address:', sections, {
    conversationId, customerId, buttonText: 'Select Address'
  });

  await conversationState.setState(businessId, customerId, conversationId, conversationState.STATES.SELECTING_ADDRESS, {});
};

const handleCheckout = async (input, businessId, customerId, conversationId, phone, state, customer) => {
  // This state is mostly a transition state; actual checkout logic is in SELECTING_ADDRESS and ORDER_CONFIRMATION
  await startCheckout(businessId, phone, customerId, conversationId);
  return { handled: true };
};

const handleSelectingAddress = async (input, businessId, customerId, conversationId, phone, state) => {
  const id = (input.buttonId || input.listId || '').toUpperCase();

  if (id.startsWith('ADDR_')) {
    const addressId = id.replace('ADDR_', '');
    const addresses = await getCustomerAddresses(customerId, businessId);
    const selectedAddress = addresses.find(a => a.id === addressId);

    if (!selectedAddress) {
      await whatsappApi.sendText(businessId, phone, 'Address not found.', { conversationId, customerId });
      await startCheckout(businessId, phone, customerId, conversationId);
      return { handled: true };
    }

    await showOrderConfirmation(businessId, phone, customerId, conversationId, selectedAddress);
    return { handled: true };
  }

  if (id === 'ADD_NEW_ADDRESS') {
    await whatsappApi.sendText(businessId, phone,
      '📍 Please provide your delivery address.\n\nReply with your address in this format:\n\nFull Name\nPhone\nStreet Address\nCity\nState\nPostal Code\nCountry',
      { conversationId, customerId }
    );
    await conversationState.setState(businessId, customerId, conversationId, conversationState.STATES.ADDING_ADDRESS, { checkout: true });
    return { handled: true };
  }

  if (id === 'CANCEL_CHECKOUT') {
    await showCart(businessId, phone, customerId, conversationId, { id: customerId });
    return { handled: true };
  }

  await startCheckout(businessId, phone, customerId, conversationId);
  return { handled: true };
};

const handleAddingAddress = async (input, businessId, customerId, conversationId, phone, state) => {
  const lines = input.text.split('\n').map(l => l.trim()).filter(Boolean);

  if (lines.length < 3) {
    await whatsappApi.sendText(businessId, phone,
      'Please provide a complete address. Use this format:\n\nFull Name\nPhone\nStreet Address\nCity\nState\nPostal Code\nCountry',
      { conversationId, customerId }
    );
    return { handled: true };
  }

  const [fullName, phoneNum, address, city, stateName, postalCode, country] = lines;

  const newAddress = await query(
    `INSERT INTO customer_addresses (customer_id, business_id, full_name, phone, address, city, state, postal_code, country, is_default)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
     RETURNING *`,
    [customerId, businessId, fullName || null, phoneNum || null, address, city || null, stateName || null, postalCode || null, country || 'Malaysia']
  );

  await whatsappApi.sendText(businessId, phone, '✅ Address saved!', { conversationId, customerId });

  if (state.state_data?.checkout) {
    await showOrderConfirmation(businessId, phone, customerId, conversationId, newAddress.rows[0]);
  } else {
    await sendMainMenu(businessId, phone, { id: customerId }, conversationId);
    await conversationState.resetToMainMenu(businessId, customerId, conversationId);
  }

  return { handled: true };
};

const showOrderConfirmation = async (businessId, phone, customerId, conversationId, address) => {
  const cart = await cartService.getCart(businessId, customerId);

  let message = '📋 *Order Summary*\n\n';
  cart.items.forEach(item => {
    message += `${item.product_name} x ${item.quantity} = RM${item.subtotal}\n`;
  });

  const subtotal = parseFloat(cart.total);
  const shipping = 5; // Default shipping - should come from settings
  const total = subtotal + shipping;

  message += `\nSubtotal: RM${subtotal.toFixed(2)}\n`;
  message += `Delivery: RM${shipping.toFixed(2)}\n`;
  message += `*Total: RM${total.toFixed(2)}*\n\n`;
  message += `📍 ${address.address}, ${address.city}, ${address.state || ''} ${address.postal_code || ''}`;

  const buttons = [
    { id: 'CONFIRM_ORDER', title: '✅ Confirm' },
    { id: 'CANCEL_ORDER', title: '❌ Cancel' }
  ];

  await whatsappApi.sendButtonMessage(businessId, phone, message, buttons, {
    conversationId, customerId, header: 'Confirm Your Order'
  });

  await conversationState.setState(businessId, customerId, conversationId, conversationState.STATES.ORDER_CONFIRMATION, {
    addressId: address.id,
    cartTotal: total
  });
};

const handleOrderConfirmation = async (input, businessId, customerId, conversationId, phone, state) => {
  const id = (input.buttonId || input.listId || '').toUpperCase();

  if (id === 'CONFIRM_ORDER') {
    // Prevent duplicate orders using idempotency
    const idempotencyKey = `order_${businessId}_${customerId}_${conversationId}_${Date.now()}`;

    const existingCheck = await query(
      `SELECT 1 FROM orders WHERE business_id = $1 AND customer_id = $2 AND created_at > NOW() - INTERVAL '2 minutes'`,
      [businessId, customerId]
    );

    if (existingCheck.rows.length > 0) {
      await whatsappApi.sendText(businessId, phone,
        '⏳ We are processing your order. Please wait a moment.',
        { conversationId, customerId }
      );
      return { handled: true };
    }

    try {
      const cart = await cartService.getCart(businessId, customerId);
      const addressId = state.state_data?.addressId;
      const addressResult = await query(`SELECT * FROM customer_addresses WHERE id = $1`, [addressId]);
      const address = addressResult.rows[0];

      const orderData = {
        customerId,
        items: cart.items.map(i => ({
          productId: i.product_id,
          quantity: i.quantity,
          unitPrice: i.unit_price
        })),
        deliveryAddress: address ? `${address.address}, ${address.city}, ${address.state || ''} ${address.postal_code || ''}` : '',
        deliveryCity: address?.city || '',
        deliveryCountry: address?.country || 'Malaysia',
        deliveryPhone: address?.phone || '',
        notes: 'Order via WhatsApp',
        source: 'whatsapp'
      };

      const order = await checkoutService.createOrder(orderData, businessId, null);

      // Clear cart after successful order
      await cartService.clearCart(businessId, customerId);

      const message = `🎉 *Order Confirmed!*\n\nOrder: *${order.order_number}*\nTotal: RM${order.total_amount}\nPayment: Unpaid\nStatus: Pending\n\nThank you for your order!`;

      const buttons = [
        { id: `VIEW_ORDER_${order.id}`, title: '📦 View Order' },
        { id: 'CONTINUE_SHOPPING', title: '🛍 Continue' },
        { id: 'MAIN_MENU', title: '🏠 Menu' }
      ];

      await whatsappApi.sendButtonMessage(businessId, phone, message, buttons, { conversationId, customerId });
      await conversationState.setState(businessId, customerId, conversationId, conversationState.STATES.VIEWING_ORDERS, {});
    } catch (error) {
      console.error('Order creation error:', error);
      await whatsappApi.sendText(businessId, phone,
        'Sorry, we could not create your order. Please try again or contact our staff.',
        { conversationId, customerId }
      );
    }

    return { handled: true };
  }

  if (id === 'CANCEL_ORDER') {
    await whatsappApi.sendText(businessId, phone, 'Order cancelled. Your cart is still saved.', { conversationId, customerId });
    await showCart(businessId, phone, customerId, conversationId, { id: customerId });
    return { handled: true };
  }

  await showOrderConfirmation(businessId, phone, customerId, conversationId, { id: state.state_data?.addressId });
  return { handled: true };
};

// ============================================
// ORDERS
// ============================================
const showOrders = async (businessId, phone, customerId, conversationId, customer, page) => {
  const orders = await orderService.getCustomerOrders(customerId, businessId);

  if (!orders || orders.length === 0) {
    await whatsappApi.sendText(businessId, phone, '📦 You have no orders yet.', { conversationId, customerId });
    await sendMainMenu(businessId, phone, customer, conversationId);
    return;
  }

  const sections = [{
    title: 'Your Orders',
    rows: orders.slice(0, ITEMS_PER_PAGE).map(o => ({
      id: `ORDER_${o.id}`,
      title: `#${o.order_number || o.id}`,
      description: `RM${o.total_amount} — ${o.status}`
    }))
  }];

  sections.push({
    title: 'Navigation',
    rows: [{ id: 'MAIN_MENU', title: '🏠 Main Menu', description: 'Back to menu' }]
  });

  await whatsappApi.sendListMessage(businessId, phone, '📦 Your Recent Orders:', sections, {
    conversationId, customerId, buttonText: 'View Orders'
  });

  await conversationState.setState(businessId, customerId, conversationId, conversationState.STATES.VIEWING_ORDERS, { page });
};

const handleViewingOrders = async (input, businessId, customerId, conversationId, phone, state) => {
  const id = (input.buttonId || input.listId || '').toUpperCase();

  if (id.startsWith('ORDER_')) {
    const orderId = id.replace('ORDER_', '');
    await showOrderDetail(businessId, phone, customerId, conversationId, orderId);
    return { handled: true };
  }

  if (id === 'MAIN_MENU') {
    await sendMainMenu(businessId, phone, { id: customerId }, conversationId);
    await conversationState.resetToMainMenu(businessId, customerId, conversationId);
    return { handled: true };
  }

  await showOrders(businessId, phone, customerId, conversationId, { id: customerId }, 1);
  return { handled: true };
};

const showOrderDetail = async (businessId, phone, customerId, conversationId, orderId) => {
  const order = await orderService.getOrderById(orderId, businessId);

  if (!order || order.customer_id !== customerId) {
    await whatsappApi.sendText(businessId, phone, 'Order not found.', { conversationId, customerId });
    return;
  }

  let message = `📦 *Order #${order.order_number || order.id}*\n\n`;
  message += `Date: ${new Date(order.created_at).toLocaleDateString()}\n`;
  message += `Status: ${order.status}\n`;
  message += `Payment: ${order.payment_status || 'Unpaid'}\n\n`;
  message += `Items:\n`;
  order.items?.forEach(item => {
    message += `• ${item.product_name} x ${item.quantity} = RM${item.total_price}\n`;
  });
  message += `\nTotal: RM${order.total_amount}`;

  const buttons = [
    { id: 'BACK_TO_ORDERS', title: '🔙 Back' },
    { id: 'MAIN_MENU', title: '🏠 Menu' }
  ];

  await whatsappApi.sendButtonMessage(businessId, phone, message, buttons, { conversationId, customerId });
  await conversationState.setState(businessId, customerId, conversationId, conversationState.STATES.VIEWING_ORDER, { orderId });
};

const handleViewingOrder = async (input, businessId, customerId, conversationId, phone, state) => {
  const id = (input.buttonId || input.listId || '').toUpperCase();

  if (id === 'BACK_TO_ORDERS') {
    await showOrders(businessId, phone, customerId, conversationId, { id: customerId }, 1);
    return { handled: true };
  }

  await sendMainMenu(businessId, phone, { id: customerId }, conversationId);
  await conversationState.resetToMainMenu(businessId, customerId, conversationId);
  return { handled: true };
};

// ============================================
// ACCOUNT
// ============================================
const showAccount = async (businessId, phone, customerId, conversationId, customer) => {
  let message = '👤 *My Account*\n\n';
  message += `Name: ${customer.full_name || 'Not set'}\n`;
  message += `Phone: ${customer.phone}\n`;
  message += `Type: ${customer.customer_type?.toUpperCase() || 'B2C'}\n`;

  if (customer.customer_type === 'b2b' || customer.customer_type === 'dealer') {
    message += `Credit Limit: RM${customer.credit_limit || 0}\n`;
    message += `Payment Terms: ${customer.payment_terms || 'Immediate'}\n`;
  }

  const buttons = [
    { id: 'VIEW_ADDRESSES', title: '📍 Addresses' },
    { id: 'MAIN_MENU', title: '🏠 Menu' }
  ];

  await whatsappApi.sendButtonMessage(businessId, phone, message, buttons, { conversationId, customerId });
  await conversationState.setState(businessId, customerId, conversationId, conversationState.STATES.VIEWING_ACCOUNT);
};

const handleViewingAccount = async (input, businessId, customerId, conversationId, phone, state, customer) => {
  const id = (input.buttonId || input.listId || '').toUpperCase();

  if (id === 'VIEW_ADDRESSES') {
    const addresses = await getCustomerAddresses(customerId, businessId);
    if (addresses.length === 0) {
      await whatsappApi.sendText(businessId, phone, 'No saved addresses.\n\nGo to checkout to add one.', { conversationId, customerId });
    } else {
      let msg = '📍 *Saved Addresses*\n\n';
      addresses.forEach((addr, idx) => {
        msg += `${idx + 1}. ${addr.label || 'Address'}\n${addr.address}, ${addr.city}\n\n`;
      });
      await whatsappApi.sendText(businessId, phone, msg, { conversationId, customerId });
    }
    await showAccount(businessId, phone, customerId, conversationId, customer);
    return { handled: true };
  }

  await sendMainMenu(businessId, phone, customer, conversationId);
  await conversationState.resetToMainMenu(businessId, customerId, conversationId);
  return { handled: true };
};

// ============================================
// STAFF HANDOFF
// ============================================
const requestStaff = async (businessId, phone, customerId, conversationId, customer) => {
  await whatsappApi.sendText(businessId, phone,
    '💬 You are now connected to our team. A staff member will assist you shortly.\n\nType "menu" anytime to return to the main menu.',
    { conversationId, customerId }
  );

  await conversationState.setState(businessId, customerId, conversationId, conversationState.STATES.WAITING_FOR_STAFF);

  // Notify staff (placeholder - would integrate with notification system)
  console.log(`[STAFF] Customer ${customer.full_name || customer.phone} requested staff assistance for business ${businessId}`);
};

const handleWaitingForStaff = async (input, businessId, customerId, conversationId, phone) => {
  const text = input.text.toLowerCase();

  if (text === 'menu' || text === 'home' || text === 'main menu') {
    await sendMainMenu(businessId, phone, { id: customerId }, conversationId);
    await conversationState.setState(businessId, customerId, conversationId, conversationState.STATES.MAIN_MENU, { staff_handling: false });
    return { handled: true };
  }

  // Message is stored by webhook; staff handles via dashboard
  await whatsappApi.sendText(businessId, phone,
    '⏳ Please wait, our team will respond shortly.\n\nType "menu" to return to the main menu.',
    { conversationId, customerId }
  );

  return { handled: true };
};

// ============================================
// HELPERS
// ============================================
const getCustomerAddresses = async (customerId, businessId) => {
  const result = await query(
    `SELECT * FROM customer_addresses WHERE customer_id = $1 AND business_id = $2 ORDER BY is_default DESC, created_at DESC`,
    [customerId, businessId]
  );
  return result.rows;
};
