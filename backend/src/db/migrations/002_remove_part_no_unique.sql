-- Migration: Remove unique constraint from part_no to allow duplicate part numbers
-- Run this migration to allow multiple parts with the same part number

-- Drop the unique constraint on part_no if it exists
ALTER TABLE parts DROP CONSTRAINT IF EXISTS parts_part_no_key;
ALTER TABLE parts DROP CONSTRAINT IF EXISTS parts_partNo_key;

-- Also drop any unique index on part_no
DROP INDEX IF EXISTS idx_parts_part_no;
DROP INDEX IF EXISTS parts_part_no_key;

