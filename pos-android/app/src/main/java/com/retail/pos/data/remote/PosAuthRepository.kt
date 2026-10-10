package com.retail.pos.data.remote

import com.retail.pos.session.PosSessionProvider
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PosAuthRepository @Inject constructor(
    private val api: PosAuthApi,
    private val store: PosAuthStore,
    private val sessionProvider: PosSessionProvider
) {
    val isLoggedIn = store.isLoggedIn

    suspend fun login(email: String, password: String, tenantId: String): Result<Unit> {
        return try {
            val response = api.login(PosLoginRequest(email.trim(), password, tenantId.trim()))
            val envelope = response.body()
            if (response.isSuccessful && envelope?.success == true && envelope.data != null) {
                val data = envelope.data
                store.save(data)
                sessionProvider.setIdentity(data.user.tenantId, data.user.id)
                Result.success(Unit)
            } else {
                Result.failure(IllegalStateException("Sign-in failed. Check your email, password, tenant ID, and server connection."))
            }
        } catch (_: Exception) {
            Result.failure(IllegalStateException("Could not reach the RsSmart server. Check the server URL and internet connection."))
        }
    }

    suspend fun logout() {
        store.clear()
        sessionProvider.clearIdentity()
        sessionProvider.clearActiveSession()
    }
}
