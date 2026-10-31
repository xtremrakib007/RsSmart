package com.company.salesapp.data.repository

import com.company.salesapp.data.remote.api.AuthApi
import com.company.salesapp.data.remote.dto.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    private val authApi: AuthApi,
    private val tokenProvider: TokenProvider,
) {
    val isLoggedIn: Flow<Boolean> = tokenProvider.isLoggedIn
    val token: Flow<String?> = tokenProvider.token
    val tenantId: Flow<String?> = tokenProvider.tenantId
    val userId: Flow<String?> = tokenProvider.userId
    val userRoles: Flow<Set<String>> = tokenProvider.userRoles
    /** Admins and managers manage the field team. */
    val isManager: Flow<Boolean> = tokenProvider.userRoles.map { roles -> roles.any { it == "admin" || it == "manager" } }

    suspend fun login(email: String, password: String, tenantId: String): Result<LoginResponse> {
        return try {
            val response = authApi.login(LoginRequest(email, password, tenantId))
            if (response.isSuccessful && response.body()?.success == true) {
                val data = response.body()!!.data
                saveAuthData(data)
                Result.success(data)
            } else {
                Result.failure(Exception(response.body()?.data?.toString() ?: "Login failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun logout() {
        tokenProvider.clear()
    }

    private suspend fun saveAuthData(data: LoginResponse) {
        tokenProvider.save(
            accessToken = data.accessToken,
            refreshToken = data.refreshToken,
            userId = data.user.id,
            tenantId = data.user.tenantId,
            userName = "${data.user.firstName} ${data.user.lastName}",
            userEmail = data.user.email,
            userRoles = data.user.roles.toSet(),
        )
    }
}
