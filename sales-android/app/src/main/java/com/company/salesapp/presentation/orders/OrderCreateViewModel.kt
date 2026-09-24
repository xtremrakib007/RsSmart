package com.company.salesapp.presentation.orders

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.company.salesapp.data.local.dao.*
import com.company.salesapp.data.local.entity.*
import com.company.salesapp.data.repository.AuthRepository
import com.company.salesapp.sync.SyncManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.util.*
import javax.inject.Inject

@HiltViewModel
class OrderCreateViewModel @Inject constructor(
    private val productDao: ProductDao,
    private val customerDao: CustomerDao,
    private val orderDao: OrderDao,
    private val orderItemDao: OrderItemDao,
    private val authRepository: AuthRepository,
    private val syncManager: SyncManager
) : ViewModel() {
    private val _products = MutableStateFlow<List<ProductEntity>>(emptyList())
    val products: StateFlow<List<ProductEntity>> = _products.asStateFlow()
    private val _customer = MutableStateFlow<CustomerEntity?>(null)
    val customer: StateFlow<CustomerEntity?> = _customer.asStateFlow()
    private val _cart = MutableStateFlow(Cart())
    val cart: StateFlow<Cart> = _cart.asStateFlow()
    private var allProducts = emptyList<ProductEntity>()

    init {
        viewModelScope.launch {
            productDao.getAll().collect { allProducts = it; _products.value = it }
        }
    }
    fun loadCustomer(customerId: String) { viewModelScope.launch { _customer.value = customerDao.getById(customerId) } }
    fun searchProducts(query: String) { _products.value = if (query.isBlank()) allProducts else allProducts.filter { it.name.contains(query, ignoreCase = true) || it.sku.contains(query, ignoreCase = true) } }
    fun addToCart(product: ProductEntity, quantity: Double) { _cart.update { it.addItem(CartItem(product.id, product.name, quantity, product.basePrice, product.taxRate)) } }
    fun removeItem(productId: String) { _cart.update { it.removeItem(productId) } }
    fun submitOrder() {
        viewModelScope.launch {
            val tenantId = authRepository.tenantId.first() ?: return@launch
            val userId = authRepository.userId.first() ?: return@launch
            val customer = _customer.value ?: return@launch
            val currentCart = _cart.value
            val orderId = UUID.randomUUID().toString()
            val order = OrderEntity(id = orderId, tenantId = tenantId, customerId = customer.id, customerName = customer.name, salesRepId = userId, subtotal = currentCart.subtotal, taxAmount = currentCart.tax, total = currentCart.total)
            orderDao.insert(order)
            currentCart.items.forEach { item ->
                orderItemDao.insert(OrderItemEntity(id = UUID.randomUUID().toString(), orderId = orderId, productId = item.productId, productName = item.productName, quantity = item.quantity, unitPrice = item.unitPrice, taxRate = item.taxRate, taxAmount = item.taxAmount, total = item.total))
            }
            syncManager.queueEvent("order", orderId, "CREATE", mapOf("id" to orderId, "customerId" to customer.id, "salesRepId" to userId, "items" to currentCart.items.map { mapOf("productId" to it.productId, "quantity" to it.quantity, "unitPrice" to it.unitPrice, "taxRate" to it.taxRate) }, "total" to currentCart.total, "tenantId" to tenantId))
        }
    }
}

data class CartItem(val productId: String, val productName: String, val quantity: Double, val unitPrice: Double, val taxRate: Double) {
    val taxAmount: Double = (quantity * unitPrice * taxRate / 100)
    val total: Double = (quantity * unitPrice) + taxAmount
}
data class Cart(val items: List<CartItem> = emptyList()) {
    val subtotal: Double = items.sumOf { it.quantity * it.unitPrice }
    val tax: Double = items.sumOf { it.taxAmount }
    val total: Double = items.sumOf { it.total }
    fun addItem(item: CartItem): Cart = copy(items = items + item)
    fun removeItem(productId: String): Cart = copy(items = items.filter { it.productId != productId })
}
