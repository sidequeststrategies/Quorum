CREATE TABLE `Account` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))) NOT NULL,
	`userId` text NOT NULL,
	`type` text NOT NULL,
	`provider` text NOT NULL,
	`providerAccountId` text NOT NULL,
	`refresh_token` text,
	`access_token` text,
	`expires_at` integer,
	`token_type` text,
	`scope` text,
	`id_token` text,
	`session_state` text,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Account_provider_providerAccountId_key` ON `Account` (`provider`,`providerAccountId`);--> statement-breakpoint
CREATE TABLE `ActionItem` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))) NOT NULL,
	`organizationId` text NOT NULL,
	`meetingId` text,
	`assigneeId` text,
	`title` text NOT NULL,
	`description` text,
	`dueDate` integer,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`meetingId`) REFERENCES `Meeting`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`assigneeId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `AgendaItem` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))) NOT NULL,
	`meetingId` text NOT NULL,
	`order` integer NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`durationMin` integer DEFAULT 10 NOT NULL,
	`presenterId` text,
	FOREIGN KEY (`meetingId`) REFERENCES `Meeting`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`presenterId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `AgendaItem_meetingId_order_idx` ON `AgendaItem` (`meetingId`,`order`);--> statement-breakpoint
CREATE TABLE `Attendance` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))) NOT NULL,
	`meetingId` text NOT NULL,
	`userId` text NOT NULL,
	`status` text DEFAULT 'INVITED' NOT NULL,
	`respondedAt` integer,
	FOREIGN KEY (`meetingId`) REFERENCES `Meeting`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Attendance_meetingId_userId_key` ON `Attendance` (`meetingId`,`userId`);--> statement-breakpoint
CREATE TABLE `Document` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))) NOT NULL,
	`organizationId` text NOT NULL,
	`meetingId` text,
	`uploadedById` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`filename` text NOT NULL,
	`mimeType` text NOT NULL,
	`sizeBytes` integer NOT NULL,
	`storagePath` text NOT NULL,
	`visibility` text DEFAULT 'ALL_MEMBERS' NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`meetingId`) REFERENCES `Meeting`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `Document_organizationId_meetingId_idx` ON `Document` (`organizationId`,`meetingId`);--> statement-breakpoint
CREATE TABLE `Meeting` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))) NOT NULL,
	`organizationId` text NOT NULL,
	`title` text NOT NULL,
	`type` text DEFAULT 'REGULAR' NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`scheduledAt` integer NOT NULL,
	`durationMin` integer DEFAULT 60 NOT NULL,
	`location` text,
	`videoUrl` text,
	`notes` text,
	`minutes` text,
	`quorumRequired` integer DEFAULT 0 NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `Membership` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))) NOT NULL,
	`userId` text NOT NULL,
	`organizationId` text NOT NULL,
	`role` text DEFAULT 'DIRECTOR' NOT NULL,
	`title` text,
	`organizationLabel` text,
	`votingRights` integer DEFAULT true NOT NULL,
	`termStart` integer,
	`termEnd` integer,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Membership_userId_organizationId_key` ON `Membership` (`userId`,`organizationId`);--> statement-breakpoint
CREATE TABLE `Organization` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))) NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`legalName` text,
	`jurisdiction` text,
	`logoUrl` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Organization_slug_unique` ON `Organization` (`slug`);--> statement-breakpoint
CREATE TABLE `Resolution` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))) NOT NULL,
	`organizationId` text NOT NULL,
	`meetingId` text,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`kind` text DEFAULT 'MEETING_VOTE' NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`requiresUnanimous` integer DEFAULT false NOT NULL,
	`openedAt` integer,
	`closedAt` integer,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`meetingId`) REFERENCES `Meeting`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `Session` (
	`sessionToken` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `User` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))) NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`image` text,
	`passwordHash` text,
	`emailVerified` integer,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `User_email_unique` ON `User` (`email`);--> statement-breakpoint
CREATE TABLE `VerificationToken` (
	`identifier` text NOT NULL,
	`token` text NOT NULL,
	`expires` integer NOT NULL,
	PRIMARY KEY(`identifier`, `token`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `VerificationToken_token_unique` ON `VerificationToken` (`token`);--> statement-breakpoint
CREATE TABLE `Vote` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))) NOT NULL,
	`resolutionId` text NOT NULL,
	`userId` text NOT NULL,
	`choice` text NOT NULL,
	`comment` text,
	`castAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`resolutionId`) REFERENCES `Resolution`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Vote_resolutionId_userId_key` ON `Vote` (`resolutionId`,`userId`);