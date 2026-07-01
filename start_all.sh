#!/bin/bash
set -e

# Define color codes for pretty output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}===============================================${NC}"
echo -e "${BLUE}   Starting PMI, OMS, and WMS Integrated Stack   ${NC}"
echo -e "${BLUE}===============================================${NC}"

# Step 1: Ensure external Docker networks exist
echo -e "\n${YELLOW}Step 1: Checking and creating Docker networks...${NC}"
docker network create pmi_default || true
docker network create oms_default || true
docker network create wms_default || true

# Step 2: Build and start the projects using compose
echo -e "\n${YELLOW}Step 2: Starting services via Docker Compose...${NC}"

echo -e "${BLUE}Starting PMI...${NC}"
docker compose -f PMI/docker-compose.yml up -d --build

echo -e "${BLUE}Starting OMS (Production/No-Volume mode)...${NC}"
docker compose -f OMS/docker-compose.prod.yml up -d --build

echo -e "${BLUE}Starting WMS (Production/No-Volume mode)...${NC}"
docker compose -f WMS/docker-compose.prod.yml up -d --build

# Step 3: Wait for services to be ready
echo -e "\n${YELLOW}Step 3: Waiting for APIs to respond...${NC}"
python3 -c '
import socket
import time
import sys

ports = {
    18100: "PMI API",
    18101: "OMS API",
    18102: "WMS API"
}

start_time = time.time()
timeout = 120  # 2 minutes timeout

for port, name in ports.items():
    print(f"Waiting for {name} on port {port}...")
    while True:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=2):
                print(f"-> {name} is up and accepting connections.")
                break
        except (ConnectionRefusedError, socket.timeout, OSError):
            if time.time() - start_time > timeout:
                print(f"Error: Timeout waiting for {name} on port {port}.")
                sys.exit(1)
            time.sleep(2)

print("All API ports are open! Giving FastAPI services 3 seconds to complete initialization...")
time.sleep(3)
'

# Step 4: Seed WMS inventory data
echo -e "\n${YELLOW}Step 4: Seeding WMS inventory data...${NC}"
docker exec wms-api python seed.py

# Step 5: Run integration tests
echo -e "\n${YELLOW}Step 5: Running OMS-WMS E2E Integration Test...${NC}"
if python3 test_oms_wms.py; then
    echo -e "\n${GREEN}===============================================${NC}"
    echo -e "${GREEN}   SUCCESS: All services started & E2E passed  ${NC}"
    echo -e "${GREEN}===============================================${NC}"
    exit 0
else
    echo -e "\n${RED}===============================================${NC}"
    echo -e "${RED}   FAILURE: E2E Integration Test Failed        ${NC}"
    echo -e "${RED}===============================================${NC}"
    exit 1
fi
