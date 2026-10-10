package com.retail.pos.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.retail.pos.session.PosSessionProvider
import com.retail.shared.data.local.dao.CustomerDao
import com.retail.shared.data.local.entity.CustomerEntity
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject

@HiltViewModel
class CustomerViewModel @Inject constructor(
    private val customerDao: CustomerDao,
    private val sessionProvider: PosSessionProvider
) : ViewModel() {
    private val searchQuery = MutableStateFlow("")
    private val _message = MutableStateFlow<String?>(null)
    val message: StateFlow<String?> = _message.asStateFlow()

    val customers: StateFlow<List<CustomerEntity>> =
        combine(searchQuery, sessionProvider.tenantId) { query, tenantId -> query to tenantId }
            .flatMapLatest { (query, tenantId) ->
                if (tenantId.isBlank()) kotlinx.coroutines.flow.flowOf(emptyList())
                else if (query.isBlank()) customerDao.getAll(tenantId)
                else customerDao.search(tenantId, query)
            }
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    fun search(query: String) { searchQuery.value = query }

    fun save(id: String?, name: String, phone: String, email: String, loyaltyNumber: String?) {
        viewModelScope.launch {
            val tenantId = sessionProvider.tenantId.firstOrBlank()
            val cleanedName = name.trim()
            val normalizedPhone = normalizeMalaysianPhone(phone)
            if (tenantId.isBlank()) {
                _message.value = "Please sign in again before managing customers."
                return@launch
            }
            if (cleanedName.isBlank()) {
                _message.value = "Customer name is required."
                return@launch
            }
            if (normalizedPhone == null) {
                _message.value = "Enter a valid Malaysian mobile number, e.g. 0123456789 or +60123456789."
                return@launch
            }
            val existing = id?.let { customerDao.findById(it, tenantId) }
            val customer = CustomerEntity(
                id = existing?.id ?: UUID.randomUUID().toString(),
                tenantId = tenantId,
                name = cleanedName,
                phone = normalizedPhone,
                email = email.trim().ifBlank { null },
                loyaltyNumber = loyaltyNumber?.trim()?.ifBlank { null },
                createdAt = existing?.createdAt ?: System.currentTimeMillis(),
                syncStatus = "PENDING"
            )
            if (existing == null) customerDao.insert(customer) else customerDao.update(customer)
            _message.value = if (existing == null) "Customer saved on this device." else "Customer updated on this device."
        }
    }

    fun delete(customer: CustomerEntity) {
        viewModelScope.launch {
            val tenantId = sessionProvider.tenantId.firstOrBlank()
            if (tenantId == customer.tenantId && tenantId.isNotBlank()) {
                customerDao.delete(customer)
                _message.value = "Customer removed from this device."
            }
        }
    }

    fun clearMessage() { _message.value = null }

    private fun normalizeMalaysianPhone(raw: String): String? {
        val digits = raw.filter(Char::isDigit)
        val normalized = when {
            digits.startsWith("60") -> "+$digits"
            digits.startsWith("0") -> "+60" + digits.drop(1)
            digits.startsWith("1") -> "+60$digits"
            else -> return null
        }
        val nationalDigits = normalized.removePrefix("+60")
        if (nationalDigits.length !in 8..10 || !nationalDigits.startsWith("1")) return null
        return normalized
    }
}
