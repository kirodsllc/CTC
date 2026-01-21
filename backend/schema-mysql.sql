-- =====================================================
-- MySQL Database Schema for Inventory ERP System
-- Generated: 2026-01-13
-- =====================================================

-- Set character set and collation
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- Drop existing database if needed (uncomment if you want to recreate)
-- DROP DATABASE IF EXISTS inventory_erp;

-- Create database
CREATE DATABASE IF NOT EXISTS inventory_erp 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE inventory_erp;

-- =====================================================
-- Master Data Tables
-- =====================================================

CREATE TABLE `MasterPart` (
  `id` VARCHAR(36) PRIMARY KEY,
  `masterPartNo` VARCHAR(255) UNIQUE NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `idx_masterPart_masterPartNo` (`masterPartNo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `Brand` (
  `id` VARCHAR(36) PRIMARY KEY,
  `name` VARCHAR(255) UNIQUE NOT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'active',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `idx_brand_name` (`name`),
  INDEX `idx_brand_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `Category` (
  `id` VARCHAR(36) PRIMARY KEY,
  `name` VARCHAR(255) UNIQUE NOT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'active',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `idx_category_name` (`name`),
  INDEX `idx_category_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `Subcategory` (
  `id` VARCHAR(36) PRIMARY KEY,
  `categoryId` VARCHAR(36) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'active',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY `unique_category_subcategory` (`categoryId`, `name`),
  INDEX `idx_subcategory_categoryId` (`categoryId`),
  INDEX `idx_subcategory_status` (`status`),
  CONSTRAINT `fk_subcategory_category` FOREIGN KEY (`categoryId`) REFERENCES `Category` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `Application` (
  `id` VARCHAR(36) PRIMARY KEY,
  `subcategoryId` VARCHAR(36) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'active',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY `unique_subcategory_application` (`subcategoryId`, `name`),
  INDEX `idx_application_subcategoryId` (`subcategoryId`),
  INDEX `idx_application_status` (`status`),
  CONSTRAINT `fk_application_subcategory` FOREIGN KEY (`subcategoryId`) REFERENCES `Subcategory` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Parts and Models
-- =====================================================

CREATE TABLE `Part` (
  `id` VARCHAR(36) PRIMARY KEY,
  `masterPartId` VARCHAR(36),
  `partNo` VARCHAR(255) NOT NULL,
  `brandId` VARCHAR(36),
  `description` TEXT,
  `categoryId` VARCHAR(36),
  `subcategoryId` VARCHAR(36),
  `applicationId` VARCHAR(36),
  `hsCode` VARCHAR(255),
  `weight` DOUBLE,
  `reorderLevel` INT NOT NULL DEFAULT 0,
  `uom` VARCHAR(50) NOT NULL DEFAULT 'pcs',
  `cost` DOUBLE,
  `priceA` DOUBLE,
  `priceB` DOUBLE,
  `priceM` DOUBLE,
  `smc` VARCHAR(255),
  `size` VARCHAR(255),
  `origin` VARCHAR(255),
  `imageP1` TEXT,
  `imageP2` TEXT,
  `status` VARCHAR(50) NOT NULL DEFAULT 'active',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `idx_part_partNo` (`partNo`),
  INDEX `idx_part_masterPartId` (`masterPartId`),
  INDEX `idx_part_brandId` (`brandId`),
  INDEX `idx_part_categoryId` (`categoryId`),
  INDEX `idx_part_subcategoryId` (`subcategoryId`),
  INDEX `idx_part_applicationId` (`applicationId`),
  INDEX `idx_part_status` (`status`),
  CONSTRAINT `fk_part_masterPart` FOREIGN KEY (`masterPartId`) REFERENCES `MasterPart` (`id`),
  CONSTRAINT `fk_part_brand` FOREIGN KEY (`brandId`) REFERENCES `Brand` (`id`),
  CONSTRAINT `fk_part_category` FOREIGN KEY (`categoryId`) REFERENCES `Category` (`id`),
  CONSTRAINT `fk_part_subcategory` FOREIGN KEY (`subcategoryId`) REFERENCES `Subcategory` (`id`),
  CONSTRAINT `fk_part_application` FOREIGN KEY (`applicationId`) REFERENCES `Application` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `Model` (
  `id` VARCHAR(36) PRIMARY KEY,
  `partId` VARCHAR(36) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `qtyUsed` INT NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY `unique_part_model` (`partId`, `name`),
  INDEX `idx_model_partId` (`partId`),
  CONSTRAINT `fk_model_part` FOREIGN KEY (`partId`) REFERENCES `Part` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Store Management
-- =====================================================

CREATE TABLE `Store` (
  `id` VARCHAR(36) PRIMARY KEY,
  `code` VARCHAR(50) UNIQUE NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `address` TEXT,
  `phone` VARCHAR(50),
  `manager` VARCHAR(255),
  `status` VARCHAR(50) NOT NULL DEFAULT 'active',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `idx_store_code` (`code`),
  INDEX `idx_store_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `Rack` (
  `id` VARCHAR(36) PRIMARY KEY,
  `codeNo` VARCHAR(50) UNIQUE NOT NULL,
  `storeId` VARCHAR(36),
  `description` TEXT,
  `status` VARCHAR(50) NOT NULL DEFAULT 'Active',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `idx_rack_codeNo` (`codeNo`),
  INDEX `idx_rack_storeId` (`storeId`),
  INDEX `idx_rack_status` (`status`),
  CONSTRAINT `fk_rack_store` FOREIGN KEY (`storeId`) REFERENCES `Store` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `Shelf` (
  `id` VARCHAR(36) PRIMARY KEY,
  `shelfNo` VARCHAR(50) NOT NULL,
  `rackId` VARCHAR(36) NOT NULL,
  `description` TEXT,
  `status` VARCHAR(50) NOT NULL DEFAULT 'Active',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY `unique_rack_shelf` (`rackId`, `shelfNo`),
  INDEX `idx_shelf_rackId` (`rackId`),
  INDEX `idx_shelf_status` (`status`),
  CONSTRAINT `fk_shelf_rack` FOREIGN KEY (`rackId`) REFERENCES `Rack` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Stock Management
-- =====================================================

CREATE TABLE `StockMovement` (
  `id` VARCHAR(36) PRIMARY KEY,
  `partId` VARCHAR(36) NOT NULL,
  `type` VARCHAR(50) NOT NULL,
  `quantity` INT NOT NULL,
  `storeId` VARCHAR(36),
  `rackId` VARCHAR(36),
  `shelfId` VARCHAR(36),
  `referenceType` VARCHAR(100),
  `referenceId` VARCHAR(36),
  `notes` TEXT,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `idx_stockmovement_partId` (`partId`),
  INDEX `idx_stockmovement_type` (`type`),
  INDEX `idx_stockmovement_storeId` (`storeId`),
  INDEX `idx_stockmovement_rackId` (`rackId`),
  INDEX `idx_stockmovement_shelfId` (`shelfId`),
  INDEX `idx_stockmovement_reference` (`referenceType`, `referenceId`),
  INDEX `idx_stockmovement_createdAt` (`createdAt`),
  CONSTRAINT `fk_stockmovement_part` FOREIGN KEY (`partId`) REFERENCES `Part` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_stockmovement_store` FOREIGN KEY (`storeId`) REFERENCES `Store` (`id`),
  CONSTRAINT `fk_stockmovement_rack` FOREIGN KEY (`rackId`) REFERENCES `Rack` (`id`),
  CONSTRAINT `fk_stockmovement_shelf` FOREIGN KEY (`shelfId`) REFERENCES `Shelf` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `Transfer` (
  `id` VARCHAR(36) PRIMARY KEY,
  `transferNumber` VARCHAR(100) UNIQUE NOT NULL,
  `date` DATETIME(3) NOT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'Draft',
  `notes` TEXT,
  `totalQty` INT NOT NULL DEFAULT 0,
  `fromStoreId` VARCHAR(36),
  `toStoreId` VARCHAR(36),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `idx_transfer_transferNumber` (`transferNumber`),
  INDEX `idx_transfer_status` (`status`),
  INDEX `idx_transfer_date` (`date`),
  INDEX `idx_transfer_fromStoreId` (`fromStoreId`),
  INDEX `idx_transfer_toStoreId` (`toStoreId`),
  CONSTRAINT `fk_transfer_fromStore` FOREIGN KEY (`fromStoreId`) REFERENCES `Store` (`id`),
  CONSTRAINT `fk_transfer_toStore` FOREIGN KEY (`toStoreId`) REFERENCES `Store` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `TransferItem` (
  `id` VARCHAR(36) PRIMARY KEY,
  `transferId` VARCHAR(36) NOT NULL,
  `partId` VARCHAR(36) NOT NULL,
  `fromStoreId` VARCHAR(36),
  `fromRackId` VARCHAR(36),
  `fromShelfId` VARCHAR(36),
  `toStoreId` VARCHAR(36),
  `toRackId` VARCHAR(36),
  `toShelfId` VARCHAR(36),
  `quantity` INT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `idx_transferitem_transferId` (`transferId`),
  INDEX `idx_transferitem_partId` (`partId`),
  CONSTRAINT `fk_transferitem_transfer` FOREIGN KEY (`transferId`) REFERENCES `Transfer` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_transferitem_part` FOREIGN KEY (`partId`) REFERENCES `Part` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_transferitem_fromStore` FOREIGN KEY (`fromStoreId`) REFERENCES `Store` (`id`),
  CONSTRAINT `fk_transferitem_fromRack` FOREIGN KEY (`fromRackId`) REFERENCES `Rack` (`id`),
  CONSTRAINT `fk_transferitem_fromShelf` FOREIGN KEY (`fromShelfId`) REFERENCES `Shelf` (`id`),
  CONSTRAINT `fk_transferitem_toStore` FOREIGN KEY (`toStoreId`) REFERENCES `Store` (`id`),
  CONSTRAINT `fk_transferitem_toRack` FOREIGN KEY (`toRackId`) REFERENCES `Rack` (`id`),
  CONSTRAINT `fk_transferitem_toShelf` FOREIGN KEY (`toShelfId`) REFERENCES `Shelf` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `Adjustment` (
  `id` VARCHAR(36) PRIMARY KEY,
  `date` DATETIME(3) NOT NULL,
  `subject` VARCHAR(255),
  `storeId` VARCHAR(36),
  `addInventory` BOOLEAN NOT NULL DEFAULT TRUE,
  `notes` TEXT,
  `totalAmount` DOUBLE NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `idx_adjustment_date` (`date`),
  INDEX `idx_adjustment_storeId` (`storeId`),
  CONSTRAINT `fk_adjustment_store` FOREIGN KEY (`storeId`) REFERENCES `Store` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `AdjustmentItem` (
  `id` VARCHAR(36) PRIMARY KEY,
  `adjustmentId` VARCHAR(36) NOT NULL,
  `partId` VARCHAR(36) NOT NULL,
  `quantity` INT NOT NULL,
  `cost` DOUBLE,
  `notes` TEXT,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `idx_adjustmentitem_adjustmentId` (`adjustmentId`),
  INDEX `idx_adjustmentitem_partId` (`partId`),
  CONSTRAINT `fk_adjustmentitem_adjustment` FOREIGN KEY (`adjustmentId`) REFERENCES `Adjustment` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_adjustmentitem_part` FOREIGN KEY (`partId`) REFERENCES `Part` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Purchase Management
-- =====================================================

CREATE TABLE `PurchaseOrder` (
  `id` VARCHAR(36) PRIMARY KEY,
  `poNumber` VARCHAR(100) UNIQUE NOT NULL,
  `date` DATETIME(3) NOT NULL,
  `supplierId` VARCHAR(36),
  `status` VARCHAR(50) NOT NULL DEFAULT 'Draft',
  `expectedDate` DATETIME(3),
  `notes` TEXT,
  `totalAmount` DOUBLE NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `idx_purchaseorder_poNumber` (`poNumber`),
  INDEX `idx_purchaseorder_status` (`status`),
  INDEX `idx_purchaseorder_date` (`date`),
  INDEX `idx_purchaseorder_supplierId` (`supplierId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `PurchaseOrderItem` (
  `id` VARCHAR(36) PRIMARY KEY,
  `purchaseOrderId` VARCHAR(36) NOT NULL,
  `partId` VARCHAR(36) NOT NULL,
  `quantity` INT NOT NULL,
  `unitCost` DOUBLE NOT NULL,
  `totalCost` DOUBLE NOT NULL,
  `receivedQty` INT NOT NULL DEFAULT 0,
  `notes` TEXT,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `idx_purchaseorderitem_purchaseOrderId` (`purchaseOrderId`),
  INDEX `idx_purchaseorderitem_partId` (`partId`),
  CONSTRAINT `fk_purchaseorderitem_purchaseorder` FOREIGN KEY (`purchaseOrderId`) REFERENCES `PurchaseOrder` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_purchaseorderitem_part` FOREIGN KEY (`partId`) REFERENCES `Part` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `DirectPurchaseOrder` (
  `id` VARCHAR(36) PRIMARY KEY,
  `dpoNumber` VARCHAR(100) UNIQUE NOT NULL,
  `date` DATETIME(3) NOT NULL,
  `storeId` VARCHAR(36),
  `supplierId` VARCHAR(36),
  `account` VARCHAR(255),
  `description` TEXT,
  `status` VARCHAR(50) NOT NULL DEFAULT 'Completed',
  `totalAmount` DOUBLE NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `idx_directpurchaseorder_dpoNumber` (`dpoNumber`),
  INDEX `idx_directpurchaseorder_status` (`status`),
  INDEX `idx_directpurchaseorder_date` (`date`),
  INDEX `idx_directpurchaseorder_storeId` (`storeId`),
  INDEX `idx_directpurchaseorder_supplierId` (`supplierId`),
  CONSTRAINT `fk_directpurchaseorder_store` FOREIGN KEY (`storeId`) REFERENCES `Store` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `DirectPurchaseOrderItem` (
  `id` VARCHAR(36) PRIMARY KEY,
  `directPurchaseOrderId` VARCHAR(36) NOT NULL,
  `partId` VARCHAR(36) NOT NULL,
  `quantity` INT NOT NULL,
  `purchasePrice` DOUBLE NOT NULL,
  `salePrice` DOUBLE NOT NULL,
  `amount` DOUBLE NOT NULL,
  `priceA` DOUBLE,
  `priceB` DOUBLE,
  `priceM` DOUBLE,
  `rackId` VARCHAR(36),
  `shelfId` VARCHAR(36),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `idx_directpurchaseorderitem_directPurchaseOrderId` (`directPurchaseOrderId`),
  INDEX `idx_directpurchaseorderitem_partId` (`partId`),
  INDEX `idx_directpurchaseorderitem_rackId` (`rackId`),
  INDEX `idx_directpurchaseorderitem_shelfId` (`shelfId`),
  CONSTRAINT `fk_directpurchaseorderitem_dpo` FOREIGN KEY (`directPurchaseOrderId`) REFERENCES `DirectPurchaseOrder` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_directpurchaseorderitem_part` FOREIGN KEY (`partId`) REFERENCES `Part` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_directpurchaseorderitem_rack` FOREIGN KEY (`rackId`) REFERENCES `Rack` (`id`),
  CONSTRAINT `fk_directpurchaseorderitem_shelf` FOREIGN KEY (`shelfId`) REFERENCES `Shelf` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `DirectPurchaseOrderExpense` (
  `id` VARCHAR(36) PRIMARY KEY,
  `directPurchaseOrderId` VARCHAR(36) NOT NULL,
  `expenseType` VARCHAR(255) NOT NULL,
  `payableAccount` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `amount` DOUBLE NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `idx_dpoexpense_directPurchaseOrderId` (`directPurchaseOrderId`),
  CONSTRAINT `fk_dpoexpense_dpo` FOREIGN KEY (`directPurchaseOrderId`) REFERENCES `DirectPurchaseOrder` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `PriceHistory` (
  `id` VARCHAR(36) PRIMARY KEY,
  `partId` VARCHAR(36),
  `partNo` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `priceField` VARCHAR(50) NOT NULL,
  `updateType` VARCHAR(50) NOT NULL,
  `oldValue` DOUBLE,
  `newValue` DOUBLE,
  `updateValue` DOUBLE,
  `itemsUpdated` INT NOT NULL DEFAULT 1,
  `reason` TEXT NOT NULL,
  `updatedBy` VARCHAR(255),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `idx_pricehistory_partId` (`partId`),
  INDEX `idx_pricehistory_partNo` (`partNo`),
  INDEX `idx_pricehistory_priceField` (`priceField`),
  INDEX `idx_pricehistory_createdAt` (`createdAt`),
  CONSTRAINT `fk_pricehistory_part` FOREIGN KEY (`partId`) REFERENCES `Part` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Stock Verification
-- =====================================================

CREATE TABLE `StockVerification` (
  `id` VARCHAR(36) PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `notes` TEXT,
  `status` VARCHAR(50) NOT NULL DEFAULT 'Active',
  `startDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `completedDate` DATETIME(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `idx_stockverification_status` (`status`),
  INDEX `idx_stockverification_startDate` (`startDate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `StockVerificationItem` (
  `id` VARCHAR(36) PRIMARY KEY,
  `verificationId` VARCHAR(36) NOT NULL,
  `partId` VARCHAR(36) NOT NULL,
  `storeId` VARCHAR(36),
  `rackId` VARCHAR(36),
  `shelfId` VARCHAR(36),
  `systemQty` INT NOT NULL,
  `physicalQty` INT,
  `variance` INT,
  `status` VARCHAR(50) NOT NULL DEFAULT 'Pending',
  `remarks` TEXT,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `idx_stockverificationitem_verificationId` (`verificationId`),
  INDEX `idx_stockverificationitem_partId` (`partId`),
  INDEX `idx_stockverificationitem_status` (`status`),
  CONSTRAINT `fk_stockverificationitem_verification` FOREIGN KEY (`verificationId`) REFERENCES `StockVerification` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_stockverificationitem_part` FOREIGN KEY (`partId`) REFERENCES `Part` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_stockverificationitem_store` FOREIGN KEY (`storeId`) REFERENCES `Store` (`id`),
  CONSTRAINT `fk_stockverificationitem_rack` FOREIGN KEY (`rackId`) REFERENCES `Rack` (`id`),
  CONSTRAINT `fk_stockverificationitem_shelf` FOREIGN KEY (`shelfId`) REFERENCES `Shelf` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Expense Management
-- =====================================================

CREATE TABLE `ExpenseType` (
  `id` VARCHAR(36) PRIMARY KEY,
  `code` VARCHAR(50) UNIQUE NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `category` VARCHAR(100) NOT NULL,
  `budget` DOUBLE NOT NULL DEFAULT 0,
  `spent` DOUBLE NOT NULL DEFAULT 0,
  `status` VARCHAR(50) NOT NULL DEFAULT 'Active',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `idx_expensetype_code` (`code`),
  INDEX `idx_expensetype_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `PostedExpense` (
  `id` VARCHAR(36) PRIMARY KEY,
  `date` DATETIME(3) NOT NULL,
  `expenseTypeId` VARCHAR(36) NOT NULL,
  `amount` DOUBLE NOT NULL,
  `paidTo` VARCHAR(255) NOT NULL,
  `paymentMode` VARCHAR(50) NOT NULL DEFAULT 'Cash',
  `referenceNumber` VARCHAR(255),
  `description` TEXT,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `idx_postedexpense_date` (`date`),
  INDEX `idx_postedexpense_expenseTypeId` (`expenseTypeId`),
  CONSTRAINT `fk_postedexpense_expensetype` FOREIGN KEY (`expenseTypeId`) REFERENCES `ExpenseType` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `OperationalExpense` (
  `id` VARCHAR(36) PRIMARY KEY,
  `date` DATETIME(3) NOT NULL,
  `voucherNo` VARCHAR(100) UNIQUE NOT NULL,
  `expenseType` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `paidTo` VARCHAR(255) NOT NULL,
  `amount` DOUBLE NOT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'Pending',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `idx_operationalexpense_voucherNo` (`voucherNo`),
  INDEX `idx_operationalexpense_date` (`date`),
  INDEX `idx_operationalexpense_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Accounting System
-- =====================================================

CREATE TABLE `MainGroup` (
  `id` VARCHAR(36) PRIMARY KEY,
  `code` VARCHAR(50) UNIQUE NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `type` VARCHAR(50) NOT NULL,
  `displayOrder` INT,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `idx_maingroup_code` (`code`),
  INDEX `idx_maingroup_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `Subgroup` (
  `id` VARCHAR(36) PRIMARY KEY,
  `mainGroupId` VARCHAR(36) NOT NULL,
  `code` VARCHAR(50) UNIQUE NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT TRUE,
  `canDelete` BOOLEAN NOT NULL DEFAULT TRUE,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `idx_subgroup_code` (`code`),
  INDEX `idx_subgroup_mainGroupId` (`mainGroupId`),
  CONSTRAINT `fk_subgroup_maingroup` FOREIGN KEY (`mainGroupId`) REFERENCES `MainGroup` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `Account` (
  `id` VARCHAR(36) PRIMARY KEY,
  `subgroupId` VARCHAR(36) NOT NULL,
  `code` VARCHAR(50) UNIQUE NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `accountType` VARCHAR(50) NOT NULL DEFAULT 'regular',
  `openingBalance` DOUBLE NOT NULL DEFAULT 0,
  `currentBalance` DOUBLE NOT NULL DEFAULT 0,
  `status` VARCHAR(50) NOT NULL DEFAULT 'Active',
  `canDelete` BOOLEAN NOT NULL DEFAULT TRUE,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `idx_account_code` (`code`),
  INDEX `idx_account_subgroupId` (`subgroupId`),
  INDEX `idx_account_status` (`status`),
  CONSTRAINT `fk_account_subgroup` FOREIGN KEY (`subgroupId`) REFERENCES `Subgroup` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `JournalEntry` (
  `id` VARCHAR(36) PRIMARY KEY,
  `entryNo` VARCHAR(100) UNIQUE NOT NULL,
  `entryDate` DATETIME(3) NOT NULL,
  `reference` VARCHAR(255),
  `description` TEXT,
  `totalDebit` DOUBLE NOT NULL DEFAULT 0,
  `totalCredit` DOUBLE NOT NULL DEFAULT 0,
  `status` VARCHAR(50) NOT NULL DEFAULT 'draft',
  `createdBy` VARCHAR(255),
  `postedBy` VARCHAR(255),
  `postedAt` DATETIME(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `idx_journalentry_entryNo` (`entryNo`),
  INDEX `idx_journalentry_entryDate` (`entryDate`),
  INDEX `idx_journalentry_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `JournalLine` (
  `id` VARCHAR(36) PRIMARY KEY,
  `journalEntryId` VARCHAR(36) NOT NULL,
  `accountId` VARCHAR(36) NOT NULL,
  `description` TEXT,
  `debit` DOUBLE NOT NULL DEFAULT 0,
  `credit` DOUBLE NOT NULL DEFAULT 0,
  `lineOrder` INT NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `idx_journalline_journalEntryId` (`journalEntryId`),
  INDEX `idx_journalline_accountId` (`accountId`),
  CONSTRAINT `fk_journalline_journalentry` FOREIGN KEY (`journalEntryId`) REFERENCES `JournalEntry` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_journalline_account` FOREIGN KEY (`accountId`) REFERENCES `Account` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Customers and Suppliers
-- =====================================================

CREATE TABLE `Customer` (
  `id` VARCHAR(36) PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `address` TEXT,
  `email` VARCHAR(255),
  `cnic` VARCHAR(50),
  `contactNo` VARCHAR(50),
  `openingBalance` DOUBLE NOT NULL DEFAULT 0,
  `date` DATETIME(3),
  `creditLimit` DOUBLE NOT NULL DEFAULT 0,
  `status` VARCHAR(50) NOT NULL DEFAULT 'active',
  `priceType` VARCHAR(50),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `idx_customer_name` (`name`),
  INDEX `idx_customer_status` (`status`),
  INDEX `idx_customer_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `Supplier` (
  `id` VARCHAR(36) PRIMARY KEY,
  `code` VARCHAR(50) UNIQUE NOT NULL,
  `name` VARCHAR(255),
  `companyName` VARCHAR(255) NOT NULL,
  `address` TEXT,
  `city` VARCHAR(100),
  `state` VARCHAR(100),
  `country` VARCHAR(100),
  `zipCode` VARCHAR(20),
  `email` VARCHAR(255),
  `phone` VARCHAR(50),
  `cnic` VARCHAR(50),
  `contactPerson` VARCHAR(255),
  `taxId` VARCHAR(100),
  `paymentTerms` VARCHAR(255),
  `openingBalance` DOUBLE NOT NULL DEFAULT 0,
  `date` DATETIME(3),
  `status` VARCHAR(50) NOT NULL DEFAULT 'active',
  `notes` TEXT,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `idx_supplier_code` (`code`),
  INDEX `idx_supplier_status` (`status`),
  INDEX `idx_supplier_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- User Management
-- =====================================================

CREATE TABLE `User` (
  `id` VARCHAR(36) PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) UNIQUE NOT NULL,
  `password` VARCHAR(255),
  `role` VARCHAR(50) NOT NULL DEFAULT 'Staff',
  `status` VARCHAR(50) NOT NULL DEFAULT 'active',
  `lastLogin` VARCHAR(255) DEFAULT '-',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `idx_user_email` (`email`),
  INDEX `idx_user_status` (`status`),
  INDEX `idx_user_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `Role` (
  `id` VARCHAR(36) PRIMARY KEY,
  `name` VARCHAR(255) UNIQUE NOT NULL,
  `type` VARCHAR(50) NOT NULL DEFAULT 'Custom',
  `description` TEXT,
  `permissions` TEXT NOT NULL,
  `usersCount` INT NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `idx_role_name` (`name`),
  INDEX `idx_role_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Activity Logs and Approval Flows
-- =====================================================

CREATE TABLE `ActivityLog` (
  `id` VARCHAR(36) PRIMARY KEY,
  `timestamp` VARCHAR(50) NOT NULL,
  `user` VARCHAR(255) NOT NULL,
  `userRole` VARCHAR(50) NOT NULL,
  `action` VARCHAR(255) NOT NULL,
  `actionType` VARCHAR(50) NOT NULL,
  `module` VARCHAR(100) NOT NULL,
  `description` TEXT NOT NULL,
  `ipAddress` VARCHAR(50) NOT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'success',
  `details` TEXT,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `idx_activitylog_user` (`user`),
  INDEX `idx_activitylog_module` (`module`),
  INDEX `idx_activitylog_actionType` (`actionType`),
  INDEX `idx_activitylog_createdAt` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `ApprovalFlow` (
  `id` VARCHAR(36) PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'active',
  `description` TEXT,
  `steps` TEXT NOT NULL,
  `module` VARCHAR(100) NOT NULL,
  `trigger` VARCHAR(100) NOT NULL DEFAULT 'On Create',
  `condition` TEXT,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `idx_approvalflow_module` (`module`),
  INDEX `idx_approvalflow_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Backup Management
-- =====================================================

CREATE TABLE `Backup` (
  `id` VARCHAR(36) PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `tables` TEXT NOT NULL,
  `type` VARCHAR(50) NOT NULL DEFAULT 'full',
  `size` VARCHAR(50),
  `status` VARCHAR(50) NOT NULL DEFAULT 'in_progress',
  `createdAt` VARCHAR(50) NOT NULL,
  `createdBy` VARCHAR(255) NOT NULL,
  INDEX `idx_backup_status` (`status`),
  INDEX `idx_backup_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `BackupSchedule` (
  `id` VARCHAR(36) PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `frequency` VARCHAR(50) NOT NULL,
  `tables` TEXT NOT NULL,
  `time` VARCHAR(50) NOT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'active',
  `lastRun` VARCHAR(50),
  `nextRun` VARCHAR(50),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `idx_backupschedule_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- System Settings
-- =====================================================

CREATE TABLE `CompanyProfile` (
  `id` VARCHAR(36) PRIMARY KEY,
  `companyInfo` TEXT NOT NULL,
  `systemSettings` TEXT NOT NULL,
  `invoiceSettings` TEXT NOT NULL,
  `notificationSettings` TEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `WhatsAppSettings` (
  `id` VARCHAR(36) PRIMARY KEY,
  `appKey` VARCHAR(255),
  `authKey` VARCHAR(255),
  `administratorPhoneNumber` VARCHAR(50),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `LongCatSettings` (
  `id` VARCHAR(36) PRIMARY KEY,
  `apiKey` VARCHAR(255),
  `model` VARCHAR(100) DEFAULT 'LongCat-Flash-Chat',
  `baseUrl` VARCHAR(255) DEFAULT 'https://api.longcat.chat',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Kits Management
-- =====================================================

CREATE TABLE `Kit` (
  `id` VARCHAR(36) PRIMARY KEY,
  `badge` VARCHAR(100) UNIQUE NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `sellingPrice` DOUBLE NOT NULL DEFAULT 0,
  `totalCost` DOUBLE NOT NULL DEFAULT 0,
  `itemsCount` INT NOT NULL DEFAULT 0,
  `status` VARCHAR(50) NOT NULL DEFAULT 'Active',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `idx_kit_badge` (`badge`),
  INDEX `idx_kit_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `KitItem` (
  `id` VARCHAR(36) PRIMARY KEY,
  `kitId` VARCHAR(36) NOT NULL,
  `partId` VARCHAR(36) NOT NULL,
  `partNo` VARCHAR(255) NOT NULL,
  `partName` VARCHAR(255) NOT NULL,
  `quantity` INT NOT NULL DEFAULT 1,
  `costPerUnit` DOUBLE NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `idx_kititem_kitId` (`kitId`),
  INDEX `idx_kititem_partId` (`partId`),
  CONSTRAINT `fk_kititem_kit` FOREIGN KEY (`kitId`) REFERENCES `Kit` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_kititem_part` FOREIGN KEY (`partId`) REFERENCES `Part` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Vouchers System
-- =====================================================

CREATE TABLE `Voucher` (
  `id` VARCHAR(36) PRIMARY KEY,
  `voucherNumber` VARCHAR(100) UNIQUE NOT NULL,
  `type` VARCHAR(50) NOT NULL,
  `date` DATETIME(3) NOT NULL,
  `narration` TEXT,
  `cashBankAccount` VARCHAR(255),
  `chequeNumber` VARCHAR(100),
  `chequeDate` DATETIME(3),
  `totalDebit` DOUBLE NOT NULL DEFAULT 0,
  `totalCredit` DOUBLE NOT NULL DEFAULT 0,
  `status` VARCHAR(50) NOT NULL DEFAULT 'draft',
  `createdBy` VARCHAR(255),
  `approvedBy` VARCHAR(255),
  `approvedAt` DATETIME(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `idx_voucher_voucherNumber` (`voucherNumber`),
  INDEX `idx_voucher_type` (`type`),
  INDEX `idx_voucher_date` (`date`),
  INDEX `idx_voucher_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `VoucherEntry` (
  `id` VARCHAR(36) PRIMARY KEY,
  `voucherId` VARCHAR(36) NOT NULL,
  `accountId` VARCHAR(36),
  `accountName` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `debit` DOUBLE NOT NULL DEFAULT 0,
  `credit` DOUBLE NOT NULL DEFAULT 0,
  `sortOrder` INT NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `idx_voucherentry_voucherId` (`voucherId`),
  INDEX `idx_voucherentry_accountId` (`accountId`),
  CONSTRAINT `fk_voucherentry_voucher` FOREIGN KEY (`voucherId`) REFERENCES `Voucher` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_voucherentry_account` FOREIGN KEY (`accountId`) REFERENCES `Account` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Sales System
-- =====================================================

CREATE TABLE `SalesInquiry` (
  `id` VARCHAR(36) PRIMARY KEY,
  `inquiryNo` VARCHAR(100) UNIQUE NOT NULL,
  `inquiryDate` DATETIME(3) NOT NULL,
  `customerName` VARCHAR(255) NOT NULL,
  `customerEmail` VARCHAR(255),
  `customerPhone` VARCHAR(50),
  `subject` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `status` VARCHAR(50) NOT NULL DEFAULT 'New',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `idx_salesinquiry_inquiryNo` (`inquiryNo`),
  INDEX `idx_salesinquiry_status` (`status`),
  INDEX `idx_salesinquiry_inquiryDate` (`inquiryDate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `SalesInquiryItem` (
  `id` VARCHAR(36) PRIMARY KEY,
  `inquiryId` VARCHAR(36) NOT NULL,
  `partId` VARCHAR(36) NOT NULL,
  `quantity` INT NOT NULL,
  `purchasePrice` DOUBLE,
  `priceA` DOUBLE,
  `priceB` DOUBLE,
  `priceM` DOUBLE,
  `location` VARCHAR(255),
  `stock` INT NOT NULL DEFAULT 0,
  `reservedQty` INT NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `idx_salesinquiryitem_inquiryId` (`inquiryId`),
  INDEX `idx_salesinquiryitem_partId` (`partId`),
  CONSTRAINT `fk_salesinquiryitem_inquiry` FOREIGN KEY (`inquiryId`) REFERENCES `SalesInquiry` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_salesinquiryitem_part` FOREIGN KEY (`partId`) REFERENCES `Part` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `SalesQuotation` (
  `id` VARCHAR(36) PRIMARY KEY,
  `quotationNo` VARCHAR(100) UNIQUE NOT NULL,
  `quotationDate` DATETIME(3) NOT NULL,
  `validUntil` DATETIME(3) NOT NULL,
  `customerName` VARCHAR(255) NOT NULL,
  `customerEmail` VARCHAR(255),
  `customerPhone` VARCHAR(50),
  `customerAddress` TEXT,
  `status` VARCHAR(50) NOT NULL DEFAULT 'draft',
  `totalAmount` DOUBLE NOT NULL DEFAULT 0,
  `notes` TEXT,
  `invoiceId` VARCHAR(36) UNIQUE,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `idx_salesquotation_quotationNo` (`quotationNo`),
  INDEX `idx_salesquotation_status` (`status`),
  INDEX `idx_salesquotation_quotationDate` (`quotationDate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `SalesQuotationItem` (
  `id` VARCHAR(36) PRIMARY KEY,
  `quotationId` VARCHAR(36) NOT NULL,
  `partId` VARCHAR(36) NOT NULL,
  `partNo` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `quantity` INT NOT NULL,
  `unitPrice` DOUBLE NOT NULL,
  `total` DOUBLE NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `idx_salesquotationitem_quotationId` (`quotationId`),
  INDEX `idx_salesquotationitem_partId` (`partId`),
  CONSTRAINT `fk_salesquotationitem_quotation` FOREIGN KEY (`quotationId`) REFERENCES `SalesQuotation` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_salesquotationitem_part` FOREIGN KEY (`partId`) REFERENCES `Part` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `SalesInvoice` (
  `id` VARCHAR(36) PRIMARY KEY,
  `invoiceNo` VARCHAR(100) UNIQUE NOT NULL,
  `invoiceDate` DATETIME(3) NOT NULL,
  `customerId` VARCHAR(36),
  `customerName` VARCHAR(255) NOT NULL,
  `customerType` VARCHAR(50) NOT NULL,
  `salesPerson` VARCHAR(255),
  `subtotal` DOUBLE NOT NULL DEFAULT 0,
  `overallDiscount` DOUBLE NOT NULL DEFAULT 0,
  `tax` DOUBLE NOT NULL DEFAULT 0,
  `grandTotal` DOUBLE NOT NULL DEFAULT 0,
  `paidAmount` DOUBLE NOT NULL DEFAULT 0,
  `status` VARCHAR(50) NOT NULL DEFAULT 'pending',
  `paymentStatus` VARCHAR(50) NOT NULL DEFAULT 'unpaid',
  `accountId` VARCHAR(36),
  `deliveredTo` VARCHAR(255),
  `remarks` TEXT,
  `quotationId` VARCHAR(36),
  `holdReason` TEXT,
  `holdSince` DATETIME(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `idx_salesinvoice_invoiceNo` (`invoiceNo`),
  INDEX `idx_salesinvoice_customerId` (`customerId`),
  INDEX `idx_salesinvoice_status` (`status`),
  INDEX `idx_salesinvoice_paymentStatus` (`paymentStatus`),
  INDEX `idx_salesinvoice_invoiceDate` (`invoiceDate`),
  CONSTRAINT `fk_salesinvoice_account` FOREIGN KEY (`accountId`) REFERENCES `Account` (`id`),
  CONSTRAINT `fk_salesinvoice_quotation` FOREIGN KEY (`invoiceId`) REFERENCES `SalesQuotation` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `SalesInvoiceItem` (
  `id` VARCHAR(36) PRIMARY KEY,
  `invoiceId` VARCHAR(36) NOT NULL,
  `partId` VARCHAR(36) NOT NULL,
  `partNo` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `orderedQty` INT NOT NULL,
  `deliveredQty` INT NOT NULL DEFAULT 0,
  `pendingQty` INT NOT NULL,
  `unitPrice` DOUBLE NOT NULL,
  `discount` DOUBLE NOT NULL DEFAULT 0,
  `lineTotal` DOUBLE NOT NULL,
  `grade` VARCHAR(100),
  `brand` VARCHAR(255),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `idx_salesinvoiceitem_invoiceId` (`invoiceId`),
  INDEX `idx_salesinvoiceitem_partId` (`partId`),
  CONSTRAINT `fk_salesinvoiceitem_invoice` FOREIGN KEY (`invoiceId`) REFERENCES `SalesInvoice` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_salesinvoiceitem_part` FOREIGN KEY (`partId`) REFERENCES `Part` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `StockReservation` (
  `id` VARCHAR(36) PRIMARY KEY,
  `invoiceId` VARCHAR(36) NOT NULL,
  `partId` VARCHAR(36) NOT NULL,
  `quantity` INT NOT NULL,
  `reservedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `releasedAt` DATETIME(3),
  `status` VARCHAR(50) NOT NULL DEFAULT 'reserved',
  INDEX `idx_stockreservation_invoiceId` (`invoiceId`),
  INDEX `idx_stockreservation_partId` (`partId`),
  INDEX `idx_stockreservation_status` (`status`),
  CONSTRAINT `fk_stockreservation_invoice` FOREIGN KEY (`invoiceId`) REFERENCES `SalesInvoice` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_stockreservation_part` FOREIGN KEY (`partId`) REFERENCES `Part` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `DeliveryLog` (
  `id` VARCHAR(36) PRIMARY KEY,
  `invoiceId` VARCHAR(36) NOT NULL,
  `challanNo` VARCHAR(100) NOT NULL,
  `deliveryDate` DATETIME(3) NOT NULL,
  `deliveredBy` VARCHAR(255),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `idx_deliverylog_invoiceId` (`invoiceId`),
  INDEX `idx_deliverylog_challanNo` (`challanNo`),
  INDEX `idx_deliverylog_deliveryDate` (`deliveryDate`),
  CONSTRAINT `fk_deliverylog_invoice` FOREIGN KEY (`invoiceId`) REFERENCES `SalesInvoice` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `DeliveryLogItem` (
  `id` VARCHAR(36) PRIMARY KEY,
  `deliveryLogId` VARCHAR(36) NOT NULL,
  `invoiceItemId` VARCHAR(36) NOT NULL,
  `quantity` INT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `idx_deliverylogitem_deliveryLogId` (`deliveryLogId`),
  INDEX `idx_deliverylogitem_invoiceItemId` (`invoiceItemId`),
  CONSTRAINT `fk_deliverylogitem_deliverylog` FOREIGN KEY (`deliveryLogId`) REFERENCES `DeliveryLog` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_deliverylogitem_invoiceitem` FOREIGN KEY (`invoiceItemId`) REFERENCES `SalesInvoiceItem` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `Receivable` (
  `id` VARCHAR(36) PRIMARY KEY,
  `invoiceId` VARCHAR(36) UNIQUE NOT NULL,
  `customerId` VARCHAR(36),
  `amount` DOUBLE NOT NULL,
  `paidAmount` DOUBLE NOT NULL DEFAULT 0,
  `dueAmount` DOUBLE NOT NULL,
  `dueDate` DATETIME(3),
  `status` VARCHAR(50) NOT NULL DEFAULT 'pending',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `idx_receivable_invoiceId` (`invoiceId`),
  INDEX `idx_receivable_customerId` (`customerId`),
  INDEX `idx_receivable_status` (`status`),
  CONSTRAINT `fk_receivable_invoice` FOREIGN KEY (`invoiceId`) REFERENCES `SalesInvoice` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_receivable_customer` FOREIGN KEY (`customerId`) REFERENCES `Customer` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- End of Schema
-- =====================================================
