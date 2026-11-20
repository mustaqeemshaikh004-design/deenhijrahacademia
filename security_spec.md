# Security Architecture Specification — Deen Hijrah Academia

**Project:** Stalwart Meridian (`stalwart-meridian-vsmzh`)  
**Firestore Database:** `ai-studio-deenhijrahacadem-fb3a5267-74eb-48df-a120-945c654aed86`  
**Firebase Storage Bucket:** `stalwart-meridian-vsmzh.firebasestorage.app`  
**Designated Administrator:** Mustaqeem (`mustaqeemshaikh004@gmail.com`)

---

## 1. Data Invariants (Eight Pillars of Zero-Trust ABAC)

1. **Master Source of Truth (Enrollment Master Gate):**
   - Private `.mp4` recording metadata (`/courses/{courseId}/recordings/{recordingId}`) and stream authorizations (`/courses/{courseId}/streamRequests/{requestId}`) derive access strictly from the student's active enrollment subcollection document `/courses/{courseId}/enrollments/{userId}` where `status in ['active', 'completed']`.
   - Revoking enrollment (`status == 'revoked'`) results in immediate, synchronous loss of access to all private recordings and stream requests for that course.
2. **Non-Downloadable & Non-Shareable MP4 Streaming Invariant:**
   - Every `/courses/{courseId}/recordings/{recordingId}` and `/courses/{courseId}/streamRequests/{requestId}` document MUST enforce `mimeType == 'video/mp4'` and `nonDownloadable == true`.
   - Recording documents MUST enforce `nonShareable == true` and constrain `storagePath` to `^courses/{courseId}/recordings/.*\.mp4$`.
   - Firebase Storage (`courses/{courseId}/recordings/*`) blocks `list` (`allow list: if false`) and requires `nonDownloadable == 'true'`, `nonShareable == 'true'`, and verified auth (`request.auth.token.email_verified == true`) on `get`.
3. **PII & Preference Isolation (Split Collection Strategy):**
   - User documents are strictly split into `/users/{userId}` (role state, no PII), `/users/{userId}/public/profile` (display name, gender, optional Firebase Storage `avatarUrl` / `avatarStoragePath` scoped to `^avatars/{userId}/.*$`), `/users/{userId}/private/info` (`email` — strictly readable only by `request.auth.uid == userId` or verified admin, with `allow list: if false`), and `/users/{userId}/preferences/{prefId}` (`prefId == 'ui'`, storing `theme in ['dark', 'light']` — owner-only writes guarded by parent `/users/{userId}` Master Gate and `allow list: if false`).
4. **Privilege & Email Verification Anti-Spoofing:**
   - Administrative privilege checks (`isBootstrapChancellor()` / `isAdmin()`) MUST require `request.auth.token.email_verified == true` and verify against `/admins/{request.auth.uid}` or the verified bootstrap administrator email.
   - Standard user sign-ups cannot assign themselves `'admin'` or `'teacher'` roles in `/users/{userId}`.
5. **Anti-Update-Gap & Strict Schema Validation:**
   - Every `create` and `update` invokes a dedicated `isValid<Entity>()` blueprint validator enforcing `keys().hasAll(...)`, `keys().hasOnly(...)`, type safety, verbatim `firebase-blueprint.json` `maxLength` & `pattern` guards, immutable IDs/creators/timestamps, and strict `request.time` equality.
6. **List Query Cost Optimization & Anti-Scraping:**
   - No `allow list` block calls `get()` or `exists()`. Safe lecture catalog titles live in `/courses/{courseId}/recordingCatalog/{recordingId}` without `storagePath` or `videoUrl`; `/courses/{courseId}/recordings` allows `list` only where `resource.data.isOrientation == true && resource.data.nonDownloadable == true`.
   - Public catalog list queries (`/courses`, `/events`, `/blogPosts`) strictly evaluate `resource.data.isPublished == true`; public community/chat list queries (`/communityPosts`, `/chatMessages`) strictly evaluate `resource.data.flagged == false`.
7. **Atomic Interaction State (`/communityPosts/{postId}/likes/{userId}`):**
   - Liking or unliking a post requires an atomic `writeBatch` verified via `existsAfter(...)` and `getAfter(...)` on both the parent `/communityPosts/{postId}` (`likes` +1/-1) and `/likes/{userId}` receipt, preventing arbitrary like-count inflation or orphaned like documents.
8. **Admin-Gated Editorial & Platform Branding (`/blogPosts`, `/events`, `/settings/platform`):**
   - Only verified admins may create/update/delete scholastic articles, campus poster-board events, or hero/navbar configuration.

