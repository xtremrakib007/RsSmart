package com.company.salesapp.sync

import android.content.Context
import androidx.work.*
import com.company.salesapp.data.local.dao.*
import com.company.salesapp.data.local.entity.CustomerEntity
import com.company.salesapp.data.local.entity.ProductEntity
import com.company.salesapp.data.local.entity.SyncEventEntity
import com.company.salesapp.data.remote.api.SyncApi
import com.company.salesapp.data.remote.dto.*
import com.company.salesapp.data.repository.AuthRepository
import com.company.salesapp.util.DeviceIdProvider
import com.company.salesapp.util.NetworkConnectivityObserver
import com.google.gson.Gson
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.first
import java.text.SimpleDateFormat
import java.util.*
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SyncManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val syncApi: SyncApi,
    private val syncEventDao: SyncEventDao,
    private val customerDao: CustomerDao,
    private val orderDao: OrderDao,
    private val productDao: ProductDao,
    private val visitDao: CustomerVisitDao,
    private val authRepository: AuthRepository,
    private val deviceIdProvider: DeviceIdProvider
) {
    private val gson = Gson()
    private val clientId = deviceIdProvider.deviceId
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    suspend fun sync(): SyncResult {
        if (!NetworkConnectivityObserver(context).isOnline.first()) {
            return SyncResult(false, "No internet connection", 0, 0)
        }

        return try {
            val pushed = pushPendingEvents()
            val pulled = pullServerEvents()
            SyncResult(true, "Sync completed", pushed, pulled)
        } catch (e: Exception) {
            SyncResult(false, e.message ?: "Sync failed", 0, 0)
        }
    }

    private suspend fun pushPendingEvents(): Int {
        val pending = syncEventDao.getPending()
        if (pending.isEmpty()) return 0

        val events = pending.map { entity ->
            SyncEventDto(
                eventId = entity.eventId,
                entityType = entity.entityType,
                entityId = entity.entityId,
                action = entity.action,
                payload = gson.fromJson(entity.payload, Map::class.java) as Map<String, Any>,
                vectorClock = gson.fromJson(entity.vectorClock, Map::class.java) as? Map<String, Int>
            )
        }

        val response = syncApi.pushEvents(PushEventsDto(clientId, events))
        if (response.isSuccessful && response.body()?.success == true) {
            pending.forEach { event ->
                syncEventDao.updateStatus(event.eventId, "SYNCING")
            }
            return pending.size
        }
        return 0
    }

    private suspend fun pullServerEvents(): Int {
        val lastSync = getLastSyncTime()
        val response = syncApi.pullEvents(PullEventsDto(
            clientId = clientId,
            lastSyncAt = formatDate(lastSync),
            deltaOnly = true
        ))

        if (response.isSuccessful && response.body()?.success == true) {
            val events = response.body()!!.data
            events.forEach { event ->
                applyServerEvent(event)
            }
            saveLastSyncTime(System.currentTimeMillis())
            return events.size
        }
        return 0
    }

    private suspend fun applyServerEvent(event: SyncEventDto) {
        when (event.entityType) {
            "customer" -> applyCustomerEvent(event)
            "product" -> applyProductEvent(event)
            "order" -> applyOrderEvent(event)
        }
    }

    private suspend fun applyCustomerEvent(event: SyncEventDto) {
        val payload = gson.toJson(event.payload)
        val customer = gson.fromJson(payload, CustomerDto::class.java)
        val entity = CustomerEntity(
            id = customer.id,
            serverId = customer.id,
            tenantId = getTenantId() ?: "",
            name = customer.name,
            email = customer.email,
            phone = customer.phone,
            address = customer.address,
            city = customer.city,
            state = customer.state,
            creditLimit = customer.creditLimit,
            balance = customer.balance,
            category = customer.category,
            isActive = customer.isActive,
            isSynced = true
        )
        customerDao.insert(entity)
    }

    private suspend fun applyProductEvent(event: SyncEventDto) {
        val payload = gson.toJson(event.payload)
        val product = gson.fromJson(payload, ProductDto::class.java)
        val entity = ProductEntity(
            id = product.id,
            sku = product.sku,
            name = product.name,
            barcode = product.barcode,
            basePrice = product.basePrice,
            costPrice = product.costPrice,
            taxRate = product.taxRate,
            isActive = product.isActive,
            trackInventory = product.trackInventory,
            categoryId = product.categoryId,
            unitId = product.unitId,
            lastSyncedAt = System.currentTimeMillis()
        )
        productDao.insertAll(listOf(entity))
    }

    private suspend fun applyOrderEvent(event: SyncEventDto) {
        // Orders from server are read-only on client
    }

    fun queueEvent(entityType: String, entityId: String, action: String, payload: Any) {
        scope.launch {
            val event = SyncEventEntity(
                eventId = UUID.randomUUID().toString(),
                clientId = clientId,
                timestamp = System.currentTimeMillis(),
                entityType = entityType,
                entityId = entityId,
                action = action,
                payload = gson.toJson(payload),
                vectorClock = gson.toJson(mapOf(clientId to 1))
            )
            syncEventDao.insert(event)
        }
    }

    fun schedulePeriodicSync() {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .setRequiresBatteryNotLow(true)
            .build()

        val syncWork = PeriodicWorkRequestBuilder<SyncWorker>(15, java.util.concurrent.TimeUnit.MINUTES)
            .setConstraints(constraints)
            .addTag("sync")
            .build()

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            "periodic_sync",
            ExistingPeriodicWorkPolicy.KEEP,
            syncWork
        )
    }

    fun scheduleImmediateSync() {
        val syncWork = OneTimeWorkRequestBuilder<SyncWorker>()
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .addTag("sync_immediate")
            .build()

        WorkManager.getInstance(context).enqueue(syncWork)
    }

    private fun getLastSyncTime(): Long {
        return context.getSharedPreferences("sync_prefs", Context.MODE_PRIVATE)
            .getLong("last_sync", 0)
    }

    private fun saveLastSyncTime(time: Long) {
        context.getSharedPreferences("sync_prefs", Context.MODE_PRIVATE)
            .edit().putLong("last_sync", time).apply()
    }

    private suspend fun getTenantId(): String? {
        return authRepository.tenantId.first()
    }

    private fun formatDate(timestamp: Long): String {
        return SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
            .apply { timeZone = TimeZone.getTimeZone("UTC") }
            .format(Date(timestamp))
    }
}

data class SyncResult(val success: Boolean, val message: String, val pushed: Int, val pulled: Int)
