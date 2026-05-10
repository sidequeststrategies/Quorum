CREATE TABLE `CoachingClient` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))) NOT NULL,
	`ownerId` text NOT NULL,
	`programId` text,
	`name` text NOT NULL,
	`email` text,
	`company` text,
	`role` text,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`startDate` integer,
	`notes` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`programId`) REFERENCES `CoachingProgram`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `CoachingLesson` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))) NOT NULL,
	`programId` text NOT NULL,
	`order` integer NOT NULL,
	`title` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`durationMin` integer DEFAULT 45 NOT NULL,
	`exercises` text DEFAULT '[]' NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`programId`) REFERENCES `CoachingProgram`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `CoachingLesson_programId_order_idx` ON `CoachingLesson` (`programId`,`order`);--> statement-breakpoint
CREATE TABLE `CoachingProgram` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))) NOT NULL,
	`ownerId` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`kind` text DEFAULT 'FOUNDER' NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `CoachingSession` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))) NOT NULL,
	`clientId` text NOT NULL,
	`ownerId` text NOT NULL,
	`sessionDate` integer NOT NULL,
	`durationMin` integer DEFAULT 60 NOT NULL,
	`topic` text,
	`notes` text,
	`followUps` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`clientId`) REFERENCES `CoachingClient`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `FinancialPlan` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))) NOT NULL,
	`organizationId` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`horizonMonths` integer DEFAULT 24 NOT NULL,
	`startingCash` integer DEFAULT 0 NOT NULL,
	`startMonth` integer NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `FinancialScenario` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))) NOT NULL,
	`planId` text NOT NULL,
	`name` text NOT NULL,
	`kind` text DEFAULT 'CUSTOM' NOT NULL,
	`assumptions` text NOT NULL,
	`notes` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`planId`) REFERENCES `FinancialPlan`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `LessonAssignment` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))) NOT NULL,
	`lessonId` text NOT NULL,
	`clientId` text NOT NULL,
	`status` text DEFAULT 'ASSIGNED' NOT NULL,
	`assignedAt` integer DEFAULT (unixepoch()) NOT NULL,
	`completedAt` integer,
	`notes` text,
	FOREIGN KEY (`lessonId`) REFERENCES `CoachingLesson`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`clientId`) REFERENCES `CoachingClient`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `LessonAssignment_lessonId_clientId_key` ON `LessonAssignment` (`lessonId`,`clientId`);--> statement-breakpoint
CREATE TABLE `ReportTemplate` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))) NOT NULL,
	`organizationId` text,
	`name` text NOT NULL,
	`description` text,
	`sections` text NOT NULL,
	`isGlobal` integer DEFAULT false NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `Report` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))) NOT NULL,
	`organizationId` text NOT NULL,
	`templateId` text,
	`meetingId` text,
	`authorId` text NOT NULL,
	`title` text NOT NULL,
	`values` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`templateId`) REFERENCES `ReportTemplate`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`meetingId`) REFERENCES `Meeting`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `RetreatActivity` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))) NOT NULL,
	`organizationId` text,
	`title` text NOT NULL,
	`kind` text DEFAULT 'TEAM_SKILL' NOT NULL,
	`description` text,
	`durationMin` integer DEFAULT 30 NOT NULL,
	`groupSizeMin` integer DEFAULT 2 NOT NULL,
	`groupSizeMax` integer DEFAULT 50 NOT NULL,
	`instructions` text DEFAULT '' NOT NULL,
	`materials` text,
	`learningObjectives` text,
	`isGlobal` integer DEFAULT false NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `RetreatAgendaItem` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))) NOT NULL,
	`retreatId` text NOT NULL,
	`activityId` text,
	`order` integer NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`scheduledAt` integer,
	`durationMin` integer DEFAULT 30 NOT NULL,
	`facilitatorName` text,
	FOREIGN KEY (`retreatId`) REFERENCES `Retreat`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`activityId`) REFERENCES `RetreatActivity`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `RetreatAgendaItem_retreatId_order_idx` ON `RetreatAgendaItem` (`retreatId`,`order`);--> statement-breakpoint
CREATE TABLE `RetreatTakeaway` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))) NOT NULL,
	`retreatId` text NOT NULL,
	`authorId` text NOT NULL,
	`content` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`retreatId`) REFERENCES `Retreat`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `Retreat` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))) NOT NULL,
	`organizationId` text NOT NULL,
	`organizerId` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`location` text,
	`startDate` integer NOT NULL,
	`endDate` integer NOT NULL,
	`status` text DEFAULT 'PLANNING' NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organizerId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action
);
