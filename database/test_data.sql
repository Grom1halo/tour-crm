-- Test data for Tour CRM System
-- Run this AFTER schema.sql

-- Insert test users with hashed password 'password123' (use bcrypt in production)
INSERT INTO users (username, full_name, role, password_hash, commission_percentage) VALUES
('manager1', 'John Smith', 'manager', '$2b$10$XQw0TKJ5TKJ5TKJ5TKJ5TKJ5TKJ5TKJ5TKJ5TKJ5TKJ5TKJ5TKJ5T', 15.00),
('manager2', 'Sarah Johnson', 'manager', '$2b$10$XQw0TKJ5TKJ5TKJ5TKJ5TKJ5TKJ5TKJ5TKJ5TKJ5TKJ5TKJ5TKJ5T', 12.00),
('hotline1', 'Mike Wilson', 'hotline', '$2b$10$XQw0TKJ5TKJ5TKJ5TKJ5TKJ5TKJ5TKJ5TKJ5TKJ5TKJ5TKJ5TKJ5T', 0),
('accountant1', 'Lisa Chen', 'accountant', '$2b$10$XQw0TKJ5TKJ5TKJ5TKJ5TKJ5TKJ5TKJ5TKJ5TKJ5TKJ5TKJ5TKJ5T', 0);

-- Insert test clients (will need manager IDs from previous insert)
INSERT INTO clients (name, phone, manager_id) VALUES
('Ivan Petrov', '+7-900-123-4567', 2),
('Anna Volkova', '+7-905-234-5678', 2),
('Dmitry Sokolov', '+7-910-345-6789', 2),
('Elena Novikova', '+7-915-456-7890', 3),
('Sergey Ivanov', '+7-920-567-8901', 3);

-- Already inserted companies and tours in schema.sql
-- Add some more tours
INSERT INTO tours (name, tour_type) VALUES
('Similan Islands Snorkeling', 'group'),
('ATV Adventure Phuket', 'group'),
('Private Longtail Boat', 'individual'),
('Racha Island Day Trip', 'tourflot'),
('Koh Khai Nok Snorkeling', 'tourflot');

-- Insert tour prices for current period (valid for 6 months)
-- Company 1 (Phuket Adventures) - James Bond Island
INSERT INTO tour_prices (
    tour_id, company_id, valid_from, valid_to,
    adult_net, child_net, infant_net, transfer_net, other_net,
    adult_sale, child_sale, infant_sale, transfer_sale, other_sale
) VALUES
(1, 1, '2026-01-01', '2026-06-30',
 1200, 800, 0, 300, 0,
 1800, 1200, 0, 400, 0);

-- Company 2 (Island Tours Co) - Phi Phi Island
INSERT INTO tour_prices (
    tour_id, company_id, valid_from, valid_to,
    adult_net, child_net, infant_net, transfer_net, other_net,
    adult_sale, child_sale, infant_sale, transfer_sale, other_sale
) VALUES
(2, 2, '2026-01-01', '2026-06-30',
 1500, 1000, 0, 350, 0,
 2200, 1500, 0, 500, 0);

-- Company 3 (Sea Explorer) - Similan Islands
INSERT INTO tour_prices (
    tour_id, company_id, valid_from, valid_to,
    adult_net, child_net, infant_net, transfer_net, other_net,
    adult_sale, child_sale, infant_sale, transfer_sale, other_sale
) VALUES
(5, 3, '2026-01-01', '2026-06-30',
 2500, 2000, 0, 500, 0,
 3500, 2800, 0, 700, 0);

-- Insert sample vouchers
-- Voucher 1: Paid
INSERT INTO vouchers (
    voucher_number, tour_type, client_id, manager_id, company_id, tour_id,
    tour_date, tour_time, hotel_name, room_number,
    adults, children, infants,
    adult_net, child_net, infant_net, transfer_net, other_net,
    adult_sale, child_sale, infant_sale, transfer_sale, other_sale,
    agent_id, agent_commission_percentage, remarks
) VALUES
('V2601-0001', 'group', 1, 2, 1, 1,
 '2026-02-15', '08:00', 'Patong Beach Resort', '305',
 2, 1, 0,
 1200, 800, 0, 300, 0,
 1800, 1200, 0, 400, 0,
 1, 10.00, 'Client requested early pickup');

-- Add payment for voucher 1 (full payment)
INSERT INTO payments (voucher_id, payment_date, amount, payment_method, created_by)
VALUES (1, '2026-02-10 14:30:00', 4200, 'Оплата в офисе', 2);

-- Voucher 2: Partial payment
INSERT INTO vouchers (
    voucher_number, tour_type, client_id, manager_id, company_id, tour_id,
    tour_date, tour_time, hotel_name, room_number,
    adults, children, infants,
    adult_net, child_net, infant_net, transfer_net, other_net,
    adult_sale, child_sale, infant_sale, transfer_sale, other_sale,
    remarks
) VALUES
('V2601-0002', 'group', 2, 2, 2, 2,
 '2026-02-20', '09:00', 'Karon Sea Breeze', '102',
 2, 0, 1,
 1500, 0, 0, 350, 0,
 2200, 0, 0, 500, 0,
 'VIP service requested');

-- Add partial payment for voucher 2
INSERT INTO payments (voucher_id, payment_date, amount, payment_method, created_by)
VALUES (2, '2026-02-12 16:00:00', 2000, 'Тайский счёт', 2);

-- Voucher 3: Unpaid
INSERT INTO vouchers (
    voucher_number, tour_type, client_id, manager_id, company_id, tour_id,
    tour_date, tour_time, hotel_name, room_number,
    adults, children, infants,
    adult_net, child_net, infant_net, transfer_net, other_net,
    adult_sale, child_sale, infant_sale, transfer_sale, other_sale
) VALUES
('V2601-0003', 'group', 3, 2, 3, 5,
 '2026-03-01', '06:30', 'Kata Beach Hotel', '501',
 2, 2, 0,
 2500, 2000, 0, 500, 0,
 3500, 2800, 0, 700, 0);

-- Voucher 4: Individual tour, paid
INSERT INTO vouchers (
    voucher_number, tour_type, client_id, manager_id, company_id, tour_id,
    tour_date, tour_time, hotel_name, room_number,
    adults, children, infants,
    adult_net, child_net, infant_net, transfer_net, other_net,
    adult_sale, child_sale, infant_sale, transfer_sale, other_sale,
    agent_id, agent_commission_percentage
) VALUES
('V2601-0004', 'individual', 4, 3, 1, 3,
 '2026-02-18', '10:00', 'Luxury Villa Phuket', 'Villa 5',
 4, 0, 0,
 3000, 0, 0, 500, 200,
 4500, 0, 0, 800, 200,
 2, 5.00);

INSERT INTO payments (voucher_id, payment_date, amount, payment_method, created_by)
VALUES (4, '2026-02-14 11:00:00', 5500, 'Usdt обменник', 3);

-- Summary statistics after insertion:
SELECT 'Database populated successfully!' as status;
SELECT 'Total users: ' || COUNT(*) FROM users;
SELECT 'Total clients: ' || COUNT(*) FROM clients;
SELECT 'Total companies: ' || COUNT(*) FROM companies;
SELECT 'Total tours: ' || COUNT(*) FROM tours;
SELECT 'Total vouchers: ' || COUNT(*) FROM vouchers;
SELECT 'Total payments: ' || COUNT(*) FROM payments;
