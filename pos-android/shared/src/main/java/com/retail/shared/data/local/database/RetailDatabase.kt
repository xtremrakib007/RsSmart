package com.retail.shared.data.local.database

import androidx.room.Database
import androidx.room.RoomDatabase
import com.retail.shared.data.local.dao.*
import com.retail.shared.data.local.entity.*

@Database(
    entities = [
        Product::class,
        CartItem::class,
        PosSession::class,
        Payment::class,
        PosOrder::class,
        OfflineQueueItem::class,
        CustomerEntity::class
    ],
    version = 2,
    exportSchema = true
)
abstract class RetailDatabase : RoomDatabase() {
    abstract fun productDao(): ProductDao
    abstract fun cartDao(): CartDao
    abstract fun sessionDao(): SessionDao
    abstract fun orderDao(): OrderDao
    abstract fun offlineQueueDao(): OfflineQueueDao
    abstract fun paymentDao(): PaymentDao
    abstract fun customerDao(): CustomerDao
}
