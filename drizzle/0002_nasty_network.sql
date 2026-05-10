CREATE TABLE `RetreatIntakeResponse` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))) NOT NULL,
	`retreatId` text NOT NULL,
	`participantName` text NOT NULL,
	`participantEmail` text,
	`participantRole` text,
	`answers` text DEFAULT '{}' NOT NULL,
	`submittedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`retreatId`) REFERENCES `Retreat`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `RetreatTemplate` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))) NOT NULL,
	`organizationId` text,
	`name` text NOT NULL,
	`tagline` text,
	`philosophy` text DEFAULT '' NOT NULL,
	`agenda` text DEFAULT '[]' NOT NULL,
	`intakeSchema` text DEFAULT '[]' NOT NULL,
	`isGlobal` integer DEFAULT false NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `CoachingClient` ADD `portalToken` text;--> statement-breakpoint
ALTER TABLE `CoachingClient` ADD `portalEnabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `CoachingClient_portalToken_unique` ON `CoachingClient` (`portalToken`);--> statement-breakpoint
ALTER TABLE `Report` ADD `boardPackDocumentId` text;--> statement-breakpoint
ALTER TABLE `Retreat` ADD `intakeToken` text;--> statement-breakpoint
ALTER TABLE `Retreat` ADD `intakeOpen` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `Retreat` ADD `philosophy` text;--> statement-breakpoint
CREATE UNIQUE INDEX `Retreat_intakeToken_unique` ON `Retreat` (`intakeToken`);