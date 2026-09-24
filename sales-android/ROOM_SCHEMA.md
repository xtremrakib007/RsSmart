# Room Database Schema for Sales App (Android)

## Entities

### SyncEventEntity
```kotlin
@Entity(tableName = "sync_events")
data class SyncEventEntity(
    @PrimaryKey val eventId: String,
    val clientId: String,
    val timestamp: Long,
    val entityType: String,
    val entityId: String,
    val action: String, // CREATE, UPDATE, DELETE
    val payload: String, // JSON
    val vectorClock: String, // JSON
    val status: String, // PENDING, SYNCING, COMPLETED, FAILED
    val retryCount: Int = 0,
    val lastError: String? = null,
    val createdAt: Long = System.currentTimeMillis(),
)
```

### CustomerEntity
```kotlin
@Entity(tableName = "customers")
data class CustomerEntity(
    @PrimaryKey val id: String,
    val serverId: String?, // null if local-only
    val tenantId: String,
    val name: String,
    val email: String?,
    val phone: String?,
    val address: String?,
    val city: String?,
    val state: String?,
    val latitude: Double?,
    val longitude: Double?,
    val creditLimit: Double?,
    val balance: Double = 0.0,
    val category: String?,
    val isActive: Boolean = true,
    val isSynced: Boolean = false,
    val lastModified: Long = System.currentTimeMillis(),
    val version: Int = 1,
)
```

### OrderEntity
```kotlin
@Entity(tableName = "orders")
data class OrderEntity(
    @PrimaryKey val id: String,
    val serverId: String?,
    val tenantId: String,
    val customerId: String,
    val salesRepId: String,
    val status: String, // DRAFT, PENDING, SYNCED
    val subtotal: Double,
    val taxAmount: Double,
    val discount: Double = 0.0,
    val total: Double,
    val notes: String?,
    val deliveryDate: Long?,
    val isSynced: Boolean = false,
    val createdAt: Long = System.currentTimeMillis(),
    val version: Int = 1,
)
```

### OrderItemEntity
```kotlin
@Entity(
    tableName = "order_items",
    foreignKeys = [
        ForeignKey(
            entity = OrderEntity::class,
            parentColumns = ["id"],
            childColumns = ["orderId"],
            onDelete = ForeignKey.CASCADE
        )
    ]
)
data class OrderItemEntity(
    @PrimaryKey val id: String,
    val orderId: String,
    val productId: String,
    val productName: String,
    val quantity: Double,
    val unitPrice: Double,
    val discount: Double = 0.0,
    val taxRate: Double = 0.0,
    val taxAmount: Double,
    val total: Double,
)
```

### ProductEntity (cached)
```kotlin
@Entity(tableName = "products")
data class ProductEntity(
    @PrimaryKey val id: String,
    val sku: String,
    val name: String,
    val barcode: String?,
    val basePrice: Double,
    val costPrice: Double?,
    val taxRate: Double,
    val isActive: Boolean = true,
    val trackInventory: Boolean = true,
    val categoryId: String?,
    val unitId: String?,
    val lastSyncedAt: Long = 0,
)
```

### CustomerVisitEntity
```kotlin
@Entity(tableName = "customer_visits")
data class CustomerVisitEntity(
    @PrimaryKey val id: String,
    val serverId: String?,
    val tenantId: String,
    val customerId: String,
    val userId: String,
    val checkInAt: Long,
    val checkOutAt: Long?,
    val latitude: Double?,
    val longitude: Double?,
    val notes: String?,
    val photos: String, // JSON array of local paths
    val isSynced: Boolean = false,
)
```

## Database
```kotlin
@Database(
    entities = [
        SyncEventEntity::class,
        CustomerEntity::class,
        OrderEntity::class,
        OrderItemEntity::class,
        ProductEntity::class,
        CustomerVisitEntity::class,
    ],
    version = 1,
    exportSchema = true
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun syncEventDao(): SyncEventDao
    abstract fun customerDao(): CustomerDao
    abstract fun orderDao(): OrderDao
    abstract fun productDao(): ProductDao
    abstract fun visitDao(): CustomerVisitDao
}
```

## Migration Strategy
```kotlin
// In your DatabaseProvider
fun provideDatabase(context: Context): AppDatabase {
    return Room.databaseBuilder(
        context,
        AppDatabase::class.java,
        "sales_app.db"
    )
    .addMigrations(*ALL_MIGRATIONS)
    .fallbackToDestructiveMigration() // Dev only!
    .build()
}

// Example migration from v1 to v2
val MIGRATION_1_2 = object : Migration(1, 2) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("ALTER TABLE customers ADD COLUMN lastVisitAt INTEGER DEFAULT 0")
    }
}
```

## Sync Manager (Kotlin)
```kotlin
class SyncManager(
    private val api: SyncApi,
    private val db: AppDatabase,
    private val clientId: String,
) {
    private val syncScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    suspend fun sync() {
        val pendingEvents = db.syncEventDao().getPending()
        if (pendingEvents.isNotEmpty()) {
            pushEvents(pendingEvents)
        }

        val lastSync = getLastSyncTime()
        pullEvents(lastSync)

        saveLastSyncTime(System.currentTimeMillis())
    }

    private suspend fun pushEvents(events: List<SyncEventEntity>) {
        val dto = events.map { it.toDto() }
        val response = api.pushEvents(PushEventsDto(clientId, dto))

        // Mark as syncing
        events.forEach { 
            db.syncEventDao().updateStatus(it.eventId, "SYNCING")
        }

        // Wait for WebSocket confirmation or poll status
    }

    private suspend fun pullEvents(lastSyncAt: Long) {
        val response = api.pullEvents(PullEventsDto(
            clientId = clientId,
            lastSyncAt = formatDate(lastSyncAt),
            deltaOnly = true
        ))

        response.data.forEach { event ->
            applyServerEvent(event)
        }
    }

    private fun applyServerEvent(event: SyncEventDto) {
        when (event.entity) {
            "customer" -> applyCustomerEvent(event)
            "product" -> applyProductEvent(event)
            "order" -> applyOrderEvent(event)
        }
    }

    fun schedulePeriodicSync() {
        val workRequest = PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES)
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()
            )
            .build()

        WorkManager.getInstance(context)
            .enqueueUniquePeriodicWork(
                "sync",
                ExistingPeriodicWorkPolicy.KEEP,
                workRequest
            )
    }
}
```
