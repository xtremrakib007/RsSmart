package com.retail.shared.data.local.database

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
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
        Customer::class
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

    companion object {
        val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS customers (
                        id TEXT NOT NULL PRIMARY KEY,
                        tenantId TEXT NOT NULL,
                        name TEXT NOT NULL,
                        phone TEXT NOT NULL,
                        email TEXT,
                        loyaltyNumber TEXT,
                        notes TEXT,
                        createdAt INTEGER NOT NULL,
                        updatedAt INTEGER NOT NULL,
                        isActive INTEGER NOT NULL,
                        syncStatus TEXT NOT NULL
                    )
                """.trimIndent())
                db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS index_customers_tenantId_phone ON customers(tenantId, phone)")
                db.execSQL("CREATE INDEX IF NOT EXISTS index_customers_tenantId_name ON customers(tenantId, name)")
            }
        }
    }
}
