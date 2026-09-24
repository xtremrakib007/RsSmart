package com.retail.pos.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.retail.shared.data.local.dao.OrderDao
import com.retail.shared.data.local.dao.SessionDao
import com.retail.shared.data.local.dao.PaymentDao
import com.retail.shared.data.local.entity.OfflineQueueItem
import com.retail.shared.data.local.entity.Payment
import com.retail.shared.data.local.dao.OfflineQueueDao
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject

@HiltViewModel
class ReturnsViewModel @Inject constructor(
    private val orderDao: OrderDao,
    private val sessionDao: SessionDao,
    private val offlineQueueDao: OfflineQueueDao,
    private val paymentDao: PaymentDao
) : ViewModel() {

    private val _refundState = MutableStateFlow<RefundState>(RefundState.Idle)
    val refundState: StateFlow<RefundState> = _refundState

    fun processRefund(receiptNumber: String, amount: Double, reason: String?) {
        viewModelScope.launch {
            _refundState.value = RefundState.Processing
            try {
                val order = orderDao.getByReceipt(receiptNumber)
                if (order == null) {
                    _refundState.value = RefundState.Error("Order not found")
                    return@launch
                }
                if (order.status == "REFUNDED") {
                    _refundState.value = RefundState.Error("Order already refunded")
                    return@launch
                }
                if (amount > order.grandTotal) {
                    _refundState.value = RefundState.Error("Refund exceeds order total")
                    return@launch
                }

                // Mark order as refunded
                orderDao.markRefunded(order.id)
                sessionDao.incrementRefunds(order.sessionId, amount)

                // Match the refund's tender method to the original sale instead of
                // assuming cash — falls back to CASH only if no original payment
                // record exists (e.g. legacy/imported orders).
                val originalMethod = paymentDao.getOriginalPayment(order.id)?.method ?: "CASH"

                // Create refund payment record
                val refundPayment = Payment(
                    id = UUID.randomUUID().toString(),
                    orderId = order.id,
                    sessionId = order.sessionId,
                    amount = amount,
                    method = originalMethod,
                    isRefund = true,
                    syncStatus = "PENDING"
                )
                paymentDao.insert(refundPayment)

                // Queue for sync
                offlineQueueDao.insert(OfflineQueueItem(
                    entityType = "PAYMENT",
                    entityId = refundPayment.id,
                    action = "CREATE",
                    payload = """{"refund":true,"orderId":"${order.id}","amount":$amount,"method":"$originalMethod","reason":"$reason"}""",
                    priority = 2
                ))

                _refundState.value = RefundState.Success
            } catch (e: Exception) {
                _refundState.value = RefundState.Error(e.message ?: "Refund failed")
            }
        }
    }

    fun resetState() {
        _refundState.value = RefundState.Idle
    }

    sealed class RefundState {
        object Idle : RefundState()
        object Processing : RefundState()
        object Success : RefundState()
        data class Error(val message: String) : RefundState()
    }
}