---

## 2. The "Dirty Dozen" Adversarial Payloads

All 12 payloads below MUST evaluate to `PERMISSION_DENIED`:

1. **Identity Spoofing on Stream Request (Fake Requester UID):**
   - Actor: `student-alice` (`email_verified: true`)
   - Path: `/courses/course-seerah-101/streamRequests/req-spoof-1`
   - Payload:
     ```json
     {
       "id": "req-spoof-1",
       "courseId": "course-seerah-101",
       "recordingId": "rec-private-1",
       "userId": "student-bob-enrolled",
       "storagePath": "courses/course-seerah-101/recordings/rec-private-1.mp4",
       "mimeType": "video/mp4",
       "nonDownloadable": true,
       "accessType": "enrolled_stream",
       "requestedAt": "SERVER_TIMESTAMP"
     }
     ```
2. **Self-Assigned Admin Role Escalation:**
   - Actor: `student-mallory` (`email_verified: true`)
   - Path: `/users/student-mallory`
   - Payload:
     ```json
     {
       "id": "student-mallory",
       "role": "admin",
       "createdAt": "SERVER_TIMESTAMP",
       "updatedAt": "SERVER_TIMESTAMP"
     }
     ```
3. **Unverified Admin Email Spoofing:**
   - Actor: `attacker` (`email: "mustaqeemshaikh004@gmail.com"`, `email_verified: false`)
   - Path: `/courses/course-spoofed`
   - Payload:
     ```json
     {
       "id": "course-spoofed",
       "code": "DHA-HACK",
       "title": "Spoofed Course",
       "description": "Unauthorized creation with unverified email token",
       "instructorId": "attacker",
       "instructorName": "Attacker",
       "status": "Active",
       "level": "Beginner",
       "thumbnail": "",
       "totalLectures": 1,
       "isPublished": true,
       "createdAt": "SERVER_TIMESTAMP",
       "updatedAt": "SERVER_TIMESTAMP"
     }
     ```
4. **Shadow Field Injection ("Ghost Key" Update on Public Profile):**
   - Actor: `student-alice` (`email_verified: true`)
   - Path: `/users/student-alice/public/profile` (`update`)
   - Payload:
     ```json
     {
       "id": "student-alice",
       "firstName": "Alice",
       "lastName": "Khan",
       "gender": "female",
       "visibility": "public",
       "isAdmin": true,
       "createdAt": "EXISTING_TIMESTAMP",
       "updatedAt": "SERVER_TIMESTAMP"
     }
     ```
5. **Non-Enrolled Private MP4 Recording Fetch & Stream Attempt:**
   - Actor: `student-unenrolled` (`email_verified: true`, NO enrollment doc under `course-seerah-101`)
   - Path: `/courses/course-seerah-101/streamRequests/req-unauth-stream`
   - Payload:
     ```json
     {
       "id": "req-unauth-stream",
       "courseId": "course-seerah-101",
       "recordingId": "rec-private-1",
       "userId": "student-unenrolled",
       "storagePath": "courses/course-seerah-101/recordings/rec-private-1.mp4",
       "mimeType": "video/mp4",
       "nonDownloadable": true,
       "accessType": "enrolled_stream",
       "requestedAt": "SERVER_TIMESTAMP"
     }
     ```
6. **Non-Downloadable Bypass Flag Tampering (`nonDownloadable: false`):**
   - Actor: `student-enrolled` (`email_verified: true`, active enrollment)
   - Path: `/courses/course-seerah-101/streamRequests/req-download-bypass`
   - Payload:
     ```json
     {
       "id": "req-download-bypass",
       "courseId": "course-seerah-101",
       "recordingId": "rec-private-1",
       "userId": "student-enrolled",
       "storagePath": "courses/course-seerah-101/recordings/rec-private-1.mp4",
       "mimeType": "video/mp4",
       "nonDownloadable": false,
       "accessType": "enrolled_stream",
       "requestedAt": "SERVER_TIMESTAMP"
     }
     ```
7. **Storage Path Substitution Attack (Substituting Private MP4 for Orientation Request):**
   - Actor: `student-unenrolled` (`email_verified: true`)
   - Path: `/courses/course-seerah-101/streamRequests/req-path-swap`
   - Payload:
     ```json
     {
       "id": "req-path-swap",
       "courseId": "course-seerah-101",
       "recordingId": "rec-orientation-1",
       "userId": "student-unenrolled",
       "storagePath": "courses/course-seerah-101/recordings/rec-private-1.mp4",
       "mimeType": "video/mp4",
       "nonDownloadable": true,
       "accessType": "orientation_preview",
       "requestedAt": "SERVER_TIMESTAMP"
     }
     ```
