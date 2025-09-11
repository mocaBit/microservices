-- Insertar productos de prueba
INSERT INTO products (name, description, price, category, image_url, stock) VALUES
    ('Hamburguesa Clásica', 'Hamburguesa con carne, lechuga, tomate y cebolla', 8.99, 'hamburguesas', 'https://example.com/hamburguesa-clasica.jpg', 50),
    ('Hamburguesa Deluxe', 'Hamburguesa premium con queso, bacon y salsa especial', 12.99, 'hamburguesas', 'https://example.com/hamburguesa-deluxe.jpg', 30),
    ('Pizza Margherita', 'Pizza clásica con tomate, mozzarella y albahaca', 11.99, 'pizzas', 'https://example.com/pizza-margherita.jpg', 25),
    ('Pizza Pepperoni', 'Pizza con pepperoni y queso mozzarella', 13.99, 'pizzas', 'https://example.com/pizza-pepperoni.jpg', 20),
    ('Pizza Vegetariana', 'Pizza con vegetales frescos y queso', 12.99, 'pizzas', 'https://example.com/pizza-vegetariana.jpg', 15),
    ('Tacos de Pollo', 'Tres tacos de pollo con guacamole', 9.99, 'mexicana', 'https://example.com/tacos-pollo.jpg', 40),
    ('Burrito de Carne', 'Burrito grande con carne, frijoles y arroz', 10.99, 'mexicana', 'https://example.com/burrito-carne.jpg', 35),
    ('Coca Cola', 'Refresco de cola 355ml', 2.50, 'bebidas', 'https://example.com/coca-cola.jpg', 100),
    ('Agua Natural', 'Botella de agua 500ml', 1.50, 'bebidas', 'https://example.com/agua.jpg', 150),
    ('Papas Fritas', 'Porción de papas fritas crujientes', 4.99, 'acompañamientos', 'https://example.com/papas-fritas.jpg', 60);

-- Usuario de prueba (password: "password123" hasheado)
INSERT INTO users (email, password_hash, name) VALUES
    ('test@example.com', '$2b$10$K8BvF8l8GX1nF1F8F1F8FuF8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8', 'Usuario de Prueba'),
    ('admin@example.com', '$2b$10$K8BvF8l8GX1nF1F8F1F8FuF8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8', 'Administrador');