// Where the guide arrow points for each getting-started step.
//
// A step is a list of targets ordered from the final click (most specific) to the first click on the way there.
// The guide always points at the first target that is currently visible, so the arrow walks the coach through the
// app on its own, wherever they are. For the diet: Clients, the demo client, the Nutrition tab, the plan in the
// plans panel, a meal, the amount field, Save, and the confirmation. The guide closes when the step is done.
//
// Targets are CSS selectors: real links by href, plus `data-guide` attributes on buttons that have no stable address.
// `label` is a key in messages `guide.*`. `skipOnPath` hides a target on pages where it would lead the coach astray.

// Steps that finish with something observable on the server (a saved plan, a new client, a payment, the client app
// opened): the guide closes the moment the checklist reports them done. The other steps close on their last click.
export const STOP_WHEN_DONE = new Set(['edit_demo', 'view_app', 'add_form', 'add_questions', 'create_package', 'add_client', 'record_payment']);

// Steps whose targets all live in the sidebar, which can be collapsed on a desktop and is a slide-over on a phone.
const SIDEBAR_ONLY = new Set(['open_queue', 'view_app', 'share_portal']);

export function guideTargets({ key, slug, demoClientId, firstRealClientId, demoLogin }) {
    const base = `/${slug}`;
    const link = (path) => `a[href="${base}${path}"]`;
    const demoPath = demoClientId ? `${base}/clients/${demoClientId}` : null;
    const demoLink = demoPath ? { selector: `a[href="${demoPath}"]`, label: 'openDemo' } : null;
    const realLink = firstRealClientId ? { selector: link(`/clients/${firstRealClientId}`), label: 'openClient' } : null;
    const clientsNav = { selector: link('/clients'), label: 'goClients' };
    // Payments belong to a real client, so never send the coach to record one on the demo client.
    const notOnDemo = demoPath ? { skipOnPath: demoPath } : {};

    const bySteps = {
        edit_demo: [
            { selector: '[data-guide="plan-save-confirm"]', label: 'confirmSave' },
            { selector: '[data-guide="plan-save"]', label: 'saveHere' },
            { selector: '[data-guide="meal-amount"]', label: 'changeAmount' },
            { selector: '[data-guide="nutrition-meal"]', label: 'pickMeal' },
            { selector: '[data-guide="nutrition-plan"]', label: 'pickPlan' },
            { selector: '[data-guide="client-tab-nutrition"]', label: 'tabNutrition' },
            demoLink,
            clientsNav,
        ],
        // The client app is opened from the sidebar's client portal link, exactly as with a real client; the demo login
        // goes in the label because the coach has to sign in as the demo client.
        view_app: [
            { selector: '[data-guide="portal-link"]', label: 'openApp', values: demoLogin ?? undefined },
        ],
        open_queue: [
            { selector: link('/plans-queue'), label: 'queueLink', final: true },
        ],
        // A form is added either by building one or by importing it from Google Forms; both buttons sit side by side, so the
        // arrow points at "new form" and its label mentions the import. Inside the import dialog it points at the submit.
        add_form: [
            { selector: '[data-guide="form-import-submit"]', label: 'importSubmit' },
            { selector: '[data-guide="form-create"]', label: 'createForm' },
            { selector: link('/forms'), label: 'formsLink' },
            { selector: '[data-guide="nav-forms"]', label: 'formsMenu' },
        ],
        // Inside the builder: pick the form, add a question (choose its type), then Save. The arrow only asks for Save once
        // there is something to save.
        add_questions: [
            { selector: '[data-guide="form-save"]', label: 'formSave' },
            { selector: '[data-guide="question-type"]', label: 'questionType' },
            { selector: '[data-guide="question-new"]', label: 'questionNew' },
            { selector: '[data-guide="form-item"]', label: 'formItem' },
            { selector: link('/forms'), label: 'formsLink' },
            { selector: '[data-guide="nav-forms"]', label: 'formsMenu' },
        ],
        // Inside the new-package form the arrow walks the empty required fields in order, then the submit button.
        create_package: [
            { selector: '[data-guide="pkg-name"]', label: 'pkgName', whenEmpty: true },
            { selector: '[data-guide="pkg-variation"]', label: 'pkgVariation', whenEmpty: true },
            { selector: '[data-guide="pkg-duration"]', label: 'pkgDuration', whenEmpty: true },
            { selector: '[data-guide="pkg-price"]', label: 'pkgPrice', whenEmpty: true },
            { selector: '[data-guide="pkg-submit"]', label: 'pkgSubmit' },
            { selector: '[data-guide="new-package"]', label: 'newPackage' },
            { selector: link('/finance/packages'), label: 'packagesLink' },
            { selector: '[data-guide="nav-finance"]', label: 'financeMenu' },
        ],
        add_client: [
            { selector: '[data-guide="client-form-submit"]', label: 'clientFormSubmit' },
            { selector: '[data-guide="client-form-next"]', label: 'clientFormNext' },
            { selector: '[data-guide="add-client"]', label: 'addClient' },
            clientsNav,
        ],
        share_portal: [
            { selector: '[data-guide="portal-copy"]', label: 'portalCopy', final: true },
        ],
        record_payment: [
            { selector: '[data-guide="transaction-submit"]', label: 'transactionSubmit' },
            { selector: '[data-guide="add-transaction"]', label: 'addTransaction', ...notOnDemo },
            { selector: '[data-guide="client-tab-transactions"]', label: 'tabTransactions', ...notOnDemo },
            realLink,
            clientsNav,
        ],
    };

    // Targets inside the slide-over menu cannot be seen on a phone until it is open, so the menu button is the last
    // resort. On a desktop it is only used by steps that live entirely in the sidebar (it expands a collapsed one).
    const menuButton = { selector: '[data-guide="menu-toggle"]', label: 'openMenu', phoneOnly: !SIDEBAR_ONLY.has(key) };
    return [...(bySteps[key] ?? []).filter(Boolean), menuButton];
}
