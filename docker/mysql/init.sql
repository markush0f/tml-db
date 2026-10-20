SET NAMES utf8mb4;
USE tml_demo;
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE
);
CREATE TABLE products (
  id INTEGER PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  price DECIMAL(10,2) NOT NULL
);
CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);
INSERT INTO users VALUES
  (1, 'Sofía', 'sofia@example.test'),
  (2, 'Diego', 'diego@example.test'),
  (3, 'Elena', 'elena@example.test');
INSERT INTO products VALUES (1, 'Teclado', 49.90), (2, 'Monitor', 199.00);
INSERT INTO orders VALUES (1, 1, 1, 2), (2, 2, 2, 1);
REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'tml_reader'@'%';
GRANT SELECT ON tml_demo.* TO 'tml_reader'@'%';
