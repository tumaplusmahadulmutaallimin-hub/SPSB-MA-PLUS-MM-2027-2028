# Firestore Security Specification — Portal Digital Terpadu MA PLUS MM

## 1. Data Invariants
1. **Default-Deny Catch-All**: All unspecified Firestore paths (`/{document=**}`) deny read and write access (`false`).
2. **Admin Authorization**: Administrative writes across `site_settings`, `qr_settings`, `categories`, `links`, `announcements`, `registrations`, `documents`, `committee_contacts`, `madrasah_achievements`, and `student_achievements` verification require `request.auth != null`, `request.auth.token.email_verified == true`, and either bootstrapped admin email `tumaplusmahadulmutaallimin@gmail.com` or an `/admins/{uid}` record.
3. **Public Read Filtering**: Public portal visitors can only read active/published records (`isActive == true`, `status == 'published'`, `isAvailable == true`, or `settingId == 'default'`). Draft/hidden records are readable only by `isAdmin()`.
4. **PII Isolation**: `student_achievements` (contains `studentName`, `registrationNumberOrNisn`, `certificateUrl`), `portal_sessions`, `portal_visits`, `portal_events`, and `portal_users` forbid public `get` and `list`; only `isAdmin()` may read, list, or delete monitoring and user directory records. Public `create` on `student_achievements` is strictly restricted to `status == 'pending'`, and public telemetry `create`/`update` strictly enforces `actorType == 'anonymous'`, schema size caps, immutable session ownership (`visitorId`), and server timestamps (`request.time`).
5. **Temporal Integrity & Immutability**: Every created document enforces `createdAt == request.time` and `updatedAt == request.time`; updates enforce `createdAt == existing().createdAt` and `updatedAt == request.time`, and validate path IDs with `isValidId()` (`^[a-zA-Z0-9_\\-]+$`, max 128 chars).

## 2. The "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated Write to `site_settings/default`**: Anonymous write without `request.auth`.
2. **Unverified Email Admin Spoof**: `request.auth.token.email == 'tumaplusmahadulmutaallimin@gmail.com'` with `email_verified == false`.
3. **Shadow Ghost Field on `links`**: Admin-like payload containing unexpected extra field `adminOverride: true`.
4. **Value Poisoning on `links`**: Setting `clicksCount` to a string or `targetUrl` exceeding `1000` characters.
5. **ID Poisoning on `categories`**: Path ID containing 500 characters or invalid characters (`../bad`).
6. **Public Read of Draft Announcement**: Unauthenticated `get` on `announcements` where `status == 'draft'`.
7. **Public Read/List of `student_achievements` & `portal_sessions`**: Unauthenticated `get` or `list` attempting to scrape student NISN or visitor session records.
8. **Student Achievement Status Shortcutting**: Public `create` on `student_achievements` setting `status: 'verified'` instead of `'pending'`.
9. **Anonymous Identity Spoofing in `portal_events` / `portal_sessions`**: Unauthenticated write claiming `actorType: 'authenticated'` or `eventType: 'ADMIN_ACTION'`.
10. **Missing Server Timestamp on Create**: Creating a `category` or `portal_visit` with a client-supplied string for `createdAt` instead of `request.time`.
11. **Self-Assigned Admin Escalation**: Non-admin authenticated user writing `/admins/{uid}` with `role: 'super_admin'` or `/portal_users/{id}`.
12. **Hidden Document Scraping**: Public `list` query requesting `documents` where `isActive == false`.

