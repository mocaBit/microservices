#!/bin/bash

# Script para conectarse a Redis CLI
echo "Conectando a Redis..."
docker exec -it e-commerce-redis-1 redis-cli