# Phase 9: Real-Time & File Handling — Deep Review

**Date:** 2026-07-14
**Scope:** Socket.IO, events, S3 uploads, attachments
**Score: GOOD** (3.5/5) — Solid realtime with durable notifications, but socket auth lacks session validation

---

## 1. SOCKET.IO — Score: **Good**

### 1.1 Setup (socket.ts, 64 lines)

- JWT auth on connect (cookie + Bearer + handshake)
- Room joining: `workspace:`, `client:`, `user:`
- CORS reuses `isAllowedOrigin`

### 1.2 Room Strategy

| Room | Purpose | Joined By |
|------|---------|-----------|
| `workspace:{id}` | Workspace-wide broadcasts | Coach users |
| `client:{id}` | Client-specific events | Client portal users |
| `user:{id}` | User-specific notifications | Coach users |

**Quality:** Clean room strategy. Each user joins their own room for targeted notifications.

### 1.3 Issues

| # | Issue | Severity |
|---|-------|----------|
| 1 | **No session DB validation on socket auth** | MEDIUM |
| 2 | **No rate limiting on socket connections** | LOW |
| 3 | **No socket disconnect cleanup** | LOW |

---

## 2. DURABLE NOTIFICATIONS — Score: **Excellent**

### 2.1 recordEvent (events.ts)

```
DomainEvent → notifications.createMany → Socket.IO emit
```

**Excellent:**
- DB persistence + realtime fanout
- Best-effort (failures logged, not propagated)
- Supports multiple recipients per event
- Legacy realtime emit preserved

### 2.2 Event Types

| Event | Trigger |
|-------|---------|
| `message.received` | New message in thread |
| `subscription.expired` | Client subscription expired |
| `subscription.frozen` | Client subscription paused |
| `subscription.reactivated` | Client subscription reactivated |
| `plan.review_due` | Plan approaching end date |
| `checkin.requested` | Check-in form dispatched |
| `checkin.dispatch_skipped_archived_form` | Check-in skipped (archived form) |

---

## 3. FILE HANDLING — Score: **Very Good**

### 3.1 S3/R2 Uploads (storage.ts, 84 lines)

```typescript
export const upload = multer({
    storage: multerS3({
        s3: s3Client,
        bucket: env.S3_BUCKET,
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: (req, file, cb) => cb(null, `${folder}/${uuid}-${sanitized}`),
    }),
});
```

**Quality:**
- Configurable S3/R2 endpoint
- UUID-prefixed keys
- Content type auto-detection
- File size limits

### 3.2 Attachment Types

| Module | Upload Path | Allowed Types |
|--------|-------------|---------------|
| Messenger | `messenger/{workspaceId}/` | Images, audio, files |
| Forms | `forms/{workspaceId}/` | Images, PDFs |
| Observations | `observations/{workspaceId}/` | Images |

### 3.3 Presigned URLs

```typescript
export async function toPublicUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({ Bucket, Key });
    return getSignedUrl(s3Client, command, { expiresIn: 3600 });
}
```

**Good:** 1-hour expiry for presigned URLs.

---

## 4. ISSUES

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| 1 | **Socket auth lacks session DB validation** | MEDIUM | Add session check |
| 2 | **No socket rate limiting** | LOW | Add connection rate limit |
| 3 | **No file type validation at controller level** | LOW | Add MIME type checks |

---

## 5. WHAT'S WELL DONE

1. **Durable notifications** — DB + realtime, best-effort.
2. **Room strategy** — Clean workspace/client/user rooms.
3. **S3 uploads** — UUID keys, content type auto-detection.
4. **Presigned URLs** — 1-hour expiry.
5. **Attachment handling** — Separate handlers for messenger/forms/observations.

---

*Report generated: 2026-07-14 | Next: Phase 10 — Scheduling & Cron Jobs*
