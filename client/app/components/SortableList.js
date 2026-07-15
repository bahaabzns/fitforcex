"use client";

import { useId } from "react";
import {
    DndContext,
    closestCenter,
    MouseSensor,
    TouchSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import {
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
    horizontalListSortingStrategy,
    rectSortingStrategy,
    arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export { arrayMove, horizontalListSortingStrategy, rectSortingStrategy, verticalListSortingStrategy };

// Long-press to drag on touch (matches native mobile UX); a small move
// threshold on mouse so plain clicks don't get mistaken for a drag start.
export function useReorderSensors() {
    return useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    );
}

/**
 * Wraps a reorderable list with dnd-kit's DndContext + SortableContext.
 * `items` must be objects with a stable `id` (or pass `getId`).
 * `onReorder(fromIndex, toIndex)` is called with the same splice semantics
 * the existing handleReorder* callbacks already expect.
 */
export function SortableList({
    items,
    getId = (item) => item.id,
    onReorder,
    strategy = verticalListSortingStrategy,
    children,
}) {
    const sensors = useReorderSensors();
    const ids = items.map(getId);
    // Explicit id (dnd-kit's own SSR guidance) — its default falls back to a
    // module-level mount counter, which drifts between server and client
    // render whenever more than one DndContext exists on the page.
    const dndContextId = useId();

    function handleDragEnd(event) {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const fromIndex = ids.indexOf(active.id);
        const toIndex = ids.indexOf(over.id);
        if (fromIndex === -1 || toIndex === -1) return;
        onReorder(fromIndex, toIndex);
    }

    return (
        <DndContext id={dndContextId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={ids} strategy={strategy}>
                {items.map((item, index) => children(item, index))}
            </SortableContext>
        </DndContext>
    );
}

/**
 * Renders one sortable row. `children` is a render function receiving the
 * props to spread on the draggable element: `setNodeRef`, `style`,
 * `attributes`, `listeners`, and `isDragging`.
 */
export function SortableItem({ id, children }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };
    return children({ setNodeRef, style, attributes, listeners, isDragging });
}
