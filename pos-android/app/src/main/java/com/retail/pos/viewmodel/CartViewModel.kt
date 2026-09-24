package com.retail.pos.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.retail.pos.session.PosSessionProvider
import com.retail.shared.data.local.dao.CartDao
import com.retail.shared.data.local.dao.ProductDao
import com.retail.shared.data.local.entity.CartItem
import com.retail.shared.data.local.entity.Product
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class CartViewModel @Inject constructor(
    private val cartDao: CartDao,
    private val productDao: ProductDao,
    private val sessionProvider: PosSessionProvider
) : ViewModel() {

    // Sourced from the shared session provider so every screen agrees on which
    // POS session is active, instead of each screen setting its own placeholder.
    val sessionId: StateFlow<String> = sessionProvider.activeSessionId
        .map { it ?: "" }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), "")

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    val products: StateFlow<List<Product>> = combine(_searchQuery, sessionProvider.tenantId) { query, tenantId ->
        query to tenantId
    }.flatMapLatest { (query, tenantId) ->
        if (query.isBlank()) productDao.getAllActive(tenantId)
        else productDao.search(tenantId, query)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val cartItems: StateFlow<List<CartItem>> = sessionId
        .flatMapLatest { sid ->
            if (sid.isBlank()) flowOf(emptyList()) else cartDao.getBySession(sid)
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val cartTotal: StateFlow<Double> = sessionId
        .flatMapLatest { sid ->
            if (sid.isBlank()) flowOf(0.0) else cartDao.getCartTotal(sid).map { it ?: 0.0 }
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0.0)

    val itemCount: StateFlow<Int> = sessionId
        .flatMapLatest { sid ->
            if (sid.isBlank()) flowOf(0) else cartDao.getItemCount(sid)
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    fun setSearchQuery(query: String) {
        _searchQuery.value = query
    }

    fun addToCart(product: Product, quantity: Double = 1.0) {
        viewModelScope.launch {
            val sid = sessionId.value
            if (sid.isBlank()) return@launch
            val existing = cartDao.findByProduct(sid, product.id)
            val tax = product.unitPrice * quantity * product.taxRate
            val lineTotal = (product.unitPrice * quantity) + tax

            if (existing != null) {
                val newQty = existing.quantity + quantity
                val newTax = product.unitPrice * newQty * product.taxRate
                val newTotal = (product.unitPrice * newQty) + newTax
                cartDao.update(existing.copy(
                    quantity = newQty,
                    taxAmount = newTax,
                    lineTotal = newTotal
                ))
            } else {
                cartDao.insert(CartItem(
                    sessionId = sid,
                    productId = product.id,
                    productName = product.name,
                    unitPrice = product.unitPrice,
                    quantity = quantity,
                    taxAmount = tax,
                    lineTotal = lineTotal
                ))
            }
        }
    }

    fun updateQuantity(cartItem: CartItem, newQuantity: Double) {
        viewModelScope.launch {
            if (newQuantity <= 0) {
                cartDao.delete(cartItem)
            } else {
                // Re-read the product's tax rate instead of assuming 0 — a flat 0.0 here
                // silently dropped tax whenever a line's quantity was edited after adding.
                val product = productDao.getById(cartItem.productId)
                val taxRate = product?.taxRate ?: 0.0
                val tax = cartItem.unitPrice * newQuantity * taxRate
                val total = (cartItem.unitPrice * newQuantity) + tax
                cartDao.update(cartItem.copy(quantity = newQuantity, lineTotal = total, taxAmount = tax))
            }
        }
    }

    fun removeItem(cartItem: CartItem) {
        viewModelScope.launch { cartDao.delete(cartItem) }
    }

    fun clearCart() {
        viewModelScope.launch { cartDao.clearSession(sessionId.value) }
    }
}
