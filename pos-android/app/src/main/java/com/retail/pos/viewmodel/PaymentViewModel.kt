package com.retail.pos.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.retail.pos.service.printer.PrintService
import com.retail.shared.data.local.dao.OrderDao
import com.retail.shared.data.local.entity.PosOrder
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class PaymentViewModel @Inject constructor(
    private val orderDao: OrderDao,
    private val printService: PrintService
) : ViewModel() {

    private val _order = MutableStateFlow<PosOrder?>(null)
    val order: StateFlow<PosOrder?> = _order.asStateFlow()

    val printState: StateFlow<PrintService.PrintState> = printService.printState

    fun loadOrder(orderId: String) {
        viewModelScope.launch {
            _order.value = orderDao.getById(orderId)
        }
    }

    fun printReceipt() {
        val currentOrder = _order.value ?: return
        viewModelScope.launch {
            printService.printReceipt(currentOrder)
        }
    }
}
