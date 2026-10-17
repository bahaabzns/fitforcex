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
 *
 * On pages that opt into the phone bottom sheet (useSheetUi) the footer pins to
 * the bottom of the scrolling sheet so the actions are always reachable.
 */
export function ModalFooter({ children, className = "" }) {
    return (
        <div className={`modal-sticky-footer flex items-center justify-end gap-2 pt-1 ${className}`}>
            {children}
        </div>
    );
}

export default function AppModal({ open, onClose, title, children, footer, wide, size, dialogClassName, sheetOnMobile = false }) {
    // Width is controlled on Modal.Dialog (the Container is sm:w-fit; the Dialog carries max-w).
    // dialogClassName overrides the size-based default when a custom width is needed.
    // size="cover" is HeroUI's own Modal.Container variant (width/height:100% of the
    // container's padded area) — forwarded there instead of mapped to a max-w-* class,
    // since a max-width on the Dialog would cap the 100% width cover is meant to give.
    const isCover = size === "cover";
    const dialogClass = dialogClassName || (size === "xl" ? "max-w-4xl" : wide ? "max-w-2xl" : "max-w-lg");
    // sheetOnMobile: below `sm` the dialog becomes a bottom sheet — container
    // flush to the screen edges, dialog docked to the bottom with only its top
    // corners rounded and capped to the visible height. From `sm` up it is the
    // usual centred dialog.
    const sheetContainerClass = sheetOnMobile ? "max-sm:p-0" : undefined;
    const sheetDialogClass = sheetOnMobile ? "max-sm:rounded-b-none max-sm:max-h-[90svh] max-sm:pb-[max(1.5rem,env(safe-area-inset-bottom))]" : "";
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
                <Modal.Container size={isCover ? "cover" : undefined} placement={sheetOnMobile ? "bottom" : undefined} className={sheetContainerClass}>
                    <Modal.Dialog className={`${isCover ? dialogClassName ?? "" : dialogClass} ${sheetDialogClass}`.trim()}>
                        {sheetOnMobile && <div aria-hidden="true" className="sm:hidden mx-auto -mt-3 mb-3 h-1 w-9 rounded-full bg-border" />}
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
