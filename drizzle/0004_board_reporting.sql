CREATE TABLE `Risk` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))) NOT NULL,
	`organizationId` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`category` text DEFAULT 'OPERATIONAL' NOT NULL,
	`likelihood` integer DEFAULT 3 NOT NULL,
	`impact` integer DEFAULT 3 NOT NULL,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`ownerId` text,
	`mitigation` text,
	`closedAt` integer,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `Risk_organizationId_status_idx` ON `Risk` (`organizationId`,`status`);--> statement-breakpoint
CREATE TABLE `RiskReview` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))) NOT NULL,
	`riskId` text NOT NULL,
	`meetingId` text,
	`likelihood` integer NOT NULL,
	`impact` integer NOT NULL,
	`status` text NOT NULL,
	`note` text,
	`reviewedById` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`riskId`) REFERENCES `Risk`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`meetingId`) REFERENCES `Meeting`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `RiskReview_riskId_createdAt_idx` ON `RiskReview` (`riskId`,`createdAt`);--> statement-breakpoint
CREATE TABLE `Project` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))) NOT NULL,
	`organizationId` text NOT NULL,
	`name` text NOT NULL,
	`summary` text,
	`status` text DEFAULT 'ON_TRACK' NOT NULL,
	`ownerId` text,
	`startDate` integer,
	`targetDate` integer,
	`completedAt` integer,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `Project_organizationId_status_idx` ON `Project` (`organizationId`,`status`);--> statement-breakpoint
CREATE TABLE `ProjectMilestone` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))) NOT NULL,
	`projectId` text NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`title` text NOT NULL,
	`dueDate` integer,
	`status` text DEFAULT 'PLANNED' NOT NULL,
	`completedAt` integer,
	FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ProjectMilestone_projectId_order_idx` ON `ProjectMilestone` (`projectId`,`order`);--> statement-breakpoint
CREATE TABLE `ProjectUpdate` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))) NOT NULL,
	`projectId` text NOT NULL,
	`period` integer NOT NULL,
	`headline` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'ON_TRACK' NOT NULL,
	`authorId` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ProjectUpdate_projectId_period_key` ON `ProjectUpdate` (`projectId`,`period`);--> statement-breakpoint
CREATE TABLE `TeamUpdate` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))) NOT NULL,
	`organizationId` text NOT NULL,
	`period` integer NOT NULL,
	`headline` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`hires` text,
	`departures` text,
	`openRoles` text,
	`headcount` integer,
	`authorId` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `TeamUpdate_organizationId_period_key` ON `TeamUpdate` (`organizationId`,`period`);--> statement-breakpoint
CREATE TABLE `Customer` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))) NOT NULL,
	`organizationId` text NOT NULL,
	`name` text NOT NULL,
	`segment` text,
	`region` text,
	`arr` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`ownerId` text,
	`notes` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `Customer_organizationId_status_idx` ON `Customer` (`organizationId`,`status`);--> statement-breakpoint
CREATE TABLE `CustomerUpdate` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))) NOT NULL,
	`customerId` text NOT NULL,
	`period` integer NOT NULL,
	`health` text DEFAULT 'GREEN' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`authorId` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `CustomerUpdate_customerId_period_key` ON `CustomerUpdate` (`customerId`,`period`);--> statement-breakpoint
CREATE TABLE `GtmUpdate` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))) NOT NULL,
	`organizationId` text NOT NULL,
	`period` integer NOT NULL,
	`headline` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`pipelineValue` integer DEFAULT 0 NOT NULL,
	`qualifiedLeads` integer DEFAULT 0 NOT NULL,
	`newWins` integer DEFAULT 0 NOT NULL,
	`lostDeals` integer DEFAULT 0 NOT NULL,
	`newArr` integer DEFAULT 0 NOT NULL,
	`metricsJson` text DEFAULT '{}' NOT NULL,
	`authorId` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `GtmUpdate_organizationId_period_key` ON `GtmUpdate` (`organizationId`,`period`);
