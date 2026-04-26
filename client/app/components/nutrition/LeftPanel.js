import NameModal from "../NameModal";

export default function LeftPanel ({ plans, selectedPlan, planNameModalOpen, setPlanNameModalOpen, planName, setPlanName, handleCreatePlan, handleSelectedPlan }) {
    return (
        <div className="card w-1/3 flex flex-col overflow-hidden min-h-0">
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
                {plans.map((plan) => (
                <div
                    key={plan.id}
                    onClick={() => handleSelectedPlan(plan)}
                    className={`card px-6 py-4 mb-2 cursor-pointer bg-gray-100 ${selectedPlan && selectedPlan.id === plan.id ? "bg-gray-200" : ""}`}
                >
                    <span
                    className={`px-2 py-1 rounded ${plan.status === "active" ? "bg-green-500" : "bg-gray-300"}`}
                    >
                    {plan.status}
                    </span>
                    <h3 className="text-lg font-bold">{plan.name}</h3>
                    <p className="text-sm text-gray-600">
                    Last Edited {new Date(plan.updated_at).toLocaleDateString()}
                    </p>
                </div>
                ))}
            </div>

        </div>
    )
}