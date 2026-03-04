-- Tour CRM Database Schema

-- Users table (all system users)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('manager', 'hotline', 'accountant', 'admin')),
    commission_percentage DECIMAL(5,2) DEFAULT 0, -- For managers
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Clients table
CREATE TABLE clients (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    manager_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(phone, manager_id)
);

-- Companies (tour operators)
CREATE TABLE companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tours
CREATE TABLE tours (
    id SERIAL PRIMARY KEY,
    name VARCHAR(300) NOT NULL,
    tour_type VARCHAR(50) NOT NULL CHECK (tour_type IN ('group', 'individual', 'tourflot')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tour prices (with date ranges)
CREATE TABLE tour_prices (
    id SERIAL PRIMARY KEY,
    tour_id INTEGER REFERENCES tours(id),
    company_id INTEGER REFERENCES companies(id),
    valid_from DATE NOT NULL,
    valid_to DATE NOT NULL,
    
    -- Net prices (what we pay to company)
    adult_net DECIMAL(10,2) DEFAULT 0,
    child_net DECIMAL(10,2) DEFAULT 0,
    infant_net DECIMAL(10,2) DEFAULT 0,
    transfer_net DECIMAL(10,2) DEFAULT 0,
    other_net DECIMAL(10,2) DEFAULT 0,
    
    -- Sale prices (what client pays)
    adult_sale DECIMAL(10,2) DEFAULT 0,
    child_sale DECIMAL(10,2) DEFAULT 0,
    infant_sale DECIMAL(10,2) DEFAULT 0,
    transfer_sale DECIMAL(10,2) DEFAULT 0,
    other_sale DECIMAL(10,2) DEFAULT 0,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tour_id, company_id, valid_from, valid_to)
);

-- Agents (partners who bring clients)
CREATE TABLE agents (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    commission_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vouchers
CREATE TABLE vouchers (
    id SERIAL PRIMARY KEY,
    voucher_number VARCHAR(50) UNIQUE NOT NULL,
    tour_type VARCHAR(50) NOT NULL CHECK (tour_type IN ('group', 'individual', 'tourflot')),
    
    -- Relations
    client_id INTEGER REFERENCES clients(id),
    manager_id INTEGER REFERENCES users(id),
    company_id INTEGER REFERENCES companies(id),
    tour_id INTEGER REFERENCES tours(id),
    agent_id INTEGER REFERENCES agents(id),
    
    -- Tour details
    tour_date DATE NOT NULL,
    tour_time TIME,
    hotel_name VARCHAR(300),
    room_number VARCHAR(50),
    
    -- Quantities
    adults INTEGER DEFAULT 0,
    children INTEGER DEFAULT 0,
    infants INTEGER DEFAULT 0,
    
    -- Net prices (editable, initially from tour_prices)
    adult_net DECIMAL(10,2) DEFAULT 0,
    child_net DECIMAL(10,2) DEFAULT 0,
    infant_net DECIMAL(10,2) DEFAULT 0,
    transfer_net DECIMAL(10,2) DEFAULT 0,
    other_net DECIMAL(10,2) DEFAULT 0,
    
    -- Sale prices (editable, initially from tour_prices)
    adult_sale DECIMAL(10,2) DEFAULT 0,
    child_sale DECIMAL(10,2) DEFAULT 0,
    infant_sale DECIMAL(10,2) DEFAULT 0,
    transfer_sale DECIMAL(10,2) DEFAULT 0,
    other_sale DECIMAL(10,2) DEFAULT 0,
    
    -- Calculated fields (updated by triggers)
    total_net DECIMAL(10,2) DEFAULT 0,
    total_sale DECIMAL(10,2) DEFAULT 0,
    paid_to_agency DECIMAL(10,2) DEFAULT 0,
    cash_on_tour DECIMAL(10,2) DEFAULT 0,
    
    -- Payment status
    payment_status VARCHAR(50) DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
    
    -- Agent commission
    agent_commission_percentage DECIMAL(5,2) DEFAULT 0,
    
    -- Other
    remarks TEXT,
    
    -- Soft delete
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMP,
    deleted_by INTEGER REFERENCES users(id),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payments
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    voucher_id INTEGER REFERENCES vouchers(id),
    payment_date TIMESTAMP NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(100) NOT NULL,
    company_id INTEGER REFERENCES companies(id), -- If paid to specific company
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Accountant data (additional fields for payments report)
CREATE TABLE voucher_accounting (
    id SERIAL PRIMARY KEY,
    voucher_id INTEGER REFERENCES vouchers(id) UNIQUE,
    invoice_payment_date DATE,
    agent_payment_date DATE,
    income_thb DECIMAL(10,2) DEFAULT 0,
    income_rub DECIMAL(10,2) DEFAULT 0,
    bank_name VARCHAR(200),
    nett_price_override DECIMAL(10,2), -- If accountant manually changes nett
    updated_by INTEGER REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_clients_manager ON clients(manager_id);
CREATE INDEX idx_clients_phone ON clients(phone);
CREATE INDEX idx_vouchers_manager ON vouchers(manager_id);
CREATE INDEX idx_vouchers_tour_date ON vouchers(tour_date);
CREATE INDEX idx_vouchers_created ON vouchers(created_at);
CREATE INDEX idx_vouchers_deleted ON vouchers(is_deleted);
CREATE INDEX idx_vouchers_number ON vouchers(voucher_number);
CREATE INDEX idx_payments_voucher ON payments(voucher_id);
CREATE INDEX idx_tour_prices_dates ON tour_prices(valid_from, valid_to);

-- Function to update voucher totals
CREATE OR REPLACE FUNCTION update_voucher_totals()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate total net
    NEW.total_net = 
        (NEW.adults * NEW.adult_net) +
        (NEW.children * NEW.child_net) +
        (NEW.infants * NEW.infant_net) +
        ((NEW.adults + NEW.children) * NEW.transfer_net) +
        NEW.other_net;
    
    -- Calculate total sale
    NEW.total_sale = 
        (NEW.adults * NEW.adult_sale) +
        (NEW.children * NEW.child_sale) +
        (NEW.infants * NEW.infant_sale) +
        ((NEW.adults + NEW.children) * NEW.transfer_sale) +
        NEW.other_sale;
    
    -- Calculate cash on tour
    NEW.cash_on_tour = NEW.total_sale - NEW.paid_to_agency;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_voucher_totals
    BEFORE INSERT OR UPDATE ON vouchers
    FOR EACH ROW
    EXECUTE FUNCTION update_voucher_totals();

-- Function to update paid_to_agency when payments change
CREATE OR REPLACE FUNCTION update_voucher_paid_amount()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE vouchers
    SET 
        paid_to_agency = (
            SELECT COALESCE(SUM(amount), 0)
            FROM payments
            WHERE voucher_id = COALESCE(NEW.voucher_id, OLD.voucher_id)
        ),
        payment_status = CASE
            WHEN (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE voucher_id = COALESCE(NEW.voucher_id, OLD.voucher_id)) = 0 THEN 'unpaid'
            WHEN (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE voucher_id = COALESCE(NEW.voucher_id, OLD.voucher_id)) >= total_sale THEN 'paid'
            ELSE 'partial'
        END
    WHERE id = COALESCE(NEW.voucher_id, OLD.voucher_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_voucher_paid
    AFTER INSERT OR UPDATE OR DELETE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_voucher_paid_amount();

-- Insert default admin user (password: admin123)
INSERT INTO users (username, full_name, role, password_hash) 
VALUES ('admin', 'Administrator', 'admin', '$2b$10$rKZLQQjGVGV7qGV7qGV7qOXxY5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y');

-- Insert sample data for testing
INSERT INTO companies (name) VALUES 
    ('Phuket Adventures'),
    ('Island Tours Co'),
    ('Sea Explorer');

INSERT INTO tours (name, tour_type) VALUES
    ('James Bond Island', 'group'),
    ('Phi Phi Island Tour', 'group'),
    ('Private Yacht Charter', 'individual'),
    ('Sunset Dinner Cruise', 'tourflot');

INSERT INTO agents (name, commission_percentage) VALUES
    ('Travel Partner Agency', 10.00),
    ('Tourist Info Desk', 5.00);
