-- Create asset_history table
CREATE TABLE IF NOT EXISTS asset_history (
  date DATE PRIMARY KEY,
  cash_value DECIMAL(12,2),
  stock_value DECIMAL(12,2),
  bond_value DECIMAL(12,2),
  other_value DECIMAL(12,2)
);

-- Create current_assets table
CREATE TABLE IF NOT EXISTS current_assets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type ENUM('cash', 'stock', 'bond', 'other'),
  symbol VARCHAR(20),
  amount DECIMAL(12,2)
);

-- Insert 180 days of mock data into asset_history
INSERT INTO asset_history (date, cash_value, stock_value, bond_value, other_value)
VALUES
-- 180 days from today (2025-07-27) backwards
('2025-07-27', 6342.12, 12034.55, 3456.78, 2345.67),
('2025-07-26', 5123.45, 13456.78, 4567.89, 3456.78),
('2025-07-25', 6890.23, 11023.45, 2890.12, 1980.34),
('2025-07-24', 7000.00, 14999.99, 5999.99, 4999.99),
('2025-07-23', 4321.00, 9000.00, 2100.00, 1500.00),
('2025-07-22', 4987.12, 10034.55, 3456.78, 2345.67),
('2025-07-21', 6234.45, 14456.78, 5567.89, 4456.78),
('2025-07-20', 5890.23, 13023.45, 3890.12, 2980.34),
('2025-07-19', 6700.00, 13999.99, 5999.99, 4999.99),
('2025-07-18', 5321.00, 10000.00, 2100.00, 1500.00),
-- ...repeat for all dates down to 2025-01-29
('2025-01-29', 5234.12, 12034.55, 3456.78, 2345.67)
;

-- Insert mock data into current_assets
INSERT INTO current_assets (type, symbol, amount) VALUES
('cash', 'USD', 6543.21),
('stock', 'AAPL', 42.50),
('stock', 'TSLA', 18.75),
('stock', 'NVDA', 33.10),
('stock', 'MSFT', 27.80),
('bond', 'GOV10Y', 5120.00),
('bond', 'LQD', 3890.00),
('other', 'OTHER', 4100.00);
-- For stocks, choose 3–5 symbols from featured_stocks and assign random share counts
-- For bonds and other, assign random amounts in specified ranges
-- Expand/adjust as needed for more realistic mock data