8. **Revoked Enrollment Terminal-State Reversal:**
   - Actor: `student-revoked` (`email_verified: true`, existing enrollment `status: "revoked"`)
   - Path: `/courses/course-seerah-101/enrollments/student-revoked` (`update`)
   - Payload:
     ```json
     {
       "userId": "student-revoked",
       "courseId": "course-seerah-101",
       "status": "active",
       "enrolledAt": "EXISTING_TIMESTAMP",
       "updatedAt": "SERVER_TIMESTAMP"
     }
     ```
9. **ID Poisoning & Regex Bypass Attack:**
   - Actor: `admin-mustaqeem` (`email: "mustaqeemshaikh004@gmail.com"`, `email_verified: true`)
   - Path: `/courses/bad$id..traversal`
   - Payload:
     ```json
     {
       "id": "bad$id..traversal",
       "code": "DHA-01",
       "title": "Poisoned ID",
       "description": "Malformed path variable test",
       "instructorId": "admin-mustaqeem",
       "instructorName": "Mustaqeem",
       "status": "Active",
       "level": "Beginner",
       "thumbnail": "",
       "totalLectures": 5,
       "isPublished": true,
       "createdAt": "SERVER_TIMESTAMP",
       "updatedAt": "SERVER_TIMESTAMP"
     }
     ```
10. **PII Blanket Read Attempt (Reading Another Student's Private Email):**
    - Actor: `student-alice` (`email_verified: true`)
    - Operation: `get` on `/users/student-bob/private/info` (and `list` on `/users/student-bob/private`)
11. **Avatar Cross-User Storage Path Traversal:**
    - Actor: `student-alice` (`email_verified: true`)
    - Path: `/users/student-alice/public/profile` (`update`)
    - Payload:
      ```json
      {
        "id": "student-alice",
        "firstName": "Alice",
        "lastName": "Khan",
        "gender": "female",
        "avatarStoragePath": "courses/course-seerah-101/recordings/rec-private-1.mp4",
        "visibility": "public",
        "createdAt": "EXISTING_TIMESTAMP",
        "updatedAt": "SERVER_TIMESTAMP"
      }
      ```
12. **Client Timestamp Manipulation & Oversized Payload Poisoning:**
    - Actor: `student-alice` (`email_verified: true`)
    - Path: `/communityPosts/post-poison` (`create`)
    - Payload:
      ```json
      {
        "id": "post-poison",
        "authorId": "student-alice",
        "authorName": "Alice",
        "authorRole": "student",
        "authorGender": "female",
        "content": "<5001+ characters string>",
        "category": "announcement",
        "pinned": true,
        "flagged": false,
        "likes": 999999,
        "createdAt": "2020-01-01T00:00:00Z",
        "updatedAt": "2020-01-01T00:00:00Z"
      }
      ```
13. **Cross-User Preference Tampering, Enum Poisoning & Unbounded Notification Array (`/users/{userId}/preferences/ui`):**
    - Actor: `student-alice` (`email_verified: true`) attempting to read/overwrite `student-bob`'s `/users/student-bob/preferences/ui`, OR writing `{ "theme": "neon", "isAdmin": true }` or an oversized/non-string `readNotificationIds` array (> 100 entries) to her own `/users/student-alice/preferences/ui`.
    - Pass Criteria: Cross-user preference reads/writes, list queries, invalid `theme` enum values, unbounded or non-string `readNotificationIds` arrays, and shadow fields are all rejected with `PERMISSION_DENIED`.
14. **Course & Instructor Review Integrity, Author Spoofing & Rating Bounds (`/courseReviews/{reviewId}`, `/instructorReviews/{reviewId}`):**
    - Actor: `student-alice` (`email_verified: true`) attempting to submit `rating: 6` (or `0`), forge `authorId: "student-bob"`, use a non-deterministic duplicate ID bypassing `<targetId>_<uid>`, overwrite/delete `student-bob`'s existing review, or inject shadow fields.
    - Pass Criteria: Published reviews (`isPublished == true`) are publicly readable (`get`/`list`), while creates/updates/deletes strictly bind `authorId == request.auth.uid`, deterministic single-review-per-user IDs, integer/bounded ratings `1..5`, bounded comment length `1..1500`, and `request.time` timestamps.

