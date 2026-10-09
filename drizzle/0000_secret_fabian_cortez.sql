CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int,
	`action` varchar(64) NOT NULL,
	`entity_type` varchar(64),
	`entity_id` int,
	`details` json,
	`ip_address` varchar(64),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `blood_banks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(190) NOT NULL,
	`address` text,
	`city` varchar(120),
	`district` varchar(120),
	`phone` varchar(20),
	`email` varchar(190),
	`license_number` varchar(64),
	`status` varchar(32) NOT NULL DEFAULT 'ACTIVE',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `blood_banks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `blood_camps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(190) NOT NULL,
	`organizer_id` int,
	`location` varchar(255),
	`address` text,
	`city` varchar(120),
	`district` varchar(120),
	`latitude` decimal(10,8),
	`longitude` decimal(11,8),
	`start_date` date NOT NULL,
	`end_date` date,
	`start_time` varchar(8),
	`end_time` varchar(8),
	`status` varchar(32) NOT NULL DEFAULT 'UPCOMING',
	`target_donors` int DEFAULT 0,
	`registered_donors` int NOT NULL DEFAULT 0,
	`contact` varchar(64),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `blood_camps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `blood_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requester_id` int,
	`requester_name` varchar(160),
	`requester_phone` varchar(20),
	`blood_group` varchar(8) NOT NULL,
	`units_required` int NOT NULL DEFAULT 1,
	`hospital_id` int,
	`hospital_name` varchar(190),
	`hospital_location` text,
	`city` varchar(120),
	`district` varchar(120),
	`latitude` decimal(10,8),
	`longitude` decimal(11,8),
	`required_at` datetime DEFAULT NULL,
	`urgency` varchar(16) NOT NULL DEFAULT 'MEDIUM',
	`contact_info` varchar(255),
	`details` text,
	`status` varchar(32) NOT NULL DEFAULT 'CREATED',
	`current_wave` int NOT NULL DEFAULT 0,
	`donors_notified` int NOT NULL DEFAULT 0,
	`responses_received` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `blood_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `camp_registrations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`camp_id` int NOT NULL,
	`donor_id` int NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'REGISTERED',
	`registered_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `camp_registrations_id` PRIMARY KEY(`id`),
	CONSTRAINT `camp_registrations_unique_idx` UNIQUE(`camp_id`,`donor_id`)
);
--> statement-breakpoint
CREATE TABLE `cities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`district_id` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`pincode` varchar(10),
	`latitude` decimal(10,8),
	`longitude` decimal(11,8),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `consents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`donor_id` int NOT NULL,
	`consent_type` varchar(64) NOT NULL,
	`given` boolean NOT NULL DEFAULT false,
	`given_at` datetime DEFAULT NULL,
	`ip_address` varchar(64),
	`version` varchar(16) DEFAULT '1.0',
	CONSTRAINT `consents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `districts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`state` varchar(120) NOT NULL,
	`code` varchar(16),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `districts_id` PRIMARY KEY(`id`),
	CONSTRAINT `districts_name_state_idx` UNIQUE(`name`,`state`)
);
--> statement-breakpoint
CREATE TABLE `donation_certificates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`donation_id` int NOT NULL,
	`donor_id` int NOT NULL,
	`certificate_number` varchar(64) NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'PENDING',
	`issued_date` date,
	`received_date` date,
	`verified_date` date,
	`issued_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `donation_certificates_id` PRIMARY KEY(`id`),
	CONSTRAINT `donation_certificates_donation_id_unique` UNIQUE(`donation_id`),
	CONSTRAINT `donation_certificates_certificate_number_unique` UNIQUE(`certificate_number`)
);
--> statement-breakpoint
CREATE TABLE `donations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`donor_id` int NOT NULL,
	`donation_date` date NOT NULL,
	`donation_type` varchar(32) NOT NULL DEFAULT 'WHOLE_BLOOD',
	`hospital_id` int,
	`blood_bank_id` int,
	`camp_id` int,
	`units` decimal(4,2) DEFAULT '1',
	`hemoglobin` decimal(4,2),
	`verified` boolean NOT NULL DEFAULT false,
	`verified_by` int,
	`status` varchar(32) NOT NULL DEFAULT 'COMPLETED',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `donations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `donor_availability` (
	`id` int AUTO_INCREMENT NOT NULL,
	`donor_id` int NOT NULL,
	`available` boolean NOT NULL,
	`confirmed_at` timestamp NOT NULL DEFAULT (now()),
	`next_confirmation_date` datetime DEFAULT NULL,
	`source` varchar(32) DEFAULT 'SELF',
	`notes` text,
	CONSTRAINT `donor_availability_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `donor_health_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`donor_id` int NOT NULL,
	`health_record_id` int,
	`status` varchar(32) NOT NULL,
	`remarks` text,
	`recorded_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `donor_health_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `donor_health_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`donor_id` int NOT NULL,
	`health_status` varchar(32) NOT NULL DEFAULT 'HEALTHY',
	`recent_illness` text,
	`current_medications` text,
	`surgeries` text,
	`hospitalizations` text,
	`existing_conditions` text,
	`recent_fever` boolean DEFAULT false,
	`recent_vaccination` boolean DEFAULT false,
	`pregnancy_related` text,
	`weight` decimal(5,2),
	`last_health_confirmation` datetime DEFAULT NULL,
	`health_declaration` boolean NOT NULL DEFAULT false,
	`screening_status` varchar(32) NOT NULL DEFAULT 'PENDING',
	`eligibility_remarks` text,
	`next_review_date` date,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `donor_health_records_id` PRIMARY KEY(`id`),
	CONSTRAINT `donor_health_records_donor_id_unique` UNIQUE(`donor_id`)
);
--> statement-breakpoint
CREATE TABLE `donor_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`donor_id` int NOT NULL,
	`photo_url` text,
	`bio` text,
	`badges` json DEFAULT ('[]'),
	`milestones` json DEFAULT ('[]'),
	`recognition_history` json DEFAULT ('[]'),
	`emergency_availability` boolean NOT NULL DEFAULT true,
	`last_availability_confirmation` datetime DEFAULT NULL,
	`next_availability_confirmation` datetime DEFAULT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `donor_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `donor_profiles_donor_id_unique` UNIQUE(`donor_id`)
);
--> statement-breakpoint
CREATE TABLE `donor_schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`donor_id` int NOT NULL,
	`type` varchar(32) NOT NULL,
	`scheduled_date` timestamp NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'SCHEDULED',
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `donor_schedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `donors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int,
	`full_name` varchar(160) NOT NULL,
	`mobile` varchar(20) NOT NULL,
	`email` varchar(190),
	`date_of_birth` date,
	`gender` varchar(16),
	`blood_group` varchar(8) NOT NULL,
	`weight` decimal(5,2),
	`address_city` varchar(120),
	`address_district` varchar(120),
	`address_state` varchar(120),
	`pincode` varchar(10),
	`latitude` decimal(10,8),
	`longitude` decimal(11,8),
	`preferred_radius_km` int DEFAULT 10,
	`last_donation_date` date,
	`donation_type` varchar(32) DEFAULT 'WHOLE_BLOOD',
	`total_donations` int NOT NULL DEFAULT 0,
	`next_eligible_date` date,
	`availability_status` varchar(32) NOT NULL DEFAULT 'AVAILABLE',
	`emergency_notifications` boolean NOT NULL DEFAULT true,
	`preferred_contact` varchar(16) DEFAULT 'PHONE',
	`is_mobile_verified` boolean NOT NULL DEFAULT false,
	`is_profile_verified` boolean NOT NULL DEFAULT false,
	`consent_given` boolean NOT NULL DEFAULT false,
	`registration_date` timestamp NOT NULL DEFAULT (now()),
	`status` varchar(32) NOT NULL DEFAULT 'ACTIVE',
	`eligibility_status` varchar(32) NOT NULL DEFAULT 'ELIGIBLE',
	`health_status` varchar(32) NOT NULL DEFAULT 'HEALTHY',
	`activity_score` int NOT NULL DEFAULT 0,
	`profile_completion` int NOT NULL DEFAULT 0,
	`assigned_volunteer_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `donors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `follow_ups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`donor_id` int,
	`volunteer_id` int,
	`assigned_to` int,
	`type` varchar(32) NOT NULL,
	`due_date` timestamp NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'PENDING',
	`notes` text,
	`completed_at` datetime DEFAULT NULL,
	`created_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `follow_ups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `hospitals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(190) NOT NULL,
	`address` text,
	`city` varchar(120),
	`district` varchar(120),
	`pincode` varchar(10),
	`latitude` decimal(10,8),
	`longitude` decimal(11,8),
	`phone` varchar(20),
	`email` varchar(190),
	`type` varchar(64) DEFAULT 'HOSPITAL',
	`status` varchar(32) NOT NULL DEFAULT 'ACTIVE',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `hospitals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `migrations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(190) NOT NULL,
	`executed_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `migrations_id` PRIMARY KEY(`id`),
	CONSTRAINT `migrations_name_idx` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int,
	`donor_id` int,
	`type` varchar(32) NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`channel` varchar(16) DEFAULT 'IN_APP',
	`status` varchar(16) NOT NULL DEFAULT 'SENT',
	`sent_at` timestamp NOT NULL DEFAULT (now()),
	`read_at` datetime DEFAULT NULL,
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(190) NOT NULL,
	`type` varchar(64) NOT NULL DEFAULT 'NGO',
	`address` text,
	`city` varchar(120),
	`district` varchar(120),
	`contact_person` varchar(160),
	`phone` varchar(20),
	`email` varchar(190),
	`status` varchar(32) NOT NULL DEFAULT 'ACTIVE',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `otp_verifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`identifier` varchar(190) NOT NULL,
	`otp` varchar(10) NOT NULL,
	`purpose` varchar(32) NOT NULL DEFAULT 'REGISTRATION',
	`expires_at` timestamp NOT NULL,
	`verified` boolean NOT NULL DEFAULT false,
	`attempts` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `otp_verifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `request_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`request_id` int NOT NULL,
	`donor_id` int NOT NULL,
	`wave` int NOT NULL DEFAULT 1,
	`status` varchar(32) NOT NULL DEFAULT 'SENT',
	`distance_km` decimal(8,2),
	`sent_at` timestamp NOT NULL DEFAULT (now()),
	`viewed_at` datetime DEFAULT NULL,
	`responded_at` datetime DEFAULT NULL,
	CONSTRAINT `request_notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(64) NOT NULL,
	`description` text,
	`permissions` json DEFAULT ('[]'),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `roles_name_idx` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `system_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(120) NOT NULL,
	`value` json,
	`description` text,
	`category` varchar(64) DEFAULT 'GENERAL',
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `system_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `system_settings_key_idx` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `user_roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`role_id` int NOT NULL,
	CONSTRAINT `user_roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_roles_unique_idx` UNIQUE(`user_id`,`role_id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`full_name` varchar(160) NOT NULL,
	`email` varchar(190),
	`mobile` varchar(20),
	`password_hash` varchar(255) NOT NULL,
	`role_id` int,
	`status` varchar(32) NOT NULL DEFAULT 'ACTIVE',
	`is_verified` boolean NOT NULL DEFAULT false,
	`last_login` datetime DEFAULT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `volunteer_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`volunteer_id` int NOT NULL,
	`donor_id` int,
	`request_id` int,
	`assignment_type` varchar(32) NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'PENDING',
	`assigned_at` timestamp NOT NULL DEFAULT (now()),
	`completed_at` datetime DEFAULT NULL,
	CONSTRAINT `volunteer_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `volunteers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int,
	`name` varchar(160) NOT NULL,
	`mobile` varchar(20) NOT NULL,
	`email` varchar(190),
	`district` varchar(120),
	`city` varchar(120),
	`assigned_area` varchar(190),
	`availability` varchar(32) DEFAULT 'FLEXIBLE',
	`status` varchar(32) NOT NULL DEFAULT 'PENDING',
	`joining_date` timestamp NOT NULL DEFAULT (now()),
	`responsibility` text,
	`coordinator` varchar(160),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `volunteers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `blood_camps` ADD CONSTRAINT `blood_camps_organizer_id_organizations_id_fk` FOREIGN KEY (`organizer_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `blood_requests` ADD CONSTRAINT `blood_requests_requester_id_users_id_fk` FOREIGN KEY (`requester_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `blood_requests` ADD CONSTRAINT `blood_requests_hospital_id_hospitals_id_fk` FOREIGN KEY (`hospital_id`) REFERENCES `hospitals`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `camp_registrations` ADD CONSTRAINT `camp_registrations_camp_id_blood_camps_id_fk` FOREIGN KEY (`camp_id`) REFERENCES `blood_camps`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `camp_registrations` ADD CONSTRAINT `camp_registrations_donor_id_donors_id_fk` FOREIGN KEY (`donor_id`) REFERENCES `donors`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cities` ADD CONSTRAINT `cities_district_id_districts_id_fk` FOREIGN KEY (`district_id`) REFERENCES `districts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `consents` ADD CONSTRAINT `consents_donor_id_donors_id_fk` FOREIGN KEY (`donor_id`) REFERENCES `donors`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `donation_certificates` ADD CONSTRAINT `donation_certificates_donation_id_donations_id_fk` FOREIGN KEY (`donation_id`) REFERENCES `donations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `donation_certificates` ADD CONSTRAINT `donation_certificates_donor_id_donors_id_fk` FOREIGN KEY (`donor_id`) REFERENCES `donors`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `donation_certificates` ADD CONSTRAINT `donation_certificates_issued_by_users_id_fk` FOREIGN KEY (`issued_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `donations` ADD CONSTRAINT `donations_donor_id_donors_id_fk` FOREIGN KEY (`donor_id`) REFERENCES `donors`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `donations` ADD CONSTRAINT `donations_hospital_id_hospitals_id_fk` FOREIGN KEY (`hospital_id`) REFERENCES `hospitals`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `donations` ADD CONSTRAINT `donations_blood_bank_id_blood_banks_id_fk` FOREIGN KEY (`blood_bank_id`) REFERENCES `blood_banks`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `donations` ADD CONSTRAINT `donations_camp_id_blood_camps_id_fk` FOREIGN KEY (`camp_id`) REFERENCES `blood_camps`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `donations` ADD CONSTRAINT `donations_verified_by_users_id_fk` FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `donor_availability` ADD CONSTRAINT `donor_availability_donor_id_donors_id_fk` FOREIGN KEY (`donor_id`) REFERENCES `donors`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `donor_health_history` ADD CONSTRAINT `donor_health_history_donor_id_donors_id_fk` FOREIGN KEY (`donor_id`) REFERENCES `donors`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `donor_health_history` ADD CONSTRAINT `donor_health_history_health_record_id_donor_health_records_id_fk` FOREIGN KEY (`health_record_id`) REFERENCES `donor_health_records`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `donor_health_history` ADD CONSTRAINT `donor_health_history_recorded_by_users_id_fk` FOREIGN KEY (`recorded_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `donor_health_records` ADD CONSTRAINT `donor_health_records_donor_id_donors_id_fk` FOREIGN KEY (`donor_id`) REFERENCES `donors`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `donor_profiles` ADD CONSTRAINT `donor_profiles_donor_id_donors_id_fk` FOREIGN KEY (`donor_id`) REFERENCES `donors`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `donor_schedules` ADD CONSTRAINT `donor_schedules_donor_id_donors_id_fk` FOREIGN KEY (`donor_id`) REFERENCES `donors`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `donors` ADD CONSTRAINT `donors_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `follow_ups` ADD CONSTRAINT `follow_ups_donor_id_donors_id_fk` FOREIGN KEY (`donor_id`) REFERENCES `donors`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `follow_ups` ADD CONSTRAINT `follow_ups_volunteer_id_volunteers_id_fk` FOREIGN KEY (`volunteer_id`) REFERENCES `volunteers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `follow_ups` ADD CONSTRAINT `follow_ups_assigned_to_users_id_fk` FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `follow_ups` ADD CONSTRAINT `follow_ups_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_donor_id_donors_id_fk` FOREIGN KEY (`donor_id`) REFERENCES `donors`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `request_notifications` ADD CONSTRAINT `request_notifications_request_id_blood_requests_id_fk` FOREIGN KEY (`request_id`) REFERENCES `blood_requests`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `request_notifications` ADD CONSTRAINT `request_notifications_donor_id_donors_id_fk` FOREIGN KEY (`donor_id`) REFERENCES `donors`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `volunteer_assignments` ADD CONSTRAINT `volunteer_assignments_volunteer_id_volunteers_id_fk` FOREIGN KEY (`volunteer_id`) REFERENCES `volunteers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `volunteer_assignments` ADD CONSTRAINT `volunteer_assignments_donor_id_donors_id_fk` FOREIGN KEY (`donor_id`) REFERENCES `donors`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `volunteer_assignments` ADD CONSTRAINT `volunteer_assignments_request_id_blood_requests_id_fk` FOREIGN KEY (`request_id`) REFERENCES `blood_requests`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `volunteers` ADD CONSTRAINT `volunteers_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `audit_logs_user_idx` ON `audit_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_created_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `blood_banks_district_idx` ON `blood_banks` (`district`);--> statement-breakpoint
CREATE INDEX `blood_camps_district_idx` ON `blood_camps` (`district`);--> statement-breakpoint
CREATE INDEX `blood_camps_start_idx` ON `blood_camps` (`start_date`);--> statement-breakpoint
CREATE INDEX `blood_camps_status_idx` ON `blood_camps` (`status`);--> statement-breakpoint
CREATE INDEX `blood_requests_status_idx` ON `blood_requests` (`status`);--> statement-breakpoint
CREATE INDEX `blood_requests_blood_group_idx` ON `blood_requests` (`blood_group`);--> statement-breakpoint
CREATE INDEX `blood_requests_city_idx` ON `blood_requests` (`city`);--> statement-breakpoint
CREATE INDEX `blood_requests_urgency_idx` ON `blood_requests` (`urgency`);--> statement-breakpoint
CREATE INDEX `cities_district_idx` ON `cities` (`district_id`);--> statement-breakpoint
CREATE INDEX `cities_pincode_idx` ON `cities` (`pincode`);--> statement-breakpoint
CREATE INDEX `consents_donor_idx` ON `consents` (`donor_id`);--> statement-breakpoint
CREATE INDEX `donation_certificates_donor_idx` ON `donation_certificates` (`donor_id`);--> statement-breakpoint
CREATE INDEX `donation_certificates_status_idx` ON `donation_certificates` (`status`);--> statement-breakpoint
CREATE INDEX `donations_donor_idx` ON `donations` (`donor_id`);--> statement-breakpoint
CREATE INDEX `donations_date_idx` ON `donations` (`donation_date`);--> statement-breakpoint
CREATE INDEX `donations_status_idx` ON `donations` (`status`);--> statement-breakpoint
CREATE INDEX `donor_availability_donor_idx` ON `donor_availability` (`donor_id`);--> statement-breakpoint
CREATE INDEX `donor_health_history_donor_idx` ON `donor_health_history` (`donor_id`);--> statement-breakpoint
CREATE INDEX `donor_health_donor_idx` ON `donor_health_records` (`donor_id`);--> statement-breakpoint
CREATE INDEX `donor_health_status_idx` ON `donor_health_records` (`health_status`);--> statement-breakpoint
CREATE INDEX `donor_profiles_donor_idx` ON `donor_profiles` (`donor_id`);--> statement-breakpoint
CREATE INDEX `donor_schedules_donor_idx` ON `donor_schedules` (`donor_id`);--> statement-breakpoint
CREATE INDEX `donor_schedules_date_idx` ON `donor_schedules` (`scheduled_date`);--> statement-breakpoint
CREATE INDEX `donors_blood_group_idx` ON `donors` (`blood_group`);--> statement-breakpoint
CREATE INDEX `donors_city_idx` ON `donors` (`address_city`);--> statement-breakpoint
CREATE INDEX `donors_district_idx` ON `donors` (`address_district`);--> statement-breakpoint
CREATE INDEX `donors_pincode_idx` ON `donors` (`pincode`);--> statement-breakpoint
CREATE INDEX `donors_status_idx` ON `donors` (`status`);--> statement-breakpoint
CREATE INDEX `donors_availability_idx` ON `donors` (`availability_status`);--> statement-breakpoint
CREATE INDEX `donors_eligibility_idx` ON `donors` (`eligibility_status`);--> statement-breakpoint
CREATE INDEX `donors_next_eligible_idx` ON `donors` (`next_eligible_date`);--> statement-breakpoint
CREATE INDEX `donors_geo_idx` ON `donors` (`latitude`,`longitude`);--> statement-breakpoint
CREATE INDEX `follow_ups_status_idx` ON `follow_ups` (`status`);--> statement-breakpoint
CREATE INDEX `follow_ups_due_idx` ON `follow_ups` (`due_date`);--> statement-breakpoint
CREATE INDEX `hospitals_city_idx` ON `hospitals` (`city`);--> statement-breakpoint
CREATE INDEX `hospitals_district_idx` ON `hospitals` (`district`);--> statement-breakpoint
CREATE INDEX `notifications_donor_idx` ON `notifications` (`donor_id`);--> statement-breakpoint
CREATE INDEX `notifications_user_idx` ON `notifications` (`user_id`);--> statement-breakpoint
CREATE INDEX `organizations_district_idx` ON `organizations` (`district`);--> statement-breakpoint
CREATE INDEX `organizations_type_idx` ON `organizations` (`type`);--> statement-breakpoint
CREATE INDEX `otp_verifications_identifier_idx` ON `otp_verifications` (`identifier`);--> statement-breakpoint
CREATE INDEX `request_notifications_request_idx` ON `request_notifications` (`request_id`);--> statement-breakpoint
CREATE INDEX `request_notifications_donor_idx` ON `request_notifications` (`donor_id`);--> statement-breakpoint
CREATE INDEX `request_notifications_status_idx` ON `request_notifications` (`status`);--> statement-breakpoint
CREATE INDEX `users_role_idx` ON `users` (`role_id`);--> statement-breakpoint
CREATE INDEX `users_status_idx` ON `users` (`status`);--> statement-breakpoint
CREATE INDEX `volunteer_assignments_volunteer_idx` ON `volunteer_assignments` (`volunteer_id`);--> statement-breakpoint
CREATE INDEX `volunteers_district_idx` ON `volunteers` (`district`);--> statement-breakpoint
CREATE INDEX `volunteers_status_idx` ON `volunteers` (`status`);