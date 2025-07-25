-- FinSight Database Inspection Commands
-- Run these commands in MySQL Workbench or command line

-- 1. Connect to the database
USE finsight_db;

-- 2. Show all tables in the database
SHOW TABLES;

-- 3. Describe table structures
DESCRIBE portfolio;
DESCRIBE assets;
DESCRIBE performance_history;

-- 4. View all data in each table
SELECT * FROM portfolio;
SELECT * FROM assets;
SELECT * FROM performance_history;

-- 5. Get table creation statements (to see the full schema)
SHOW CREATE TABLE portfolio;
SHOW CREATE TABLE assets;
SHOW CREATE TABLE performance_history;

-- 6. Check table sizes and row counts
SELECT 
    TABLE_NAME,
    TABLE_ROWS,
    DATA_LENGTH,
    INDEX_LENGTH,
    (DATA_LENGTH + INDEX_LENGTH) AS total_size
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'finsight_db';

-- 7. View recent activity (last 5 performance records)
SELECT date, value, range_type 
FROM performance_history 
ORDER BY created_at DESC 
LIMIT 5;

-- 8. Calculate total portfolio value from assets
SELECT 
    SUM(value) as calculated_total,
    (SELECT total_value FROM portfolio LIMIT 1) as stored_total
FROM assets;
