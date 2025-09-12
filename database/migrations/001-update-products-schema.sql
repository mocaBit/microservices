-- Migration: Update products table schema
-- Add stock_quantity and available columns, migrate data from stock column

-- Add new columns
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS available BOOLEAN DEFAULT true;

-- Migrate data from old stock column to new stock_quantity column (if stock column exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'stock') THEN
        UPDATE products SET stock_quantity = stock;
        UPDATE products SET available = (stock_quantity > 0);
        
        -- Drop the old stock column after migration
        ALTER TABLE products DROP COLUMN stock;
    END IF;
END $$;

-- Update available based on stock_quantity for existing records
UPDATE products SET available = (stock_quantity > 0);

-- Add indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_products_stock_quantity ON products(stock_quantity);
CREATE INDEX IF NOT EXISTS idx_products_available ON products(available);

-- Verify migration
SELECT 'Migration completed successfully' as status;