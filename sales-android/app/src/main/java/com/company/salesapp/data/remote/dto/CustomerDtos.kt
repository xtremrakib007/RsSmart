package com.company.salesapp.data.remote.dto

data class CustomerDto(
    val id: String,
    val name: String,
    val email: String? = null,
    val phone: String? = null,
    val address: String? = null,
    val city: String? = null,
    val state: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val creditLimit: Double? = null,
    val balance: Double = 0.0,
    val category: String? = null,
    val isActive: Boolean = true
)

data class CreateCustomerRequest(
    val name: String,
    val email: String? = null,
    val phone: String? = null,
    val address: String? = null,
    val city: String? = null,
    val state: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val category: String? = null
)

data class CustomerVisitDto(
    val id: String? = null,
    val customerId: String,
    val userId: String,
    val checkInAt: String,
    val checkOutAt: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val notes: String? = null,
    val photos: List<String> = emptyList()
)
