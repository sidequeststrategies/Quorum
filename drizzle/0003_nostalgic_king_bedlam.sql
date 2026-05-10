CREATE TABLE `ChatMessage` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))) NOT NULL,
	`threadId` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`threadId`) REFERENCES `ChatThread`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ChatMessage_threadId_createdAt_idx` ON `ChatMessage` (`threadId`,`createdAt`);--> statement-breakpoint
CREATE TABLE `ChatThread` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))) NOT NULL,
	`organizationId` text NOT NULL,
	`userId` text NOT NULL,
	`title` text DEFAULT 'New conversation' NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `FinancialDocument` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))) NOT NULL,
	`organizationId` text NOT NULL,
	`snapshotId` text,
	`period` integer NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`filename` text NOT NULL,
	`mimeType` text NOT NULL,
	`sizeBytes` integer NOT NULL,
	`storagePath` text NOT NULL,
	`uploadedById` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`snapshotId`) REFERENCES `FinancialSnapshot`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `FinancialDocument_organizationId_kind_period_idx` ON `FinancialDocument` (`organizationId`,`kind`,`period`);--> statement-breakpoint
CREATE TABLE `FinancialSnapshot` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))) NOT NULL,
	`organizationId` text NOT NULL,
	`period` integer NOT NULL,
	`cash` integer DEFAULT 0 NOT NULL,
	`arr` integer DEFAULT 0 NOT NULL,
	`mrr` integer DEFAULT 0 NOT NULL,
	`revenue` integer DEFAULT 0 NOT NULL,
	`grossMargin` integer DEFAULT 0 NOT NULL,
	`burn` integer DEFAULT 0 NOT NULL,
	`headcount` integer DEFAULT 0 NOT NULL,
	`accountsReceivable` integer DEFAULT 0 NOT NULL,
	`accountsPayable` integer DEFAULT 0 NOT NULL,
	`metricsJson` text DEFAULT '{}' NOT NULL,
	`notes` text,
	`createdById` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `FinancialSnapshot_organizationId_period_key` ON `FinancialSnapshot` (`organizationId`,`period`);