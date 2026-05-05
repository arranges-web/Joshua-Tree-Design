-- Update department labels to new canonical names (idempotent; keyed by dept key).
UPDATE "departments" SET "label" = 'Lawn Department'  WHERE "key" = 'Lawn';
UPDATE "departments" SET "label" = 'Tree Department'  WHERE "key" = 'TreeService';
UPDATE "departments" SET "label" = 'Pest'             WHERE "key" = 'Pest';
UPDATE "departments" SET "label" = 'Land Department'  WHERE "key" = 'Landscaping';
