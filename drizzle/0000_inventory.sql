CREATE TABLE `imports` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`hash` text NOT NULL,
	`filename` text NOT NULL,
	`row_count` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `imports_owner_hash_unique` ON `imports` (`owner`,`hash`);--> statement-breakpoint
CREATE TABLE `products` (
	`owner` text NOT NULL,
	`sku` text NOT NULL,
	`name` text NOT NULL,
	`quantity` integer NOT NULL,
	`price` integer NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`owner`, `sku`)
);
