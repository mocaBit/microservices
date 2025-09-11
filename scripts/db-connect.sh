#!/bin/bash

# Script para conectarse a PostgreSQL
echo "Conectando a PostgreSQL..."
docker exec -it e-commerce-postgres-1 psql -U postgres -d ecommerce