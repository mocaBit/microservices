require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5432/ecommerce',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const products = [
  // Hamburguesas
  {
    name: 'Hamburguesa Clásica',
    description: 'Jugosa hamburguesa de carne de res con lechuga, tomate, cebolla y nuestra salsa especial',
    price: 12.99,
    category: 'hamburguesas',
    image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400',
    stock_quantity: 50
  },
  {
    name: 'Hamburguesa BBQ',
    description: 'Hamburguesa con carne de res, bacon crujiente, cebolla caramelizada y salsa BBQ',
    price: 15.99,
    category: 'hamburguesas',
    image_url: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=400',
    stock_quantity: 30
  },
  {
    name: 'Hamburguesa Vegetariana',
    description: 'Deliciosa hamburguesa de quinoa y vegetales con aguacate y mayonesa vegana',
    price: 13.99,
    category: 'hamburguesas',
    image_url: 'https://images.unsplash.com/photo-1525059696034-4967a729002e?w=400',
    stock_quantity: 25
  },
  {
    name: 'Hamburguesa Doble Queso',
    description: 'Doble carne de res con queso cheddar y suizo, bacon y salsa especial',
    price: 18.99,
    category: 'hamburguesas',
    image_url: 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?w=400',
    stock_quantity: 40
  },

  // Pizzas
  {
    name: 'Pizza Margherita',
    description: 'Pizza clásica con salsa de tomate, mozzarella fresca y albahaca',
    price: 16.99,
    category: 'pizzas',
    image_url: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=400',
    stock_quantity: 35
  },
  {
    name: 'Pizza Pepperoni',
    description: 'Pizza con abundante pepperoni, mozzarella y salsa de tomate',
    price: 18.99,
    category: 'pizzas',
    image_url: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400',
    stock_quantity: 45
  },
  {
    name: 'Pizza Hawaiana',
    description: 'Pizza con jamón, piña, mozzarella y salsa de tomate',
    price: 19.99,
    category: 'pizzas',
    image_url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400',
    stock_quantity: 20
  },
  {
    name: 'Pizza Cuatro Quesos',
    description: 'Pizza gourmet con mozzarella, parmesano, gorgonzola y queso de cabra',
    price: 22.99,
    category: 'pizzas',
    image_url: 'https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?w=400',
    stock_quantity: 15
  },
  {
    name: 'Pizza Vegetariana Suprema',
    description: 'Pizza con pimientos, champiñones, cebolla, aceitunas y tomate',
    price: 20.99,
    category: 'pizzas',
    image_url: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400',
    stock_quantity: 25
  },

  // Tacos
  {
    name: 'Tacos al Pastor',
    description: 'Tres tacos con carne al pastor, piña, cebolla y cilantro',
    price: 11.99,
    category: 'tacos',
    image_url: 'https://images.unsplash.com/photo-1565299585323-38174c4a6471?w=400',
    stock_quantity: 60
  },
  {
    name: 'Tacos de Carnitas',
    description: 'Tres tacos con carnitas de cerdo, cebolla, cilantro y salsa verde',
    price: 12.99,
    category: 'tacos',
    image_url: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=400',
    stock_quantity: 55
  },
  {
    name: 'Tacos de Pollo',
    description: 'Tres tacos con pollo a la plancha, aguacate, pico de gallo',
    price: 10.99,
    category: 'tacos',
    image_url: 'https://images.unsplash.com/photo-1613514785940-daed07799d9b?w=400',
    stock_quantity: 70
  },

  // Bebidas
  {
    name: 'Coca Cola',
    description: 'Refresco clásico de cola, lata de 355ml',
    price: 2.99,
    category: 'bebidas',
    image_url: 'https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=400',
    stock_quantity: 100
  },
  {
    name: 'Agua Natural',
    description: 'Agua purificada, botella de 500ml',
    price: 1.99,
    category: 'bebidas',
    image_url: 'https://images.unsplash.com/photo-1523362628745-0c100150b504?w=400',
    stock_quantity: 150
  },
  {
    name: 'Jugo de Naranja Natural',
    description: 'Jugo de naranja recién exprimido, vaso de 300ml',
    price: 4.99,
    category: 'bebidas',
    image_url: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400',
    stock_quantity: 30
  },
  {
    name: 'Cerveza Artesanal IPA',
    description: 'Cerveza artesanal estilo IPA, botella de 355ml',
    price: 6.99,
    category: 'bebidas',
    image_url: 'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=400',
    stock_quantity: 40
  },

  // Postres
  {
    name: 'Brownie con Helado',
    description: 'Brownie de chocolate caliente con helado de vainilla y salsa de chocolate',
    price: 8.99,
    category: 'postres',
    image_url: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=400',
    stock_quantity: 20
  },
  {
    name: 'Cheesecake de Fresa',
    description: 'Porción de cheesecake cremoso con cobertura de fresas frescas',
    price: 7.99,
    category: 'postres',
    image_url: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=400',
    stock_quantity: 15
  },
  {
    name: 'Helado Artesanal',
    description: 'Tres bolas de helado artesanal (vainilla, chocolate, fresa)',
    price: 6.99,
    category: 'postres',
    image_url: 'https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400',
    stock_quantity: 25
  }
];

async function seedDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('Starting database seed...');
    
    // Clear existing products
    await client.query('DELETE FROM products');
    console.log('Cleared existing products');
    
    // Insert new products
    for (const product of products) {
      const query = `
        INSERT INTO products (
          name, description, price, category, image_url, 
          stock_quantity, available, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      `;
      
      const available = product.stock_quantity > 0;
      const values = [
        product.name,
        product.description,
        product.price,
        product.category,
        product.image_url,
        product.stock_quantity,
        available
      ];
      
      await client.query(query, values);
    }
    
    console.log(`Successfully seeded ${products.length} products`);
    
    // Show summary
    const summary = await client.query(`
      SELECT category, COUNT(*) as count, SUM(stock_quantity) as total_stock
      FROM products 
      GROUP BY category 
      ORDER BY category
    `);
    
    console.log('\\nSeed Summary:');
    console.log('Category        | Products | Total Stock');
    console.log('----------------|----------|------------');
    summary.rows.forEach(row => {
      console.log(`${row.category.padEnd(15)} | ${row.count.toString().padStart(8)} | ${row.total_stock.toString().padStart(11)}`);
    });
    
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the seed if called directly
if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('\\nDatabase seeding completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Database seeding failed:', error);
      process.exit(1);
    });
}

module.exports = { seedDatabase, products };