// Plans Queue — custom labels. Workspace-shared, one label per queue item,
// name + a coach-chosen color. A real FK (unlike the muscle-group/food-
// category string-matched-by-name precedent) since this is a clean new
// addition with no existing denormalized-string data to stay compatible with.
// SET NULL on delete: removing a label un-labels affected items rather than
// blocking the delete or cascading, matching how assigned_to already treats
// a removed reference elsewhere in this table.
exports.up = (pgm) => {
    pgm.createTable('plans_queue_labels', {
        id:           { type: 'text', primaryKey: true },
        workspace_id: { type: 'text', notNull: true, references: 'workspaces', onDelete: 'CASCADE' },
        name:         { type: 'text', notNull: true },
        color:        { type: 'text', notNull: true },
        created_at:   { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
        updated_at:   { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    });
    pgm.addConstraint('plans_queue_labels', 'plans_queue_labels_workspace_id_name_key', {
        unique: ['workspace_id', 'name'],
    });
    pgm.createIndex('plans_queue_labels', 'workspace_id');

    pgm.addColumn('form_requests', {
        label_id: { type: 'text', references: 'plans_queue_labels', onDelete: 'SET NULL' },
    });
    pgm.createIndex('form_requests', 'label_id');
};

exports.down = (pgm) => {
    pgm.dropColumn('form_requests', ['label_id']);
    pgm.dropTable('plans_queue_labels');
};
