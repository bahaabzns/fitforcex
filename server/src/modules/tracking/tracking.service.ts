import { createId } from '@paralleldrive/cuid2';
import { prisma } from '../../lib/prisma';

// A visit burst with no activity for this long counts as a new session.
export const SESSION_GAP_MS = 30 * 60 * 1000;

const SOURCE_DIRECT = 'direct';
const SOURCE_META_AD = 'Facebook/Instagram ad';
const PAID_MEDIUMS = ['cpc', 'ppc', 'paid', 'paidsocial', 'paid_social', 'ad', 'ads'];

// Hostname fragment → label shown in the admin table. First match wins.
const KNOWN_SOURCES: Array<[string, string]> = [
    ['instagram', 'Instagram'],
    ['facebook', 'Facebook'],
    ['fb.', 'Facebook'],
    ['tiktok', 'TikTok'],
    ['youtube', 'YouTube'],
    ['google', 'Google'],
    ['bing', 'Bing'],
    ['whatsapp', 'WhatsApp'],
    ['wa.me', 'WhatsApp'],
    ['t.co', 'X (Twitter)'],
    ['twitter', 'X (Twitter)'],
    ['linkedin', 'LinkedIn'],
    ['snapchat', 'Snapchat'],
    ['telegram', 'Telegram'],
];

export interface VisitInput {
    visitorId:   string;
    path:        string;
    referrer?:   string | null;
    utmSource?:  string | null;
    utmMedium?:  string | null;
    utmCampaign?: string | null;
    hasFbclid?:  boolean;
}

function labelFor(text: string): string {
    const lowered = text.toLowerCase();
    const known = KNOWN_SOURCES.find(([fragment]) => lowered.includes(fragment));
    return known ? known[1] : text;
}

function hostnameOf(url: string): string | null {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
}

// First-touch label: a paid signal beats utm_source, which beats the referrer host.
export function classifySource(input: Pick<VisitInput, 'referrer' | 'utmSource' | 'utmMedium' | 'hasFbclid'>): string {
    const medium = input.utmMedium?.toLowerCase().trim();
    const isPaid = !!medium && PAID_MEDIUMS.includes(medium);

    if (input.hasFbclid) return SOURCE_META_AD;
    if (input.utmSource) {
        const label = labelFor(input.utmSource.trim());
        return isPaid ? `${label} ad` : label;
    }
    if (input.referrer) {
        const host = hostnameOf(input.referrer);
        if (host) return labelFor(host);
    }
    return SOURCE_DIRECT;
}

async function touchSession(visitorId: string, path: string, now: Date): Promise<void> {
    const latest = await prisma.visitor_sessions.findFirst({
        where:   { visitor_id: visitorId, deleted_at: null },
        orderBy: { last_seen_at: 'desc' },
        select:  { id: true, last_seen_at: true },
    });

    if (latest && now.getTime() - latest.last_seen_at.getTime() < SESSION_GAP_MS) {
        await prisma.visitor_sessions.update({
            where: { id: latest.id },
            data:  { last_seen_at: now, page_count: { increment: 1 } },
        });
        return;
    }

    await prisma.visitor_sessions.create({
        data: { id: createId(), visitor_id: visitorId, started_at: now, last_seen_at: now, landing_path: path },
    });
}

export async function recordVisit(input: VisitInput): Promise<void> {
    const now = new Date();

    // First-touch fields are only set on create — an existing visitor's source never changes.
    await prisma.visitors.upsert({
        where:  { id: input.visitorId },
        update: { last_seen_at: now },
        create: {
            id:                 input.visitorId,
            first_seen_at:      now,
            last_seen_at:       now,
            first_referrer:     input.referrer ?? null,
            first_utm_source:   input.utmSource ?? null,
            first_utm_medium:   input.utmMedium ?? null,
            first_utm_campaign: input.utmCampaign ?? null,
            first_fbclid:       !!input.hasFbclid,
            first_landing_path: input.path,
            first_source:       classifySource(input),
        },
    });

    await touchSession(input.visitorId, input.path, now);
}

// Stamps the anonymous visitor onto the workspace created at signup. An unknown id (cleared
// cookie, forged value) is skipped silently — signup must never fail because of tracking.
export async function linkVisitorToWorkspace(workspaceId: string, visitorId: string | undefined): Promise<void> {
    if (!visitorId) return;
    const visitor = await prisma.visitors.findUnique({ where: { id: visitorId }, select: { id: true } });
    if (!visitor) return;
    await prisma.workspaces.update({ where: { id: workspaceId }, data: { visitor_id: visitor.id } });
}
