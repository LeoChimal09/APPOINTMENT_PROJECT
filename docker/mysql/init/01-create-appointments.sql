CREATE TABLE IF NOT EXISTS appointments (
  ref VARCHAR(32) PRIMARY KEY,
  created_at VARCHAR(40) NOT NULL,
  customer_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  owner_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  status ENUM('pending', 'accepted', 'denied', 'cancelled', 'completed') NOT NULL DEFAULT 'pending',
  appointment_date_iso VARCHAR(40) NOT NULL,
  appointment_date_label VARCHAR(80) NOT NULL,
  appointment_time VARCHAR(20) NOT NULL,
  service VARCHAR(120) NOT NULL,
  barber VARCHAR(120) NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(40) NOT NULL,
  notes TEXT NULL
);

CREATE INDEX idx_appointments_customer_email ON appointments (customer_email);
CREATE INDEX idx_appointments_status ON appointments (status);
CREATE INDEX idx_appointments_date_iso ON appointments (appointment_date_iso);

CREATE TABLE IF NOT EXISTS customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  created_at VARCHAR(40) NOT NULL
);

CREATE TABLE IF NOT EXISTS customer_email_verification_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  token_hash VARCHAR(128) NOT NULL UNIQUE,
  name VARCHAR(255),
  expires_at VARCHAR(40) NOT NULL,
  created_at VARCHAR(40) NOT NULL
);

CREATE INDEX idx_verification_tokens_email ON customer_email_verification_tokens (email);
