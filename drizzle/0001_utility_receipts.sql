CREATE TABLE `utility_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`period` text NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`account` text NOT NULL,
	`amount` text NOT NULL,
	`paid_amount` text NOT NULL,
	`status` text NOT NULL,
	`due_date` text NOT NULL,
	`paid_date` text NOT NULL,
	`items` text NOT NULL,
	`file_name` text NOT NULL,
	`file_data` text NOT NULL,
	`notes` text NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `receipt_owner_period_category_account` ON `utility_receipts` (`owner`,`period`,`category`,`account`);
