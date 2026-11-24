ALTER TABLE `utility_receipts` ADD COLUMN `payment_method` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `utility_receipts` ADD COLUMN `transaction_id` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `utility_receipts` ADD COLUMN `paid_file_name` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `utility_receipts` ADD COLUMN `paid_file_data` text NOT NULL DEFAULT '';
