import NameModal from "../NameModal";

function formatDate(dateStr) {
    const d = new Date(dateStr);
    const day = d.getDate();
    const month = d.toLocaleString("en-GB", { month: "short" });
    const year = d.getFullYear();
    const hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "pm" : "am";
    const hour12 = hours % 12 || 12;
    return `${day} ${month} ${year} at ${hour12}:${minutes} ${ampm}`;
}

function formatRelativeTime(dateStr) {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
}

export default function LeftPanel ({
    plans,
    selectedPlan,
    planNameModalOpen, setPlanNameModalOpen,
    planName, setPlanName,
    handleCreatePlan, handleSelectedPlan,
    handleDeletePlan, handleDuplicatePlan,
    sortOrder, setSortOrder,
}) {
    return (
        <div className="card w-full flex flex-col overflow-hidden min-h-0">
            {/* Header */}
            <div className="flex flex-row justify-center items-center gap-4 mb-4">
                <h2 className="flex-1 text-xl font-bold">Plans</h2>
                <button
                    className="flex-2 btn-primary px-4 w-full"
                    onClick={() => setPlanNameModalOpen(true)}
                >
                    + Create Plan
                </button>
            </div>

            {/* Sorting */}
            <div className="flex gap-2 mb-4 shrink-0">
                <span className="text-sm text-gray-500 flex items-center">Sort:</span>
                {[
                    { value: "created_desc", label: "Newest" },
                    { value: "created_asc",  label: "Oldest" },
                    { value: "updated_desc", label: "Last Edited" },
                ].map(({ value, label }) => (
                    <button
                        key={value}
                        onClick={() => setSortOrder(value)}
                        className={`cursor-pointer text-xs px-3 py-1 rounded-full border transition-colors ${
                            sortOrder === value
                                ? "bg-blue-500 border-blue-500 text-white"
                                : "border-gray-300 text-gray-500 hover:border-gray-400"
                        }`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* Modal For Creating Plan */}
            {planNameModalOpen && (
                <NameModal
                    title="Enter Plan Name"
                    value={planName}
                    placeholder="Plan Name"
                    submitText="Create"
                    onChange={setPlanName}
                    onSubmit={() => handleCreatePlan(planName)}
                    onClose={() => setPlanNameModalOpen(false)}
                />
            )}

            {/* Plans List */}
            <div className="flex-1 overflow-y-auto min-h-0">
                {plans.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-12">
                        <svg className="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <div>
                            <p className="font-semibold text-gray-500">No plans yet</p>
                            <p className="text-sm text-gray-400 mt-1">Create your first nutrition plan to get started</p>
                        </div>
                        <button
                            className="btn btn-primary px-6"
                            onClick={() => setPlanNameModalOpen(true)}
                        >
                            + Create Plan
                        </button>
                    </div>
                ) : plans.map((plan) => (
                <div
                    key={plan.id}
                    onClick={() => handleSelectedPlan(plan)}
                    className={`card px-6 py-4 mb-2 cursor-pointer transition-all duration-150 group ${selectedPlan && selectedPlan.id === plan.id ? "bg-blue-50 ring-2 ring-blue-200 shadow-sm" : "bg-gray-100"}`}
                >
                    {/* Row 1: index + name + status */}
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="flex-1 text-lg font-bold truncate">{plan.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded shrink-0 ${plan.status === "active" ? "bg-green-500 text-white" : "bg-gray-300 text-gray-700"}`}>
                            {plan.status}
                        </span>
                    </div>

                    {/* Row 2: cycle count + created date */}
                    <div className="flex items-center gap-3 text-sm text-gray-500 mb-3">
                        <span>{plan.cycle_count} {plan.cycle_count === 1 ? "cycle" : "cycles"}</span>
                        <span>·</span>
                        <span title={formatDate(plan.created_at)}>Created {formatRelativeTime(plan.created_at)}</span>
                        <span>·</span>
                        <span title={formatDate(plan.updated_at)}>Edited {formatRelativeTime(plan.updated_at)}</span>
                    </div>

                    {/* Row 3: action buttons */}
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                        <button
                            className="flex-1 btn btn-secondary text-sm py-1"
                            onClick={(e) => { e.stopPropagation(); handleDuplicatePlan(plan.id); }}
                        >
                            Duplicate
                        </button>
                        <button
                            className="btn btn-danger text-sm py-1 px-3"
                            onClick={(e) => { e.stopPropagation(); handleDeletePlan(plan.id); }}
                        >
                            Delete
                        </button>
                    </div>
                </div>
                ))}
            </div>

        </div>
    )
}