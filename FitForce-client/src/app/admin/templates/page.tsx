"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import FileUpload from "components/FileUpload";

function cx(...classes: (string | false | null | undefined)[]) {
	return classes.filter(Boolean).join(" ");
}

type Template = {
	id: string;
	name: string;
	kind: "workout" | "nutrition" | string;
	previewUrl?: string | null;
  schema: any;
  html?: string | null;
	updatedAt: string;
};

const TemplateBuilder = dynamic(() => import("@/components/TemplateBuilder"), { ssr: false });

export default function TemplatesAdminPage() {
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [templates, setTemplates] = useState<Template[]>([]);
	const [name, setName] = useState("");
	const [kind, setKind] = useState<"workout" | "nutrition">("workout");
	const [schemaText, setSchemaText] = useState("{\n  \"page\": { \"width\": 595, \"height\": 842 },\n  \"elements\": [\n    { \"type\": \"text\", \"x\": 40, \"y\": 800, \"fontSize\": 20, \"text\": \"{{plan.title}}\" }\n  ]\n}");
	const [creating, setCreating] = useState(false);
	const [builderOpen, setBuilderOpen] = useState(false);
	const [builderValue, setBuilderValue] = useState<any | null>(null);
  const [creatingWithConfig, setCreatingWithConfig] = useState(true);
  const [creatingWithHtml, setCreatingWithHtml] = useState(false);
  const [htmlText, setHtmlText] = useState("<html>\n  <head>\n    <meta charset=\"utf-8\" />\n    <style>\n      body{ font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; padding: 24px; }\n      h1{ margin: 0 0 8px; font-size: 22px; }\n      .muted{ color: #666; }\n      table{ width: 100%; border-collapse: collapse; margin-top: 16px; }\n      th, td{ border: 1px solid #e5e7eb; padding: 8px; font-size: 12px; }\n      th{ background: #f3f4f6; text-align: left; }\n    </style>\n  </head>\n  <body>\n    <h1>{{plan.title}}</h1>\n    <div class=\"muted\">Client: {{client.fullName}}</div>\n    <table>\n      <thead>\n        <tr>\n          <th>Item</th>\n          <th v-if=\"workout\">Sets</th>\n          <th v-if=\"workout\">Reps</th>\n          <th v-if=\"nutrition\">Servings</th>\n          <th v-if=\"nutrition\">Calories</th>\n        </tr>\n      </thead>\n      <tbody>\n        <!-- For simplicity, back-end substitutes placeholders only; loop logic can be provided by pre-resolving in data -->\n      </tbody>\n    </table>\n  </body>\n</html>");
	const [previewingId, setPreviewingId] = useState<string | null>(null);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    // Fixed-config UI state
    const [cfgOrientation, setCfgOrientation] = useState<"phone" | "tablet">("phone");
    const [cfgCover, setCfgCover] = useState("");
    const [cfgCycle, setCfgCycle] = useState("");
    const [cfgCycles, setCfgCycles] = useState<string[]>([]);
    const [cfgMealsBg, setCfgMealsBg] = useState("");
    const [cfgExtraPages, setCfgExtraPages] = useState<Array<{ src: string; placement: 'top' | 'bottom' }>>([]);
    const [cfgMealsMode, setCfgMealsMode] = useState<"one_per_page" | "multi_per_page">("multi_per_page");
    const [cfgImageHalf, setCfgImageHalf] = useState(true);
    const [cfgTableStyle, setCfgTableStyle] = useState<"simple" | "zebra" | "boxed" | "compact" | "striped_dark" | "boxed_bold">("simple");
    const [cfgItemsPerPage, setCfgItemsPerPage] = useState(12);

	async function fetchTemplates() {
		setLoading(true);
		setError(null);
		try {
			const res = await fetch(`/api/templates?kind=${kind}`, { credentials: "include" });
			if (!res.ok) throw new Error(`Failed to load: ${res.status}`);
			const data = await res.json();
			setTemplates(data.templates || []);
		} catch (e: any) {
			setError(e?.message || "Failed to load templates");
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		fetchTemplates();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [kind]);

  const canCreate = useMemo(() => {
    if (creatingWithHtml) return name.trim().length > 0 && htmlText.trim().length > 0 && !creating;
    if (creatingWithConfig) return name.trim().length > 0 && !creating;
    return name.trim().length > 0 && schemaText.trim().length > 0 && !creating;
  }, [name, schemaText, htmlText, creating, creatingWithConfig, creatingWithHtml]);

	async function onCreate(e: React.FormEvent) {
		e.preventDefault();
		if (!canCreate) return;
		setCreating(true);
		setError(null);
    try {
      let body: any = { name: name.trim(), kind };
      if (creatingWithHtml) {
        body.html = htmlText;
      } else if (!creatingWithConfig) {
        let parsed: any;
        try {
          parsed = JSON.parse(schemaText);
        } catch (e) {
          throw new Error("Schema must be valid JSON");
        }
        body.schema = parsed;
      } else {
        const backgrounds: any = {};
        if (cfgCover.trim()) backgrounds.cover = cfgCover.trim();
        if (cfgCycle.trim()) backgrounds.cycle = cfgCycle.trim();
        if (cfgMealsBg.trim()) backgrounds.meals = cfgMealsBg.trim();
        if (cfgExtraPages.length > 0) backgrounds.extra = cfgExtraPages;
        body.config = {
          orientation: cfgOrientation,
          backgrounds,
          mealsLayout: {
            mode: cfgMealsMode,
            imageHalf: cfgImageHalf,
            itemsPerPage: Math.max(1, Number(cfgItemsPerPage) || 1),
            tableStyle: cfgTableStyle,
          },
        };
      }
			const res = await fetch(`/api/templates`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify(body),
			});
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				throw new Error(body?.message || `Failed to create: ${res.status}`);
			}
			setName("");
			await fetchTemplates();
		} catch (e: any) {
			setError(e?.message || "Failed to create template");
		} finally {
			setCreating(false);
		}
	}

  function openBuilder() {
		try {
			const parsed = JSON.parse(schemaText);
			setBuilderValue(parsed);
		} catch {
			setBuilderValue(null);
		}
		setBuilderOpen(true);
	}

	function onBuilderSave(schema: any) {
		setBuilderOpen(false);
		setSchemaText(JSON.stringify(schema, null, 2));
	}

	async function onPreviewTemplate(id: string) {
		setPreviewingId(id);
		setPreviewUrl(null);
		try {
			const res = await fetch(`/api/templates/${id}/preview`, { credentials: "include" });
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data?.message || `Failed to preview: ${res.status}`);
			setPreviewUrl(data?.pdfUrl || null);
		} catch (e: any) {
			setError(e?.message || "Failed to preview");
		} finally {
			setPreviewingId(null);
		}
	}

