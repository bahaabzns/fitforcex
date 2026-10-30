"use client";

import { Skeleton } from "@heroui/react/skeleton";
import { Separator } from "@heroui/react/separator";
import { ScrollShadow } from "@/app/components/ScrollShadow";
import MessageRow from "@/app/components/MessageRow";
import { buildSegments, bubbleRadius, formatGroupTime } from "@/utils/messengerThread";

// Scrollable, date-grouped conversation shared by the Messenger page and the
// client-page chat bubble. `endRef` must be forwarded so the parent can scroll
// the list (its parentElement) and useMessageReply can jump to a message.
export default function MessageList({
    messages, loading, t, locale, senderNames, endRef, highlightedId,
    onEditStart, onDelete, onReply, onJumpToMessage, className = "",
}) {
    const segments = buildSegments(messages, locale, { today: t('today'), yesterday: t('yesterday') });

    return (
        <ScrollShadow hideScrollBar className={`h-full overflow-y-auto flex flex-col gap-1 ${className}`}>
            {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className={`flex mb-2 ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                        <Skeleton className="h-10 w-52 rounded-2xl" />
                    </div>
                ))
            ) : messages.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">{t('emptyChat')}</p>
                </div>
            ) : (
                segments.map((seg, si) => {
                    if (seg.type === 'date') {
                        return (
                            <div key={`date-${si}`} className="flex items-center gap-3 my-3">
                                <Separator className="flex-1" />
                                <span className="text-[11px] text-muted font-medium px-2">{seg.label}</span>
                                <Separator className="flex-1" />
                            </div>
                        );
                    }

                    const { group } = seg;
                    const isTeam = group.sender_type === 'team';
                    const count  = group.messages.length;

                    return (
                        <div key={`group-${si}`} className={`flex flex-col gap-0.5 mb-3 ${isTeam ? 'items-end' : 'items-start'}`}>
                            {group.messages.map((msg, mi) => {
                                const pos = count === 1 ? 'solo'
                                    : mi === 0 ? 'first'
                                    : mi === count - 1 ? 'last'
                                    : 'middle';
                                return (
                                    <MessageRow
                                        key={msg.id}
                                        message={msg}
                                        t={t}
                                        isOwn={isTeam}
                                        radiusClass={bubbleRadius(isTeam, pos)}
                                        canManage={isTeam && !msg.deleted_at}
                                        onEditStart={onEditStart}
                                        onDelete={onDelete}
                                        onReply={onReply}
                                        onJumpToMessage={onJumpToMessage}
                                        senderNames={senderNames}
                                        isHighlighted={highlightedId === msg.id}
                                    />
                                );
                            })}
                            {/* Single timestamp per group, shown after last message */}
                            <span className="text-[11px] text-muted-foreground mt-0.5 px-1">
                                {formatGroupTime(group.messages[group.messages.length - 1].created_at, locale)}
                            </span>
                        </div>
                    );
                })
            )}
            <div ref={endRef} />
        </ScrollShadow>
    );
}
