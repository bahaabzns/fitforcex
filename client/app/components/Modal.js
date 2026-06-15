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

export default function AppModal({ open, onClose, title, children, wide, size, dialogClassName }) {
    // Width is controlled on Modal.Dialog (the Container is sm:w-fit; the Dialog carries max-w).
    // dialogClassName overrides the size-based default when a custom width is needed.
    const dialogClass = dialogClassName || (size === "xl" ? "max-w-4xl" : wide ? "max-w-2xl" : "max-w-lg");
    return (
        <Modal isOpen={open} onOpenChange={(o) => !o && onClose()}>
            <Modal.Backdrop>
                <Modal.Container>
                    <Modal.Dialog className={dialogClass}>
                        <Modal.Header>
                            <Modal.Heading>{title}</Modal.Heading>
                            <Modal.CloseTrigger />
                        </Modal.Header>
                        <Modal.Body>{children}</Modal.Body>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}
