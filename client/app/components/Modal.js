'use client';
import { Modal } from "@heroui/react/modal";

/**
 * Standard modal footer: a right-aligned action row. Convention matching the
 * "Add Client" modal — secondary/ghost actions first, the primary submit last.
 *
 *   <ModalFooter>
 *     <Button variant="ghost" onClick={onClose}>Cancel</Button>
 *     <Button variant="primary" type="submit">Save</Button>
 *   </ModalFooter>
 */
export function ModalFooter({ children, className = "" }) {
    return (
        <div className={`flex items-center justify-end gap-2 pt-1 ${className}`}>
            {children}
        </div>
    );
}

export default function AppModal({ open, onClose, title, children, footer, wide, size, dialogClassName }) {
    // Width is controlled on Modal.Dialog (the Container is sm:w-fit; the Dialog carries max-w).
    // dialogClassName overrides the size-based default when a custom width is needed.
    // size="cover" is HeroUI's own Modal.Container variant (width/height:100% of the
    // container's padded area) — forwarded there instead of mapped to a max-w-* class,
    // since a max-width on the Dialog would cap the 100% width cover is meant to give.
    const isCover = size === "cover";
    const dialogClass = dialogClassName || (size === "xl" ? "max-w-4xl" : wide ? "max-w-2xl" : "max-w-lg");
    return (
        <Modal isOpen={open} onOpenChange={(o) => !o && onClose()}>
            <Modal.Backdrop
                shouldCloseOnInteractOutside={(element) =>
                    // A Popover/Tooltip triggered from inside this modal (e.g.
                    // NewFeatureTooltip, InfoTooltip) portals to its own separate
                    // DOM branch, which React Aria doesn't recognize as "inside"
                    // the modal. Without this, clicking its content — e.g. a
                    // "Got it" dismiss button — reads as an outside interaction
                    // and closes the whole modal along with it.
                    !element.closest(".popover, .tooltip")
                }
            >
                <Modal.Container size={isCover ? "cover" : undefined}>
                    <Modal.Dialog className={isCover ? dialogClassName : dialogClass}>
                        <Modal.Header>
                            <Modal.Heading>{title}</Modal.Heading>
                            <Modal.CloseTrigger />
                        </Modal.Header>
                        <Modal.Body>{children}</Modal.Body>
                        {/* A sibling of Modal.Body, not nested inside it — HeroUI's own scroll-inside
                            behavior only scrolls Body, so content passed here (pagination, action
                            buttons) stays pinned in view no matter how tall Body's content gets. */}
                        {footer && <Modal.Footer>{footer}</Modal.Footer>}
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}
