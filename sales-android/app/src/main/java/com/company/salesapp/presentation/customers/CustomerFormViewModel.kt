package com.company.salesapp.presentation.customers

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.company.salesapp.data.local.dao.CustomerDao
import com.company.salesapp.data.local.entity.CustomerEntity
import com.company.salesapp.data.repository.AuthRepository
import com.company.salesapp.sync.SyncManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.util.*
import javax.inject.Inject

@HiltViewModel
class CustomerFormViewModel @Inject constructor(
    private val customerDao: CustomerDao,
    private val authRepository: AuthRepository,
    private val syncManager: SyncManager
) : ViewModel() {

    private val _customer = MutableStateFlow<CustomerEntity?>(null)
    val customer: StateFlow<CustomerEntity?> = _customer.asStateFlow()

    private val _isSaving = MutableStateFlow(false)
    val isSaving: StateFlow<Boolean> = _isSaving.asStateFlow()

    private val _saved = MutableStateFlow(false)
    val saved: StateFlow<Boolean> = _saved.asStateFlow()

    fun loadCustomer(customerId: String) {
        viewModelScope.launch {
            _customer.value = customerDao.getById(customerId)
        }
    }

    fun save(name: String, email: String, phone: String, address: String, city: String, state: String, category: String) {
        viewModelScope.launch {
            _isSaving.value = true
            val tenantId = authRepository.tenantId.first() ?: return@launch
            val existing = _customer.value
            val customer = existing?.copy(
                name = name, email = email, phone = phone,
                address = address, city = city, state = state,
                category = category, lastModified = System.currentTimeMillis(), isSynced = false
            ) ?: CustomerEntity(
                id = UUID.randomUUID().toString(),
                tenantId = tenantId,
                name = name, email = email, phone = phone,
                address = address, city = city, state = state,
                category = category
            )

            customerDao.insert(customer)

            // Queue sync event
            syncManager.queueEvent(
                entityType = "customer",
                entityId = customer.id,
                action = if (existing != null) "UPDATE" else "CREATE",
                payload = mapOf(
                    "id" to customer.id, "name" to name, "email" to email,
                    "phone" to phone, "address" to address, "city" to city,
                    "state" to state, "category" to category,
                    "tenantId" to tenantId
                )
            )

            _isSaving.value = false
            _saved.value = true
        }
    }
}
