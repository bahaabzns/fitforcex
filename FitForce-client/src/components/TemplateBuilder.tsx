'use client';

import { useEffect, useRef, useState } from 'react';
import fabric from 'fabric';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
// Using Box layout instead of Grid to avoid version/type issues
import Divider from '@mui/material/Divider';
import FileUpload from 'components/FileUpload';
import Alert from '@mui/material/Alert';

type BuilderProps = {
	open: boolean;
	onClose: () => void;
	value: any | null; // current schema JSON
	onSave: (schema: any) => void;
  pageWidth?: number;
  pageHeight?: number;
  workspaceId?: string;
  kind?: 'workout' | 'nutrition';
};

/**
 * Minimal Fabric.js based PDF template builder.
 * - Supports adding Text and Image elements
 * - Edit properties in inspector
 * - Import existing schema and export back
 */
export default function TemplateBuilder({ open, onClose, value, onSave, pageWidth = 595, pageHeight = 842, workspaceId, kind = 'workout' }: BuilderProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const fabricNS = fabric as any;
    const fabricRef = useRef<any | null>(null);
    const [selected, setSelected] = useState<any | null>(null);
	const [imageUrl, setImageUrl] = useState('');
	const [uploadKey, setUploadKey] = useState(0);
	const [addingImg, setAddingImg] = useState(false);
	const [imgError, setImgError] = useState<string | null>(null);
    const [pages, setPages] = useState<number>(0);
    const [activePage, setActivePage] = useState<number>(0);
    const [pagesDef, setPagesDef] = useState<Array<{ page: { width: number; height: number }; elements: any[]; repeat?: { enabled: boolean; itemsPerPage: number } }>>([]);
	const [tick, setTick] = useState(0);
    // Dynamic repeat-per-item (workout): if enabled, export current page as repeatPerItem instead of static page
    const [repeatEnabled, setRepeatEnabled] = useState(false);
    const [repeatItemsPerPage, setRepeatItemsPerPage] = useState(1);
    const [zoom, setZoom] = useState(1);
    const [showGrid, setShowGrid] = useState(false);
    const [snapToGrid, setSnapToGrid] = useState(false);
    const gridSize = 10;

	// initialize/destroy canvas
	useEffect(() => {
		if (!open) return;
		if (!canvasRef.current) return;
        const c = new fabricNS.Canvas(canvasRef.current, {
			selection: true,
			preserveObjectStacking: true
		});
		fabricRef.current = c;
		c.setWidth(pageWidth);
		c.setHeight(pageHeight);

        const onSelection = () => {
            const active = c.getActiveObject();
            setSelected(active || null);
        };
		c.on('selection:created', onSelection);
		c.on('selection:updated', onSelection);
		c.on('selection:cleared', () => setSelected(null));
        // ensure group selection when clicking inside placeholder
        c.on('mouse:down', (opt: any) => {
            const t = opt?.target;
            if (t && t.type !== 'group' && (t as any).group) {
                c.setActiveObject((t as any).group);
                setSelected((t as any).group);
            }
        });
        c.on('object:moving', () => { setTick((v) => v + 1); });
        c.on('object:moving', (opt: any) => {
            if (snapToGrid && opt?.target) {
                const t = opt.target as any;
                t.left = Math.round((t.left || 0) / gridSize) * gridSize;
                t.top = Math.round((t.top || 0) / gridSize) * gridSize;
            }
        });
		c.on('object:modified', () => { setTick((v) => v + 1); });
		c.on('mouse:dblclick', (opt: any) => {
			const target = opt?.target;
			if (target && target.type === 'i-text' && typeof target.enterEditing === 'function') {
				target.enterEditing();
				target.hiddenTextarea && target.hiddenTextarea.focus();
			}
		});

		// Import schema if provided (supports legacy single-page and multi-page)
        if (value && (value as any).repeatPerItem) {
            // if loading a repeat template, just load its elements into canvas and enable repeat
            const rpt = (value as any).repeatPerItem;
            setRepeatEnabled(true);
            setRepeatItemsPerPage(Math.max(1, rpt.itemsPerPage ?? 1));
            setPagesDef([{ page: { width: rpt.page.width, height: rpt.page.height }, elements: rpt.elements || [], repeat: { enabled: true, itemsPerPage: Math.max(1, rpt.itemsPerPage ?? 1) } }]);
            setPages(1);
            setActivePage(0);
            try {
                c.clear();
                c.setWidth(rpt.page.width || pageWidth);
                c.setHeight(rpt.page.height || pageHeight);
                for (const el of (rpt.elements as any[]) || []) {
                    if (el.type === 'text') {
                        const t = new fabricNS.IText(el.text || '', { left: el.x, top: el.y, fontSize: el.fontSize || 12, fill: 'black' });
                        c.add(t);
                    } else if (el.type === 'image' && el.src) {
                        fabricNS.Image.fromURL(el.src, (img: any) => { img.set({ left: el.x, top: el.y }); if (el.width && img.width) img.set({ scaleX: el.width / img.width }); if (el.height && img.height) img.set({ scaleY: el.height / img.height }); c.add(img); });
                    }
                }
                c.renderAll();
            } catch {}
        } else if (value && Array.isArray(value.pages) && value.pages.length > 0) {
			setPages(value.pages.length);
			setActivePage(0);
            setPagesDef(value.pages.map((p: any) => ({ page: { width: p.page.width, height: p.page.height }, elements: p.elements || [], repeat: { enabled: false, itemsPerPage: 1 } })));
            const first = value.pages[0];
			try {
				c.clear();
				c.setWidth(first.page.width || pageWidth);
				c.setHeight(first.page.height || pageHeight);
				for (const el of first.elements as any[]) {
					if (el.type === 'text') {
						const t = new fabricNS.IText(el.text || '', {
							left: el.x,
							top: el.y,
							fontSize: el.fontSize || 12,
							fill: 'black'
						});
						c.add(t);
					} else if (el.type === 'image' && el.src) {
						fabricNS.Image.fromURL(el.src, (img: any) => {
							img.set({ left: el.x, top: el.y });
							if (el.width && img.width) img.set({ scaleX: el.width / img.width });
							if (el.height && img.height) img.set({ scaleY: el.height / img.height });
							c.add(img);
						});
					}
				}
				c.renderAll();
			} catch {}
        } else if (value && value.page && Array.isArray(value.elements)) {
			try {
				c.clear();
				c.setWidth(value.page.width || pageWidth);
				c.setHeight(value.page.height || pageHeight);
                setPagesDef([{ page: { width: value.page.width, height: value.page.height }, elements: value.elements || [], repeat: { enabled: false, itemsPerPage: 1 } }]);
                setPages(1);
                setActivePage(0);
                for (const el of value.elements as any[]) {
					if (el.type === 'text') {
						const t = new fabricNS.IText(el.text || '', {
							left: el.x,
							top: el.y,
							fontSize: el.fontSize || 12,
							fill: 'black'
						});
						c.add(t);
                    } else if (el.type === 'image' && el.src) {
                        fabricNS.Image.fromURL(
                            el.src,
                            (img: any) => {
                                // if schema has width/height, apply via scale to preserve aspect ratio
                                if (el.width && img.width) {
                                    img.set({ scaleX: el.width / img.width });
                                }
                                if (el.height && img.height) {
                                    img.set({ scaleY: el.height / img.height });
                                }
                                img.set({ left: el.x, top: el.y, selectable: true, evented: true });
                                c.add(img);
                                c.requestRenderAll();
                            },
                            { crossOrigin: 'anonymous' }
                        );
					}
				}
				c.renderAll();
			} catch {}
        } else {
            // new blank
            setPagesDef([{ page: { width: pageWidth, height: pageHeight }, elements: [], repeat: { enabled: false, itemsPerPage: 1 } }]);
            setPages(1);
            setActivePage(0);
        }

		return () => {
			c.dispose();
			fabricRef.current = null;
		};
	}, [open, value, pageWidth, pageHeight]);

    function addText() {
		const c = fabricRef.current; if (!c) return;
        const t = new fabricNS.IText('New Text {{placeholder}}', { left: 40, top: 40, fontSize: 16, fill: 'black' });
		c.add(t).setActiveObject(t);
		c.renderAll();
	}

    function insertPlaceholder(text: string, options?: { x?: number; y?: number; fontSize?: number }) {
        const c = fabricRef.current; if (!c) return;
        const t = new fabricNS.IText(text, { left: options?.x ?? 40, top: options?.y ?? 40, fontSize: options?.fontSize ?? 16, fill: 'black' });
        c.add(t).setActiveObject(t);
        c.requestRenderAll();
    }

    async function loadPageFromDef(def: { page: { width: number; height: number }; elements: any[] }) {
        const c = fabricRef.current as any; if (!c || !def) return;
        c.clear();
        c.setWidth(def.page.width);
        c.setHeight(def.page.height);
        for (const el of def.elements || []) {
            if (el.type === 'text') {
                const t = new fabricNS.IText(el.text || '', { left: el.x, top: el.y, fontSize: el.fontSize || 12, fill: 'black' });
                c.add(t);
            } else if (el.type === 'image' && el.src) {
                await addImageFromUrl(el.src);
            } else if (el.type === 'rect') {
                const r = new fabricNS.Rect({ left: el.x, top: el.y, width: el.width, height: el.height, fill: el.fill ? `#${toHex(el.fill)}` : 'transparent', stroke: el.stroke ? `#${toHex(el.stroke)}` : undefined, strokeWidth: el.strokeWidth ?? 1 });
                c.add(r);
            }
        }
        c.requestRenderAll();
    }

    function toHex(rgb01: { r: number; g: number; b: number }): string {
        const r = Math.round((rgb01.r ?? 0) * 255).toString(16).padStart(2, '0');
        const g = Math.round((rgb01.g ?? 0) * 255).toString(16).padStart(2, '0');
        const b = Math.round((rgb01.b ?? 0) * 255).toString(16).padStart(2, '0');
        return `${r}${g}${b}`;
    }

    function addExerciseTable() {
        const c = fabricRef.current; if (!c) return;
        const rect = new fabricNS.Rect({ left: 40, top: 120, width: 400, height: 120, fill: 'rgba(0,0,0,0.03)', stroke: '#666', strokeDashArray: [4, 4] });
        const label = new fabricNS.IText('Exercise Table', { left: 48, top: 128, fontSize: 14, fill: '#333' });
        // make children non-selectable so the group gets focus
        (rect as any).selectable = false; (rect as any).evented = false;
        (label as any).selectable = false; (label as any).evented = false;
        const group = new fabricNS.Group([rect, label], { left: 40, top: 120, selectable: true, evented: true, subTargetCheck: false } as any);
        (group as any).data = {
            elementType: 'exercise_table',
            config: {
                width: 400,
                header: true,
                rowHeight: 18,
                perPage: 12,
                columns: [
                    { key: 'exercise_name', label: 'Exercise', width: 200 },
                    { key: 'sets', label: 'Sets', width: 100 },
                    { key: 'reps', label: 'Reps', width: 100 }
                ]
            }
        };
        c.add(group).setActiveObject(group);
        c.requestRenderAll();
        setSelected(group);
    }

    function addRectangle() {
        const c = fabricRef.current; if (!c) return;
        const rect = new fabricNS.Rect({ left: 40, top: 260, width: 200, height: 80, fill: 'rgba(59,130,246,0.2)', stroke: '#3B82F6', strokeWidth: 2 });
        c.add(rect).setActiveObject(rect);
        c.requestRenderAll();
    }

    async function addImageFromUrl(url: string) {
        const cleanUrl = (url || '').trim();
        if (!cleanUrl) return;
        const c = fabricRef.current; if (!c) return;
        setImgError(null);
        setAddingImg(true);
        const preload = (withCORS: boolean) => new Promise<HTMLImageElement>((resolve, reject) => {
            const imgEl = new Image();
            if (withCORS) imgEl.crossOrigin = 'anonymous';
            imgEl.onload = () => resolve(imgEl);
            imgEl.onerror = () => reject(new Error('image load error'));
            imgEl.src = cleanUrl;
        });
        try {
            let imgEl: HTMLImageElement | null = null;
            try {
                imgEl = await preload(true);
            } catch {
                imgEl = await preload(false);
            }
            const img = new fabricNS.Image(imgEl);
            img.set({ left: 40, top: 80, selectable: true, evented: true });
            const maxW = (c.getWidth?.() || 595) * 0.8;
            const maxH = (c.getHeight?.() || 842) * 0.5;
            const scaleX = img.width ? Math.min(1, maxW / img.width) : 1;
            const scaleY = img.height ? Math.min(1, maxH / img.height) : 1;
            const scale = Math.min(scaleX, scaleY);
            if (scale && scale < 1) img.scale(scale);
            c.add(img);
            img.bringToFront && img.bringToFront();
            c.setActiveObject(img);
            c.requestRenderAll();
        } catch (e) {
            setImgError('Failed to add image to canvas. Please check S3 CORS or try another image.');
        }
        setAddingImg(false);
	}

    function addImage() {
        addImageFromUrl(imageUrl);
    }

	function removeSelected() {
		const c = fabricRef.current; if (!c) return;
		const obj = c.getActiveObject(); if (obj) { c.remove(obj); c.discardActiveObject(); c.renderAll(); setSelected(null); }
	}

    function bringForward() {
        const c = fabricRef.current; if (!c) return;
        const obj = c.getActiveObject(); if (!obj) return;
        if (typeof c.bringForward === 'function') c.bringForward(obj);
        else if (typeof (obj as any).bringForward === 'function') (obj as any).bringForward();
        c.requestRenderAll();
        setTick((t) => t + 1);
    }

    function sendBackwards() {
        const c = fabricRef.current; if (!c) return;
        const obj = c.getActiveObject(); if (!obj) return;
        if (typeof c.sendBackwards === 'function') c.sendBackwards(obj);
        else if (typeof (obj as any).sendBackwards === 'function') (obj as any).sendBackwards();
        c.requestRenderAll();
        setTick((t) => t + 1);
    }

    function bringToFront() {
        const c = fabricRef.current; if (!c) return;
        const obj = c.getActiveObject(); if (!obj) return;
        if (typeof c.bringToFront === 'function') c.bringToFront(obj);
        else if (typeof (obj as any).bringToFront === 'function') (obj as any).bringToFront();
        c.requestRenderAll();
        setTick((t) => t + 1);
    }

    function sendToBack() {
        const c = fabricRef.current; if (!c) return;
        const obj = c.getActiveObject(); if (!obj) return;
        if (typeof c.sendToBack === 'function') c.sendToBack(obj);
        else if (typeof (obj as any).sendToBack === 'function') (obj as any).sendToBack();
        c.requestRenderAll();
        setTick((t) => t + 1);
    }

    // Commit current canvas to pagesDef for the active page and return the next snapshot
    function commitCurrentPage(): Array<{ page: { width: number; height: number }; elements: any[]; repeat?: { enabled: boolean; itemsPerPage: number } }> | void {
        const c = fabricRef.current; if (!c) return;
        const elements: any[] = [];
        c.getObjects().forEach((obj: any) => {
            if (obj.type === 'text' || obj.type === 'i-text') {
                const t = obj as any;
                const color = t.fill && typeof t.fill === 'string' ? hexToRgb01(t.fill) : undefined;
                if (t?.data?.elementType === 'link_text') {
                    elements.push({ type: 'link_text', x: t.left || 0, y: t.top || 0, text: t.text || '', url: t.data?.url || 'https://', fontSize: t.fontSize || 12, color });
                } else {
                    elements.push({ type: 'text', x: t.left || 0, y: t.top || 0, fontSize: t.fontSize || 12, text: t.text || '', color });
                }
            } else if (obj.type === 'image') {
				const i = obj as any;
				const src = (i as any).getSrc ? (i as any).getSrc() : (i as any)._element?.src;
				elements.push({ type: 'image', x: i.left || 0, y: i.top || 0, width: i.getScaledWidth(), height: i.getScaledHeight(), src });
            } else if (obj.type === 'rect') {
                const r = obj as any;
                const fill = r.fill && typeof r.fill === 'string' ? hexToRgb01(r.fill) : undefined;
                const stroke = r.stroke && typeof r.stroke === 'string' ? hexToRgb01(r.stroke) : undefined;
                elements.push({ type: 'rect', x: r.left || 0, y: r.top || 0, width: r.width || r.getScaledWidth?.() || 0, height: r.height || r.getScaledHeight?.() || 0, fill, stroke, strokeWidth: r.strokeWidth ?? 1 });
            } else if ((obj as any).data?.elementType === 'exercise_table') {
                const g = obj as any;
                const cfg = g.data?.config || {};
                // width from config or group width
                const width = cfg.width || g.getScaledWidth?.() || 400;
                elements.push({
                    type: 'exercise_table',
                    x: g.left || 0,
                    y: g.top || 0,
                    width,
                    rowHeight: cfg.rowHeight ?? 18,
                    header: cfg.header !== false,
                    perPage: cfg.perPage ?? 12,
                    style: cfg.style || 'simple',
                    columns: Array.isArray(cfg.columns) ? cfg.columns : undefined
                } as any);
			}
		});
        // prepare next snapshot with the current page committed
        let nextSnapshot: Array<{ page: { width: number; height: number }; elements: any[]; repeat?: { enabled: boolean; itemsPerPage: number } }> = [];
        setPagesDef((prev) => {
            const base = prev.length ? prev : [{ page: { width: c.getWidth(), height: c.getHeight() }, elements: [], repeat: { enabled: false, itemsPerPage: 1 } }];
            const next = [...base];
            next[activePage] = { ...next[activePage], page: { width: c.getWidth(), height: c.getHeight() }, elements };
            nextSnapshot = next;
            return next;
        });
        return nextSnapshot;
    }

    function exportSchema() {
        const c = fabricRef.current; if (!c) return;
        // ensure the latest edits of the active page are stored and use a fresh snapshot
        const snapshot = commitCurrentPage() || pagesDef;

        // build schema from pagesDef
        const repeatPageIndex = snapshot.findIndex((p) => p.repeat?.enabled);
        const repeat = repeatPageIndex >= 0 ? snapshot[repeatPageIndex] : null;
        const staticPages = snapshot
            .map((p, i) => ({ i, p }))
            .filter(({ i }) => i !== repeatPageIndex)
            .map(({ p }) => ({ page: p.page, elements: p.elements }));

        let schema: any = {};
        if (staticPages.length > 1) {
            // Multi-page template: send only pages array
            schema.pages = staticPages;
        } else if (staticPages.length === 1) {
            // Single page
            schema.page = staticPages[0].page;
            schema.elements = staticPages[0].elements;
        } else if (repeat) {
            // No static pages; fall back to repeat page for required fields
            schema.page = repeat.page;
            schema.elements = repeat.elements;
        }

        if (repeat) {
            schema.repeatPerItem = { page: repeat.page, elements: repeat.elements, itemsPerPage: Math.max(1, repeat.repeat?.itemsPerPage || 1) };
        }
		onSave(schema);
	}

    function hexToRgb01(hex: string): { r: number; g: number; b: number } | undefined {
        const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (!m) return undefined;
        const r = parseInt(m[1], 16) / 255;
        const g = parseInt(m[2], 16) / 255;
        const b = parseInt(m[3], 16) / 255;
        return { r, g, b };
    }

	// Inspector bindings
	const isText = selected && (selected.type === 'text' || selected.type === 'i-text');
	const isImage = selected && selected.type === 'image';

	return (
		<Box sx={{ display: open ? 'block' : 'none' }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 2 }}>
                <Box>
                    <Box sx={{ position: 'relative', border: 1, borderColor: 'divider', borderRadius: 1, p: 1, bgcolor: 'grey.50', overflow: 'auto' }}>
                        {showGrid && (
                            <Box sx={{ position: 'absolute', inset: 1, pointerEvents: 'none' }}>
                                {[...Array(Math.ceil((pageHeight + 20) / gridSize))].map((_, i) => (
                                    <Box key={`h-${i}`} sx={{ position: 'absolute', left: 0, right: 0, top: i * gridSize, borderTop: '1px dashed #e5e7eb', opacity: 0.5 }} />
                                ))}
                                {[...Array(Math.ceil((pageWidth + 20) / gridSize))].map((_, i) => (
                                    <Box key={`v-${i}`} sx={{ position: 'absolute', top: 0, bottom: 0, left: i * gridSize, borderLeft: '1px dashed #e5e7eb', opacity: 0.5 }} />
                                ))}
                            </Box>
                        )}
                        <canvas ref={canvasRef} />
                    </Box>
                </Box>
                <Box>
					<Stack spacing={2}>
					<Typography variant="h6">Tools</Typography>
                    <Stack direction="row" spacing={1}>
						<Button variant="outlined" onClick={() => { setPages((p) => p + 1); setActivePage(pages); /* future: maintain page store */ }}>Add Page</Button>
						<Typography variant="body2" sx={{ ml: 1 }}>Pages: {pages || 1} | Active: {activePage + 1}</Typography>
					</Stack>
                    <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2">Zoom</Typography>
                        <Button size="small" variant="outlined" onClick={() => { const c = fabricRef.current; if (!c) return; const z = Math.max(0.25, zoom - 0.1); setZoom(z); c.setZoom(z); c.requestRenderAll(); }}>-</Button>
                        <Typography variant="caption">{Math.round(zoom * 100)}%</Typography>
                        <Button size="small" variant="outlined" onClick={() => { const c = fabricRef.current; if (!c) return; const z = Math.min(3, zoom + 0.1); setZoom(z); c.setZoom(z); c.requestRenderAll(); }}>+</Button>
                        <Button size="small" variant="outlined" onClick={() => { const c = fabricRef.current; if (!c) return; setZoom(1); c.setZoom(1); c.requestRenderAll(); }}>Reset</Button>
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center">
                        <Button size="small" variant={showGrid ? 'contained' : 'outlined'} onClick={() => setShowGrid((v) => !v)}>Grid</Button>
                        <Button size="small" variant={snapToGrid ? 'contained' : 'outlined'} onClick={() => setSnapToGrid((v) => !v)}>Snap</Button>
                    </Stack>
                        <Stack direction="row" spacing={1}>
							<Button variant="outlined" onClick={addText}>Add Text</Button>
							<Button variant="outlined" color="error" onClick={removeSelected} disabled={!selected}>Delete</Button>
                            {kind === 'workout' && (
                              <Button variant="outlined" onClick={addExerciseTable}>Add Exercise Table</Button>
                            )}
                            <Button variant="outlined" onClick={addRectangle}>Add Rectangle</Button>
						</Stack>
                        {kind === 'workout' && (
                          <Stack spacing={1}>
                            <Typography variant="subtitle2">Table Themes</Typography>
                            <Stack direction="row" spacing={1}>
                              {(['simple','zebra','boxed'] as const).map((theme) => (
                                <Box key={theme}
                                  onClick={() => {
                                    const c = fabricRef.current; if (!c) return;
                                    const obj = c.getActiveObject();
                                    if (obj && (obj as any).data?.elementType === 'exercise_table') {
                                      const cfg = (obj as any).data.config || {}; cfg.style = theme; (obj as any).data.config = cfg; c.requestRenderAll(); setTick((t)=>t+1);
                                    }
                                  }}
                                  sx={{ width: 96, borderRadius: 1, border: '1px solid', borderColor: 'divider', cursor: 'pointer', overflow: 'hidden' }}
                                  title={`Set ${theme}`}
                                >
                                  <Box sx={{ height: 14, bgcolor: theme==='boxed' ? 'grey.300' : theme==='simple' ? 'grey.200' : 'grey.300' }} />
                                  <Box sx={{ p: 0.5 }}>
                                    {[0,1,2].map((i) => (
                                      <Box key={i} sx={{ display: 'grid', gridTemplateColumns: '48px 24px 24px', gap: 0.5, alignItems: 'center', bgcolor: theme==='zebra' && i%2===0 ? 'grey.100' : 'transparent', borderBottom: theme==='boxed' ? '1px solid #e5e7eb' : 'none' }}>
                                        <Box sx={{ height: 8, bgcolor: 'grey.200', borderRadius: 0.5 }} />
                                        <Box sx={{ height: 8, bgcolor: 'grey.200', borderRadius: 0.5 }} />
                                        <Box sx={{ height: 8, bgcolor: 'grey.200', borderRadius: 0.5 }} />
                                      </Box>
                                    ))}
                                  </Box>
                                </Box>
                              ))}
                            </Stack>
                            <Typography variant="caption" color="text.secondary">Select an exercise table, then click a theme.</Typography>
                          </Stack>
                        )}
                        {kind === 'workout' && (
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Button size="small" variant={repeatEnabled ? 'contained' : 'outlined'} onClick={() => setRepeatEnabled((v) => !v)}>Dynamic Per-Exercise Page</Button>
                            {repeatEnabled && (
                              <TextField size="small" type="number" label="Items/Page" value={repeatItemsPerPage} onChange={(e) => setRepeatItemsPerPage(Math.max(1, Number(e.target.value) || 1))} sx={{ width: 140 }} />
                            )}
                          </Stack>
                        )}
                        {/* Page navigation */}
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Button size="small" variant="outlined" onClick={async () => {
                            // commit current page locally (do not close builder)
                            commitCurrentPage();
                            const idx = Math.max(0, activePage - 1);
                            setActivePage(idx);
                            // load page
                            const pd = pagesDef[idx] || pagesDef[0];
                            await loadPageFromDef(pd);
                            setRepeatEnabled(!!pd?.repeat?.enabled);
                            setRepeatItemsPerPage(pd?.repeat?.itemsPerPage || 1);
                          }}>Prev</Button>
                          <Button size="small" variant="outlined" onClick={async () => {
                            // commit current page locally (do not close builder)
                            commitCurrentPage();
                            const idx = Math.min((pagesDef.length - 1), activePage + 1);
                            setActivePage(idx);
                            const pd = pagesDef[idx] || pagesDef[activePage];
                            await loadPageFromDef(pd);
                            setRepeatEnabled(!!pd?.repeat?.enabled);
                            setRepeatItemsPerPage(pd?.repeat?.itemsPerPage || 1);
                          }}>Next</Button>
                          <Button size="small" variant="outlined" onClick={async () => {
                            // commit current page locally before creating a new one
                            commitCurrentPage();
                            const c = fabricRef.current; if (!c) return;
                            const newDef = { page: { width: c.getWidth(), height: c.getHeight() }, elements: [], repeat: { enabled: false, itemsPerPage: 1 } };
                            setPagesDef((prev) => [...prev, newDef]);
                            setPages((p) => p + 1);
                            setActivePage(pagesDef.length);
                            await loadPageFromDef(newDef);
                            setRepeatEnabled(false);
                            setRepeatItemsPerPage(1);
                          }}>Add Page</Button>
                          <Typography variant="caption">Page {activePage + 1} / {pagesDef.length || 1}</Typography>
                        </Stack>
                    <Stack direction="row" spacing={1}>
                            <Button size="small" variant="outlined" onClick={bringForward} disabled={!selected}>Bring Forward</Button>
                            <Button size="small" variant="outlined" onClick={sendBackwards} disabled={!selected}>Send Backward</Button>
                            <Button size="small" variant="outlined" onClick={bringToFront} disabled={!selected}>Bring To Front</Button>
                        <Button size="small" variant="outlined" onClick={sendToBack} disabled={!selected}>Send To Back</Button>
                        <Button size="small" variant="outlined" onClick={() => { const c = fabricRef.current; if (!c || !selected) return; (selected as any).clone((clone: any) => { clone.set({ left: (selected.left || 0) + 10, top: (selected.top || 0) + 10 }); c.add(clone); c.setActiveObject(clone); c.requestRenderAll(); }); }}>Duplicate</Button>
                        <Button size="small" variant="outlined" color="error" onClick={removeSelected} disabled={!selected}>Delete</Button>
                        </Stack>
                        {selected && (
                            <Typography variant="caption" color="text.secondary">
                                Z-order: {(() => { const c = fabricRef.current; if (!c) return 0; const idx = c.getObjects().indexOf(selected); return idx; })()}
                            </Typography>
                        )}
                        <Typography variant="subtitle2">Placeholders</Typography>
                        {kind === 'workout' ? (
                          <Stack direction="row" spacing={1} flexWrap="wrap">
                              <Button size="small" variant="outlined" onClick={() => insertPlaceholder('{{plan.title}}')}>Plan Title</Button>
                              <Button size="small" variant="outlined" onClick={() => insertPlaceholder('{{client.fullName}}')}>Client Name</Button>
                              <Button size="small" variant="outlined" onClick={() => insertPlaceholder('{{totals.total_exercises}}')}>Total Exercises</Button>
                              <Button size="small" variant="outlined" onClick={() => insertPlaceholder('{{totals.total_sets}}')}>Total Sets</Button>
                              <Button size="small" variant="outlined" onClick={() => insertPlaceholder('{{totals.total_reps}}')}>Total Reps</Button>
                          </Stack>
                        ) : (
                          <Stack direction="row" spacing={1} flexWrap="wrap">
                              <Button size="small" variant="outlined" onClick={() => insertPlaceholder('{{plan.title}}')}>Plan Title</Button>
                              <Button size="small" variant="outlined" onClick={() => insertPlaceholder('{{client.fullName}}')}>Client Name</Button>
                              <Button size="small" variant="outlined" onClick={() => insertPlaceholder('{{totals.meals}}')}>Total Meals</Button>
                              <Button size="small" variant="outlined" onClick={() => insertPlaceholder('{{totals.calories}}')}>Total Calories</Button>
                          </Stack>
                        )}
                    {/* Image upload via S3 */}
                    {workspaceId ? (
                        <>
                            <Typography variant="subtitle2">Upload Image to S3</Typography>
                            <FileUpload
                                key={uploadKey}
                                workspaceId={workspaceId}
                                uploadType="landing"
                                maxSize={5}
                                onUploadComplete={async (url: string) => {
                                    setImageUrl(url);
                                    await addImageFromUrl(url);
                                    setImageUrl('');
                                    setUploadKey((k) => k + 1);
                                }}
                            />
                            <Stack direction="row" spacing={1} alignItems="center">
                                <TextField size="small" label="Uploaded URL" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} fullWidth />
                                <Button variant="outlined" disabled={!imageUrl || addingImg} onClick={async () => { await addImageFromUrl(imageUrl); setImageUrl(''); setUploadKey((k) => k + 1); }}>{addingImg ? 'Adding...' : 'Add Image'}</Button>
                            </Stack>
                            {imgError && <Alert severity="error" sx={{ mt: 1 }}>{imgError}</Alert>}
                        </>
                    ) : (
							<Stack direction="row" spacing={1}>
								<TextField size="small" label="Image URL" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} fullWidth />
								<Button variant="outlined" onClick={addImage} disabled={!imageUrl}>Add Image</Button>
							</Stack>
						)}

						<Divider />
						<Typography variant="h6">Inspector</Typography>
                        {selected ? (
							<Stack spacing={1}>
								<TextField size="small" label="X" type="number" value={Math.round((selected.left || 0) + tick * 0)} onChange={(e) => { const v = Number(e.target.value); selected.set({ left: v }); fabricRef.current?.renderAll(); setTick((t) => t + 1); }} />
								<TextField size="small" label="Y" type="number" value={Math.round((selected.top || 0) + tick * 0)} onChange={(e) => { const v = Number(e.target.value); selected.set({ top: v }); fabricRef.current?.renderAll(); setTick((t) => t + 1); }} />
								{isText && (
									<>
                                        <TextField size="small" label="Font Size" type="number" value={(selected as any).fontSize || 12} onChange={(e) => { const v = Number(e.target.value); (selected as any).set({ fontSize: v }); fabricRef.current?.renderAll(); setTick((t) => t + 1); }} />
                                        <TextField size="small" label="Text" value={(selected as any).text || ''} onChange={(e) => { (selected as any).set({ text: e.target.value }); fabricRef.current?.renderAll(); setTick((t) => t + 1); }} />
                                        <Stack direction="row" spacing={1}>
                                          <TextField size="small" label="Text Color" type="color" value={(selected as any).fill || '#000000'} onChange={(e) => { const v = e.target.value; (selected as any).set({ fill: v }); fabricRef.current?.renderAll(); setTick((t) => t + 1); }} sx={{ width: 120 }} />
                                        </Stack>
									</>
								)}
                                {selected && selected.type === 'rect' && (
                                  <>
                                    <TextField size="small" label="Width" type="number" value={(selected as any).width || (selected as any).getScaledWidth?.()}
                                      onChange={(e) => { const v = Number(e.target.value); (selected as any).set({ width: v }); fabricRef.current?.renderAll(); setTick((t) => t + 1); }} />
                                    <TextField size="small" label="Height" type="number" value={(selected as any).height || (selected as any).getScaledHeight?.()}
                                      onChange={(e) => { const v = Number(e.target.value); (selected as any).set({ height: v }); fabricRef.current?.renderAll(); setTick((t) => t + 1); }} />
                                    <Stack direction="row" spacing={1}>
                                      <TextField size="small" label="Fill" type="color" value={(selected as any).fill || '#000000'} onChange={(e) => { const v = e.target.value; (selected as any).set({ fill: v }); fabricRef.current?.renderAll(); setTick((t) => t + 1); }} sx={{ width: 120 }} />
                                      <TextField size="small" label="Stroke" type="color" value={(selected as any).stroke || '#000000'} onChange={(e) => { const v = e.target.value; (selected as any).set({ stroke: v }); fabricRef.current?.renderAll(); setTick((t) => t + 1); }} sx={{ width: 120 }} />
                                      <TextField size="small" label="Stroke Width" type="number" value={(selected as any).strokeWidth ?? 1} onChange={(e) => { const v = Number(e.target.value); (selected as any).set({ strokeWidth: v }); fabricRef.current?.renderAll(); setTick((t) => t + 1); }} sx={{ width: 140 }} />
                                    </Stack>
                                  </>
                                )}
                                {isImage && (
									<>
										<TextField size="small" label="Width" type="number" value={Math.round((selected as any).getScaledWidth())} onChange={(e) => { const v = Number(e.target.value); const img = selected as any; const scale = v / (img.width || v); img.set({ scaleX: scale }); fabricRef.current?.renderAll(); setTick((t) => t + 1); }} />
										<TextField size="small" label="Height" type="number" value={Math.round((selected as any).getScaledHeight())} onChange={(e) => { const v = Number(e.target.value); const img = selected as any; const scale = v / (img.height || v); img.set({ scaleY: scale }); fabricRef.current?.renderAll(); setTick((t) => t + 1); }} />
									</>
								)}
                                {(selected as any)?.data?.elementType === 'exercise_table' && (
                                  <>
                                    <TextField size="small" label="Width" type="number" value={(selected as any).getScaledWidth?.() || (selected as any).width || 400}
                                      onChange={(e) => {
                                        const v = Number(e.target.value);
                                        const cfg = (selected as any).data.config || {}; cfg.width = v; (selected as any).data.config = cfg; fabricRef.current?.renderAll(); setTick((t) => t + 1);
                                      }} />
                                    <TextField size="small" label="Row Height" type="number" value={(selected as any).data?.config?.rowHeight ?? 18}
                                      onChange={(e) => { const v = Number(e.target.value); const cfg = (selected as any).data.config || {}; cfg.rowHeight = v; (selected as any).data.config = cfg; setTick((t) => t + 1); }} />
                                    <TextField size="small" label="Per Page" type="number" value={(selected as any).data?.config?.perPage ?? 12}
                                      onChange={(e) => { const v = Number(e.target.value); const cfg = (selected as any).data.config || {}; cfg.perPage = v; (selected as any).data.config = cfg; setTick((t) => t + 1); }} />
                                    <Stack direction="row" spacing={1}>
                                      <Button size="small" variant={(selected as any).data?.config?.header === false ? 'outlined' : 'contained'} onClick={() => { const cfg = (selected as any).data.config || {}; cfg.header = true; (selected as any).data.config = cfg; setTick((t) => t + 1); }}>Header On</Button>
                                      <Button size="small" variant={(selected as any).data?.config?.header === false ? 'contained' : 'outlined'} onClick={() => { const cfg = (selected as any).data.config || {}; cfg.header = false; (selected as any).data.config = cfg; setTick((t) => t + 1); }}>Header Off</Button>
                                    </Stack>
                                    <Stack direction="row" spacing={1}>
                                      <Button size="small" variant={((selected as any).data?.config?.style ?? 'simple') === 'simple' ? 'contained' : 'outlined'} onClick={() => { const cfg = (selected as any).data.config || {}; cfg.style = 'simple'; (selected as any).data.config = cfg; setTick((t) => t + 1); }}>Simple</Button>
                                      <Button size="small" variant={((selected as any).data?.config?.style ?? 'simple') === 'zebra' ? 'contained' : 'outlined'} onClick={() => { const cfg = (selected as any).data.config || {}; cfg.style = 'zebra'; (selected as any).data.config = cfg; setTick((t) => t + 1); }}>Zebra</Button>
                                      <Button size="small" variant={((selected as any).data?.config?.style ?? 'simple') === 'boxed' ? 'contained' : 'outlined'} onClick={() => { const cfg = (selected as any).data.config || {}; cfg.style = 'boxed'; (selected as any).data.config = cfg; setTick((t) => t + 1); }}>Boxed</Button>
                                    </Stack>
                                  </>
                                )}
						</Stack>
					) : (
						<Typography variant="body2" color="text.secondary">Select an element to edit properties</Typography>
					)}

					<Divider sx={{ my: 2 }} />
					<Stack direction="row" spacing={2}>
						<Button variant="outlined" onClick={onClose}>Close</Button>
						<Button variant="contained" onClick={exportSchema}>Save</Button>
					</Stack>
					</Stack>
                </Box>
            </Box>
		</Box>
	);
}


