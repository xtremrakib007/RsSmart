package com.retail.shared.data.local.database

import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

val MIGRATION_1_2 = object : Migration(1, 2) {
    override fun migrate(database: SupportSQLiteDatabase) {
        database.execSQL(
            """
            CREATE TABLE IF NOT EXISTS customers (
                id TEXT NOT NULL PRIMARY KEY,
                tenantId TEXT NOT NULL,
                name TEXT NOT NULL,
                phone TEXT NOT NULL,
                email TEXT,
                loyaltyNumber TEXT,
                createdAt INTEGER NOT NULL,
                syncStatus TEXT NOT NULL
            )
            """.trimIndent()
        )
        database.execSQL("CREATE INDEX IF NOT EXISTS index_customers_tenantId ON customers(tenantId)")
        database.execSQL("CREATE INDEX IF NOT EXISTS index_customers_tenantId_phone ON customers(tenantId, phone)")
    }
}
