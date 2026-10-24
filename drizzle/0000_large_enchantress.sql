CREATE TABLE `utility_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`provider` text NOT NULL,
	`account` text NOT NULL,
	`meters` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_owner_provider` ON `utility_accounts` (`owner`,`provider`);--> statement-breakpoint
CREATE TABLE `utility_readings` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`provider` text NOT NULL,
	`account` text NOT NULL,
	`period` text NOT NULL,
	`values` text NOT NULL,
	`status` text NOT NULL,
	`detail` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reading_owner_provider_period` ON `utility_readings` (`owner`,`provider`,`period`);