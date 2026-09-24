package com.company.salesapp.data.repository

import com.company.salesapp.data.local.dao.CustomerDao
import com.company.salesapp.data.local.entity.CustomerEntity
import com.company.salesapp.data.remote.api.CustomerApi
import com.company.salesapp.data.remote.dto.CreateCustomerRequest
import com.company.salesapp.data.remote.dto.CustomerDto
import kotlinx.coroutines.flow.Flow
import java.util.*
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class CustomerRepository @Inject constructor(
    private val customerDao: CustomerDao,
    private val customerApi: CustomerApi,
    private val authRepository: AuthRepository
) {
    fun getCustomers(tenantId: String): Flow<List<CustomerEntity>> = customerDao.getAll(tenantId)
    fun searchCustomers(tenantId: String, query: String): Flow<List<CustomerEntity>> = customerDao.search(tenantId, query)

    suspend fun createCustomerLocal(customer: CustomerEntity) {
        customerDao.insert(customer)
    }

    suspend fun createCustomer(name: String, email: String?, phone: String?, address: String?, city: String?, state: String?, category: String?): Result<CustomerDto> {
        return try {
            val request = CreateCustomerRequest(name, email, phone, address, city, state, category = category)
            val response = customerApi.createCustomer(request)
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(response.body()!!.data)
            } else {
                Result.failure(Exception("Failed to create customer"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun syncCustomersFromServer(tenantId: String) {
        try {
            val response = customerApi.getCustomers()
            if (response.isSuccessful && response.body()?.success == true) {
                val customers = response.body()!!.data.map { dto ->
                    CustomerEntity(
                        id = dto.id,
                        serverId = dto.id,
                        tenantId = tenantId,
                        name = dto.name,
                        email = dto.email,
                        phone = dto.phone,
                        address = dto.address,
                        city = dto.city,
                        state = dto.state,
                        creditLimit = dto.creditLimit,
                        balance = dto.balance,
                        category = dto.category,
                        isActive = dto.isActive,
                        isSynced = true
                    )
                }
                customerDao.deleteAll(tenantId)
                customerDao.insertAll(customers)
            }
        } catch (e: Exception) {
            // Offline - keep local data
        }
    }
}