return (
		<>
		<div className={cx("max-w-5xl mx-auto p-6 space-y-6")}> 
			<div className={cx("space-y-2")}> 
				<h1 className={cx("text-2xl font-semibold")}>PDF Templates</h1>
				<p className={cx("text-sm text-gray-500")}>Create and manage workout/nutrition PDF templates.</p>
			</div>

			<form onSubmit={onCreate} className={cx("space-y-4 border rounded-md p-4")}> 
            <div className={cx("grid grid-cols-1 md:grid-cols-3 gap-4")}>
					<div className={cx("space-y-1")}>
						<label className={cx("text-sm font-medium")}>Name</label>
						<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Workout Simple v1" className={cx("border rounded px-3 py-2 w-full")} />
					</div>
					<div className={cx("space-y-1")}>
						<label className={cx("text-sm font-medium")}>Kind</label>
						<select value={kind} onChange={(e) => setKind(e.target.value as any)} className={cx("border rounded px-3 py-2 w-full")}>
							<option value="workout">workout</option>
							<option value="nutrition">nutrition</option>
						</select>
					</div>
              <div className={cx("space-y-1")}>
                <label className={cx("text-sm font-medium")}>Builder Mode</label>
                <select value={creatingWithHtml ? 'html' : (creatingWithConfig ? 'config' : 'json')} onChange={(e) => {
                  const v = e.target.value;
                  setCreatingWithHtml(v === 'html');
                  setCreatingWithConfig(v === 'config');
                }} className={cx("border rounded px-3 py-2 w-full")}>
                  <option value="config">Fixed Config</option>
                  <option value="json">JSON Schema</option>
                  <option value="html">HTML</option>
                </select>
              </div>
				</div>
            {/* HTML Editor */}
            {creatingWithHtml && (
              <div className={cx("space-y-2")}>
                <label className={cx("text-sm font-medium")}>HTML</label>
                <textarea value={htmlText} onChange={(e) => setHtmlText(e.target.value)} rows={16} className={cx("border rounded px-3 py-2 w-full font-mono text-xs whitespace-pre")} />
                <div className={cx("text-xs text-gray-500")}>
                  Use placeholders like {`{{plan.title}}`}, {`{{client.fullName}}`}. Lists should be pre-flattened in data.
                </div>
                <div className={cx("flex items-center gap-2")}>
                  <button type="button" onClick={async () => {
                    try {
                      const res = await fetch(`/api/templates`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ name: name.trim() || 'HTML Template', kind, html: htmlText }) });
                      if (!res.ok) throw new Error('Failed to save');
                      await fetchTemplates();
                    } catch {}
                  }} className={cx("px-3 py-1 text-sm rounded border")}>Save HTML Template</button>
                  <button type="button" onClick={async () => {
                    try {
                      // Use preview-from-config mock data endpoint if available; otherwise nothing
                      const reqBody = { kind, config: { orientation: 'phone', backgrounds: {}, mealsLayout: { mode: 'multi_per_page', imageHalf: true, itemsPerPage: 12, tableStyle: 'simple' } } };
                      // We don't have a direct HTML preview endpoint without saving; recommend save + preview button below
                    } catch {}
                  }} className={cx("px-3 py-1 text-sm rounded border hidden")}>Live Preview</button>
                </div>
              </div>
            )}

            {/* Fixed Config only */}
            {!creatingWithHtml && (
            <div className={cx("space-y-3")}> 
            </div>
            )}
					<div className={cx("space-y-3")}> 
						<div className={cx("grid grid-cols-1 md:grid-cols-3 gap-3")}>
							<div className={cx("space-y-1")}>
								<label className={cx("text-sm font-medium")}>Orientation</label>
								<select value={cfgOrientation} onChange={(e) => setCfgOrientation(e.target.value as any)} className={cx("border rounded px-3 py-2 w-full")}>
									<option value="phone">phone (A4 portrait)</option>
									<option value="tablet">tablet (A4 landscape)</option>
								</select>
							</div>
							<div className={cx("space-y-1")}>
								<label className={cx("text-sm font-medium")}>Items per page</label>
								<input type="number" value={cfgItemsPerPage} onChange={(e) => setCfgItemsPerPage(Math.max(1, Number(e.target.value) || 1))} className={cx("border rounded px-3 py-2 w-full")} />
							</div>
							<div className={cx("space-y-1")}>
								<label className={cx("text-sm font-medium")}>{kind === "workout" ? "Exercises mode" : "Meals mode"}</label>
								<select value={cfgMealsMode} onChange={(e) => setCfgMealsMode(e.target.value as any)} className={cx("border rounded px-3 py-2 w-full")}>
									<option value="multi_per_page">multi_per_page</option>
									<option value="one_per_page">one_per_page</option>
								</select>
							</div>
						</div>
					<div className={cx("grid grid-cols-1 md:grid-cols-3 gap-3")}> 
							<div className={cx("space-y-1")}>
								<label className={cx("text-sm font-medium")}>Cover background</label>
								<FileUpload workspaceId={""} uploadType="landing" maxSize={5} onUploadComplete={(url: string) => setCfgCover(url)} />
								{cfgCover && <div className={cx("text-xs text-gray-500")}>
									Uploaded
								</div>}
							</div>
							<div className={cx("space-y-1")}>
								<label className={cx("text-sm font-medium")}>Cycle background</label>
								<FileUpload workspaceId={""} uploadType="landing" maxSize={5} onUploadComplete={(url: string) => setCfgCycle(url)} />
								{cfgCycle && <div className={cx("text-xs text-gray-500")}>
									Uploaded
								</div>}
							</div>
							<div className={cx("space-y-1")}>
								<label className={cx("text-sm font-medium")}>{kind === "workout" ? "Exercises background" : "Meals background"}</label>
								<FileUpload workspaceId={""} uploadType="landing" maxSize={5} onUploadComplete={(url: string) => setCfgMealsBg(url)} />
								{cfgMealsBg && <div className={cx("text-xs text-gray-500")}>
									Uploaded
								</div>}
							</div>
						</div>
					<div className={cx("space-y-2 mt-2")}> 
						<div className={cx("text-sm font-medium")}>
							Extra background pages
						</div>
						<div className={cx("flex items-center gap-2 flex-wrap")}> 
                    <button type="button" onClick={() => { if (cfgExtraPages.length < 10) setCfgExtraPages((arr) => [...arr, { src: '', placement: 'bottom' }]); }} className={cx("px-2 py-1 text-xs rounded border")}>Add Extra Page</button>
                    {cfgExtraPages.map((p, i) => (
                        <div key={i} className={cx("flex items-center gap-1 text-xs border rounded px-2 py-1")}> 
                            <span>Page {i + 1}</span>
                            <FileUpload workspaceId={""} uploadType="landing" maxSize={5} onUploadComplete={(url: string) => setCfgExtraPages((arr) => arr.map((it, idx) => idx === i ? { ...it, src: url } : it))} />
                            <select value={p.placement} onChange={(e) => setCfgExtraPages((arr) => arr.map((it, idx) => idx === i ? { ...it, placement: (e.target.value as 'top' | 'bottom') } : it))} className={cx("border rounded px-1 py-0.5")}>
                                <option value="top">top</option>
                                <option value="bottom">bottom</option>
                            </select>
                            <button onClick={() => i>0 && setCfgExtraPages((arr) => { const copy=[...arr]; const t=copy[i-1]; copy[i-1]=copy[i]; copy[i]=t; return copy; })} className={cx("px-1 py-0.5 rounded border")} disabled={i===0}>↑</button>
                            <button onClick={() => i<cfgExtraPages.length-1 && setCfgExtraPages((arr) => { const copy=[...arr]; const t=copy[i+1]; copy[i+1]=copy[i]; copy[i]=t; return copy; })} className={cx("px-1 py-0.5 rounded border")} disabled={i===cfgExtraPages.length-1}>↓</button>
                            <button onClick={() => setCfgExtraPages((arr) => arr.filter((__, idx) => idx !== i))} className={cx("px-1 py-0.5 rounded border")}>✕</button>
                        </div>
                    ))}
						</div>
						<div className={cx("text-xs text-gray-500")}>
							Upload one or more images; each will become a full extra page.
						</div>
					</div>
						<div className={cx("grid grid-cols-1 md:grid-cols-3 gap-3")}>
							<div className={cx("space-y-1")}>
								<label className={cx("text-sm font-medium")}>Table style</label>
								<select value={cfgTableStyle} onChange={(e) => setCfgTableStyle(e.target.value as any)} className={cx("border rounded px-3 py-2 w-full")}>
									<option value="simple">simple</option>
									<option value="zebra">zebra</option>
									<option value="boxed">boxed</option>
									<option value="compact">compact</option>
									<option value="striped_dark">striped_dark</option>
									<option value="boxed_bold">boxed_bold</option>
								</select>
							</div>
							{cfgMealsMode === "one_per_page" && (
								<div className={cx("space-y-1")}>
									<label className={cx("text-sm font-medium")}>Image half height</label>
									<select value={cfgImageHalf ? "true" : "false"} onChange={(e) => setCfgImageHalf(e.target.value === "true")} className={cx("border rounded px-3 py-2 w-full")}>
										<option value="true">true (50%)</option>
										<option value="false">false (35%)</option>
									</select>
								</div>
							)}
						</div>
					</div>
				<div className={cx("flex items-center gap-2")}> 
					<button type="submit" disabled={!canCreate} className={cx("px-4 py-2 rounded bg-black text-white disabled:opacity-50")}>{creating ? "Creating..." : "Create Template"}</button>
					{creatingWithConfig && (
						<button type="button" onClick={async () => {
							try {
								const backgrounds: any = {};
								if (cfgCover.trim()) backgrounds.cover = cfgCover.trim();
								if (kind === 'nutrition') {
									if (cfgCycles.length > 0) backgrounds.cycle = cfgCycles; else if (cfgCycle.trim()) backgrounds.cycle = cfgCycle.trim();
								}
								if (cfgMealsBg.trim()) backgrounds.meals = cfgMealsBg.trim();
								const res = await fetch('/api/templates/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ kind, config: { orientation: cfgOrientation, backgrounds, mealsLayout: { mode: cfgMealsMode, imageHalf: cfgImageHalf, itemsPerPage: Math.max(1, Number(cfgItemsPerPage) || 1), tableStyle: cfgTableStyle } } }) });
								const data = await res.json();
								if (data?.pdfUrl) window.open(data.pdfUrl, '_blank');
							} catch {}
						}} className={cx("px-4 py-2 rounded border")}>Live Preview</button>
					)}
					{error && <span className={cx("text-red-600 text-sm")}>{error}</span>}
				</div>
			</form>

			<div className={cx("space-y-2")}>
				<div className={cx("flex items-center justify-between")}> 
					<h2 className={cx("text-lg font-medium")}>Templates ({templates.length})</h2>
					<button onClick={fetchTemplates} className={cx("px-3 py-1 text-sm rounded border")}>{loading ? "Loading..." : "Refresh"}</button>
				</div>
            <div className={cx("grid grid-cols-1 md:grid-cols-2 gap-4")}> 
					{templates.map((t) => (
						<div key={t.id} className={cx("border rounded p-4 space-y-2")}> 
							<div className={cx("flex items-center justify-between")}> 
								<div className={cx("font-medium")}>{t.name}</div>
								<span className={cx("text-xs px-2 py-0.5 rounded border")}>{t.kind}</span>
							</div>
							{t.previewUrl && (
								<img src={t.previewUrl} alt="preview" className={cx("w-full h-40 object-cover rounded border")} />
							)}
                  {t.html ? (
                    <pre className={cx("bg-gray-50 border rounded p-2 text-xs overflow-auto max-h-48")}>{t.html.slice(0, 2000)}</pre>
                  ) : (
                    <pre className={cx("bg-gray-50 border rounded p-2 text-xs overflow-auto max-h-48")}>{JSON.stringify(t.schema, null, 2)}</pre>
                  )}
							<div className={cx("text-xs text-gray-500")}>
								Updated: {new Date(t.updatedAt).toLocaleString()}
							</div>
							<div className={cx("flex items-center gap-2")}> 
								<button onClick={() => onPreviewTemplate(t.id)} className={cx("px-2 py-1 text-sm rounded border")}>{previewingId === t.id ? "Previewing..." : "Preview PDF"}</button>
								{previewUrl && previewingId === null && (
									<a href={previewUrl} target="_blank" rel="noreferrer" className={cx("text-blue-600 text-sm")}>Open PDF</a>
								)}
							</div>
						</div>
					))}
					{templates.length === 0 && !loading && (
						<div className={cx("text-sm text-gray-500 border rounded p-4")}>
							No templates yet.
						</div>
					)}
				</div>
			</div>
		</div>

		{builderOpen && (
			<div className={cx("fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4")}> 
				<div className={cx("bg-white rounded shadow-xl w-full max-w-6xl p-4")}> 
					<div className={cx("flex items-center justify-between mb-2")}>
						<h3 className={cx("text-lg font-medium")}>Template Builder</h3>
						<button onClick={() => setBuilderOpen(false)} className={cx("px-2 py-1 text-sm rounded border")}>Close</button>
					</div>
					<TemplateBuilder open={builderOpen} onClose={() => setBuilderOpen(false)} value={builderValue} onSave={onBuilderSave} kind={kind} />
				</div>
			</div>
		)}
	</>
);
}
