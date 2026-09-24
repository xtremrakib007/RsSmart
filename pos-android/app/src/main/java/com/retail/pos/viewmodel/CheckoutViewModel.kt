package com.retail.pos.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.retail.pos.session.PosSessionProvider
import com.retail.pos.util.NetworkConnectivityObserver
import com.retail.shared.data.local.dao.CartDao
import com.retail.shared.data.local.dao.OrderDao
import com.retail.shared.data.local.dao.OfflineQueueDao
import com.retail.shared.data.local.dao.PaymentDao
import com.retail.shared.data.local.entity.OfflineQueueItem
import com.retail.shared.data.local.entity.Payment
import com.retail.shared.data.local.entity.PosOrder
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject

@HiltViewModel
class CheckoutViewModel @Inject constructor(
    private val cartDao: CartDao,
    private val orderDao: OrderDao,
    private val offlineQueueDao: OfflineQueueDao,
    private val paymentDao: PaymentDao,
    private val sessionProvider: PosSessionProvider,
    private val connectivityObserver: NetworkConnectivityObserver
) : ViewModel() {

    // Sourced from the shared session provider — same active session as CartViewModel,
    // instead of each screen hardcoding its own "session-active" placeholder.
    val sessionId: StateFlow<String> = sessionProvider.activeSessionId
        .map { it ?: "" }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), "")

    val cartItems = sessionId
        .flatMapLatest { sid ->
            if (sid.isBlank()) flowOf(emptyList()) else cartDao.getBySession(sid)
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val subtotal = cartItems.map { items ->
        items.sumOf { it.unitPrice * it.quantity }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0.0)

    val totalTax = cartItems.map { items ->
        items.sumOf { it.taxAmount }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0.0)

    val grandTotal = cartItems.map { items ->
        items.sumOf { it.lineTotal }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0.0)

    private val _checkoutState = MutableStateFlow<CheckoutState>(CheckoutState.Idle)
    val checkoutState: StateFlow<CheckoutState> = _checkoutState.asStateFlow()

    fun processCheckout(customerId: String?, customerName: String?, paymentMethod: String = "CASH") {
        viewModelScope.launch {
            _checkoutState.value = CheckoutState.Processing
            try {
                val sid = sessionId.value
                if (sid.isBlank()) {
                    _checkoutState.value = CheckoutState.Error("No open POS session")
                    return@launch
                }

                val items = cartDao.getBySessionOnce(sid)
                if (items.isEmpty()) {
                    _checkoutState.value = CheckoutState.Error("Cart is empty")
                    return@launch
                }

                val orderId = UUID.randomUUID().toString()
                val receiptNumber = generateReceiptNumber()
                val sub = items.sumOf { it.unitPrice * it.quantity }
                val tax = items.sumOf { it.taxAmount }
                val total = items.sumOf { it.lineTotal }
                // Real connectivity check — previously this was hardcoded to false, so
                // orders placed while genuinely offline were never flagged for the
                // offline-specific sync/reconciliation path.
                val isOffline = !connectivityObserver.isCurrentlyOnline()

                val order = PosOrder(
                    id = orderId,
                    sessionId = sid,
                    receiptNumber = receiptNumber,
                    subtotal = sub,
                    totalTax = tax,
                    grandTotal = total,
                    customerId = customerId,
                    customerName = customerName,
                    itemCount = items.size,
                    isOffline = isOffline,
                    syncStatus = "PENDING"
                )

                orderDao.insert(order)

                // Record the original payment so refunds can later look up the real
                // tender method instead of assuming CASH.
                val payment = Payment(
                    id = UUID.randomUUID().toString(),
                    orderId = orderId,
                    sessionId = sid,
                    amount = total,
                    method = paymentMethod,
                    isRefund = false,
                    receiptNumber = receiptNumber,
                    syncStatus = "PENDING"
                )
                paymentDao.insert(payment)

                // Queue for sync
                offlineQueueDao.insert(OfflineQueueItem(
                    entityType = "ORDER",
                    entityId = orderId,
                    action = "CREATE",
                    payload = serializeOrder(order, items),
                    priority = 3
                ))
                offlineQueueDao.insert(OfflineQueueItem(
                    entityType = "PAYMENT",
                    entityId = payment.id,
                    action = "CREATE",
                    payload = """{"orderId":"$orderId","amount":$total,"method":"$paymentMethod"}""",
                    priority = 3
                ))

                // Clear cart
                cartDao.clearSession(sid)

                _checkoutState.value = CheckoutState.Success(orderId, receiptNumber)
            } catch (e: Exception) {
                _checkoutState.value = CheckoutState.Error(e.message ?: "Checkout failed")
            }
        }
    }

    fun resetState() {
        _checkoutState.value = CheckoutState.Idle
    }

    private fun generateReceiptNumber(): String {
        return "POS-${System.currentTimeMillis() % 1000000}"
    }

    private fun serializeOrder(order: PosOrder, items: List<com.retail.shared.data.local.entity.CartItem>): String {
        // Simplified JSON serialization — use Gson or kotlinx.serialization in production
        return """{"orderId":"${order.id}","receipt":"${order.receiptNumber}","total":${order.grandTotal},"items":${items.size}}"""
    }

    sealed class CheckoutState {
        object Idle : CheckoutState()
        object Processing : CheckoutState()
        data class Success(val orderId: String, val receiptNumber: String) : CheckoutState()
        data class Error(val message: String) : CheckoutState()
    }
}
