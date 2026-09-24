package com.company.salesapp.data.remote.dto

data class ApiResponse<T>(
    val success: Boolean,
    val statusCode: Int,
    val data: T,
    val timestamp: String
)
