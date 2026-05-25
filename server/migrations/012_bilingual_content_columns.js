exports.up = (pgm) => {
    // exercise_library: name + instructions
    pgm.renameColumn('exercise_library', 'name', 'name_en');
    pgm.addColumns('exercise_library', {
        name_ar: { type: 'text', notNull: false, default: null },
        instructions_ar: { type: 'text', notNull: false, default: null },
    });
    pgm.renameColumn('exercise_library', 'instructions', 'instructions_en');

    // exercise_muscle_groups: name
    pgm.renameColumn('exercise_muscle_groups', 'name', 'name_en');
    pgm.addColumns('exercise_muscle_groups', {
        name_ar: { type: 'text', notNull: false, default: null },
    });

    // exercise_equipments: name
    pgm.renameColumn('exercise_equipments', 'name', 'name_en');
    pgm.addColumns('exercise_equipments', {
        name_ar: { type: 'text', notNull: false, default: null },
    });

    // food_categories: name
    pgm.renameColumn('food_categories', 'name', 'name_en');
    pgm.addColumns('food_categories', {
        name_ar: { type: 'varchar(100)', notNull: false, default: null },
    });

    // food_items: name
    pgm.renameColumn('food_items', 'name', 'name_en');
    pgm.addColumns('food_items', {
        name_ar: { type: 'varchar(255)', notNull: false, default: null },
    });

    // forms: title + description
    pgm.renameColumn('forms', 'title', 'title_en');
    pgm.addColumns('forms', {
        title_ar: { type: 'varchar(255)', notNull: false, default: null },
        description_ar: { type: 'text', notNull: false, default: null },
    });
    pgm.renameColumn('forms', 'description', 'description_en');

    // form_questions: label + placeholder + options_ar
    pgm.renameColumn('form_questions', 'label', 'label_en');
    pgm.addColumns('form_questions', {
        label_ar: { type: 'text', notNull: false, default: null },
        placeholder_ar: { type: 'text', notNull: false, default: null },
        // parallel JSONB for Arabic option labels (same array structure as options)
        options_ar: { type: 'jsonb', notNull: false, default: null },
    });
    pgm.renameColumn('form_questions', 'placeholder', 'placeholder_en');
};

exports.down = (pgm) => {
    // form_questions
    pgm.renameColumn('form_questions', 'placeholder_en', 'placeholder');
    pgm.dropColumns('form_questions', ['label_ar', 'placeholder_ar', 'options_ar']);
    pgm.renameColumn('form_questions', 'label_en', 'label');

    // forms
    pgm.renameColumn('forms', 'description_en', 'description');
    pgm.dropColumns('forms', ['title_ar', 'description_ar']);
    pgm.renameColumn('forms', 'title_en', 'title');

    // food_items
    pgm.dropColumns('food_items', ['name_ar']);
    pgm.renameColumn('food_items', 'name_en', 'name');

    // food_categories
    pgm.dropColumns('food_categories', ['name_ar']);
    pgm.renameColumn('food_categories', 'name_en', 'name');

    // exercise_equipments
    pgm.dropColumns('exercise_equipments', ['name_ar']);
    pgm.renameColumn('exercise_equipments', 'name_en', 'name');

    // exercise_muscle_groups
    pgm.dropColumns('exercise_muscle_groups', ['name_ar']);
    pgm.renameColumn('exercise_muscle_groups', 'name_en', 'name');

    // exercise_library
    pgm.renameColumn('exercise_library', 'instructions_en', 'instructions');
    pgm.dropColumns('exercise_library', ['name_ar', 'instructions_ar']);
    pgm.renameColumn('exercise_library', 'name_en', 'name');
};
