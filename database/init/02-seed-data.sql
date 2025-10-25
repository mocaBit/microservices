-- =====================================================
-- E-COMMERCE SEED DATA
-- =====================================================
-- This script inserts initial test data
-- =====================================================

-- Test users (password: "password123" hashed with bcrypt)
INSERT INTO users (email, password_hash, name) VALUES
    ('test@example.com', '$2b$10$K8BvF8l8GX1nF1F8F1F8FuF8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8', 'Test User'),
    ('admin@example.com', '$2b$10$K8BvF8l8GX1nF1F8F1F8FuF8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8', 'Administrator');

-- Sample products
INSERT INTO products (name, description, price, category, image_url, stock_quantity) VALUES
    -- Burgers
    ('Classic Burger', 'Juicy beef patty with lettuce, tomato, and onion', 8.99, 'burgers', 'https://example.com/classic-burger.jpg', 50),
    ('Deluxe Burger', 'Premium burger with cheese, bacon, and special sauce', 12.99, 'burgers', 'https://example.com/deluxe-burger.jpg', 30),
    ('Veggie Burger', 'Plant-based patty with fresh vegetables', 9.99, 'burgers', 'https://example.com/veggie-burger.jpg', 25),

    -- Pizzas
    ('Margherita Pizza', 'Classic pizza with tomato, mozzarella, and basil', 11.99, 'pizzas', 'https://example.com/margherita-pizza.jpg', 25),
    ('Pepperoni Pizza', 'Pizza with pepperoni and mozzarella cheese', 13.99, 'pizzas', 'https://example.com/pepperoni-pizza.jpg', 20),
    ('Vegetarian Pizza', 'Fresh vegetables and cheese on crispy crust', 12.99, 'pizzas', 'https://example.com/vegetarian-pizza.jpg', 15),
    ('BBQ Chicken Pizza', 'BBQ sauce, grilled chicken, red onions, and cilantro', 14.99, 'pizzas', 'https://example.com/bbq-chicken-pizza.jpg', 18),

    -- Mexican Food
    ('Chicken Tacos', 'Three soft tacos with grilled chicken and guacamole', 9.99, 'mexican', 'https://example.com/chicken-tacos.jpg', 40),
    ('Beef Burrito', 'Large burrito with beef, beans, and rice', 10.99, 'mexican', 'https://example.com/beef-burrito.jpg', 35),
    ('Cheese Quesadilla', 'Grilled tortilla filled with melted cheese', 7.99, 'mexican', 'https://example.com/quesadilla.jpg', 45),
    ('Nachos Supreme', 'Crispy tortilla chips with cheese, jalapeños, and sour cream', 8.99, 'mexican', 'https://example.com/nachos.jpg', 30),

    -- Beverages
    ('Coca Cola', 'Classic cola drink 355ml', 2.50, 'beverages', 'https://example.com/coca-cola.jpg', 100),
    ('Orange Juice', 'Fresh squeezed orange juice 300ml', 3.50, 'beverages', 'https://example.com/orange-juice.jpg', 80),
    ('Bottled Water', 'Pure spring water 500ml', 1.50, 'beverages', 'https://example.com/water.jpg', 150),
    ('Iced Tea', 'Refreshing iced tea with lemon 400ml', 2.99, 'beverages', 'https://example.com/iced-tea.jpg', 70),

    -- Sides
    ('French Fries', 'Crispy golden french fries', 4.99, 'sides', 'https://example.com/french-fries.jpg', 60),
    ('Onion Rings', 'Breaded and fried onion rings', 5.99, 'sides', 'https://example.com/onion-rings.jpg', 40),
    ('Mozzarella Sticks', 'Fried mozzarella sticks with marinara sauce', 6.99, 'sides', 'https://example.com/mozzarella-sticks.jpg', 35),
    ('Caesar Salad', 'Fresh romaine lettuce with Caesar dressing and croutons', 7.99, 'sides', 'https://example.com/caesar-salad.jpg', 25),

    -- Desserts
    ('Chocolate Brownie', 'Warm chocolate brownie with vanilla ice cream', 5.99, 'desserts', 'https://example.com/brownie.jpg', 50),
    ('Cheesecake', 'Classic New York style cheesecake', 6.99, 'desserts', 'https://example.com/cheesecake.jpg', 30),
    ('Apple Pie', 'Homemade apple pie with cinnamon', 5.49, 'desserts', 'https://example.com/apple-pie.jpg', 20);
