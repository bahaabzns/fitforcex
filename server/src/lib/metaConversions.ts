import crypto from 'crypto';
import { env } from '../config/env';

/**
 * Meta Conversions API — server-side mirror of the client pixel. Best-effort,
 * like recordEvent() in lib/events.ts: a failure here is logged but never
 * propagated, so a Meta outage or bad credential can never break registration
 * or payment confirmation. No-ops entirely when the pixel isn't configured.
 */

const GRAPH_API_VERSION = 'v21.0';

type ActionSource = 'website' | 'system_generated';

export type MetaEventParams = {
    eventName:      string;
    eventId:        string;
    actionSource:   ActionSource;
    eventSourceUrl?: string;
    email?:          string | null;
    phone?:          string | null;
    ip?:             string | null;
    userAgent?:      string | null;
    customData?:     Record<string, unknown>;
};

function hashForMeta(value: string): string {
    return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

export async function sendMetaEvent(params: MetaEventParams): Promise<void> {
    if (!env.META_PIXEL_ID || !env.META_CONVERSIONS_API_TOKEN) return;

    try {
        const userData: Record<string, unknown> = {};
        if (params.email) userData.em = [hashForMeta(params.email)];
        if (params.phone) userData.ph = [hashForMeta(params.phone.replace(/[^\d]/g, ''))];
        if (params.ip) userData.client_ip_address = params.ip;
        if (params.userAgent) userData.client_user_agent = params.userAgent;

        const body = {
            data: [{
                event_name:       params.eventName,
                event_time:       Math.floor(Date.now() / 1000),
                event_id:         params.eventId,
                action_source:    params.actionSource,
                event_source_url: params.eventSourceUrl,
                user_data:        userData,
                custom_data:      params.customData,
            }],
            ...(env.META_TEST_EVENT_CODE ? { test_event_code: env.META_TEST_EVENT_CODE } : {}),
        };

        const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${env.META_PIXEL_ID}/events?access_token=${env.META_CONVERSIONS_API_TOKEN}`;
        const response = await fetch(url, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(body),
            signal:  AbortSignal.timeout(10000),
        });

        if (!response.ok) {
            console.error('[MetaConversions] API rejected event', params.eventName, await response.text());
        }
    } catch (err) {
        console.error('[MetaConversions] Failed to send event', params.eventName, (err as Error).message);
    }
}
