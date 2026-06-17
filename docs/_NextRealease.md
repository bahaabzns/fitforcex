# Release 1 — Core Stability (Must Fix Before Scale)

## Bugs
    [ ] Fix close panel button in training builder
    [ ] Fix auto day open in training builder
    [ ] Client code is not correct
    [ ] Fix exercise thumbnail in client portal
    [ ] Fix sidebar in Arabic version
    [ ] Dark mode logo change
    [ ] Responsive fixes

    [x] Double active tabs in sidebar
    [x] Breadcrumb clickable
    [x] Fix language switcher in Arabic version
    [x] Client row selection only through checkbox

## UI Consistency
    [-] Unify all modals
    [ ] Unify datatables
    [ ] Unify all empty states
    [ ] Unify all page paddings
    [ ] Unify loaders (single skeleton/spinner)
    [ ] Unify alert dialogs
    [ ] Unify animations
    [ ] Use consistent search fields
    
    [x] Unify action icons

# Audit
    [ ] Authentication flows 
        [ ] Login / Register
        [ ] Reset password
    [ ] Team member invitation flow
    [ ] Subscription logic
    [ ] Decide where deleted clients should go !!
    [ ] Assign coaches in queue flow
    [ ] Roles & permissions
    [ ] Add exercise and food item databases to new accounts by default
    [ ] Add one demo client by default on new accounts
    [ ] New coach should define slug name on creating new account
    [ ] Standardize API error messages and toasts
    [ ] Autosave builders every X seconds
    [ ] Define freeze / expired client behavior
        [ ] Client portal access
        [ ] Nutrition access
        [ ] Training access
        [ ] Chat access
        [ ] Package exceptions

## Global
    [ ] Less confusing date formats

    [x] Arabic version

# I would define Release 1 as complete when:
> A coach can:
1. Register
2. Complete onboarding
3. Create a client
4. Build plans
5. Assign plans
6. Invite client
7. Manage subscription state
8. Use the system on mobile and Arabic without critical bugs