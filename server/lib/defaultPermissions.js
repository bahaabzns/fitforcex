// Default JSONB permissions assigned to a workspace_member when they are added with a given role.
// Owner is NOT stored here — ownership is tracked via workspaces.owner_id and implicitly has all permissions.

const DEFAULT_PERMISSIONS = {
    manager: {
        clients:   { read: true,  write: true,  delete: true  },
        training:  { read: true,  write: true,  delete: true  },
        nutrition: { read: true,  write: true,  delete: true  },
        forms:     { read: true,  write: true,  delete: true  },
        finance:   { read: false, write: false, delete: false },
        databases: { read: true,  write: true,  delete: false },
        team:      { read: true,  write: true,  delete: false },
        insights:  { read: true,  write: true,  delete: false },
    },
    trainer: {
        clients:   { read: true,  write: true,  delete: false },
        training:  { read: true,  write: true,  delete: true  },
        nutrition: { read: false, write: false, delete: false },
        forms:     { read: true,  write: true,  delete: false },
        finance:   { read: false, write: false, delete: false },
        databases: { read: true,  write: true,  delete: false },
        team:      { read: false, write: false, delete: false },
        insights:  { read: true,  write: true,  delete: false },
    },
    nutritionist: {
        clients:   { read: true,  write: true,  delete: false },
        training:  { read: false, write: false, delete: false },
        nutrition: { read: true,  write: true,  delete: true  },
        forms:     { read: true,  write: true,  delete: false },
        finance:   { read: false, write: false, delete: false },
        databases: { read: true,  write: true,  delete: false },
        team:      { read: false, write: false, delete: false },
        insights:  { read: true,  write: true,  delete: false },
    },
    receptionist: {
        clients:   { read: true,  write: false, delete: false },
        training:  { read: false, write: false, delete: false },
        nutrition: { read: false, write: false, delete: false },
        forms:     { read: false, write: false, delete: false },
        finance:   { read: true,  write: true,  delete: false },
        databases: { read: false, write: false, delete: false },
        team:      { read: false, write: false, delete: false },
        insights:  { read: true,  write: true,  delete: false },
    },
    viewer: {
        clients:   { read: true,  write: false, delete: false },
        training:  { read: true,  write: false, delete: false },
        nutrition: { read: true,  write: false, delete: false },
        forms:     { read: false, write: false, delete: false },
        finance:   { read: false, write: false, delete: false },
        databases: { read: true,  write: false, delete: false },
        team:      { read: false, write: false, delete: false },
        insights:  { read: true,  write: false, delete: false },
    },
};

const VALID_ROLES = Object.keys(DEFAULT_PERMISSIONS);

module.exports = { DEFAULT_PERMISSIONS, VALID_ROLES };
