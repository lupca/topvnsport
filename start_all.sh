#!/bin/bash
set -e

BUILD_IMAGES=0
RUN_TESTS=0
WATCH_MODE=0

print_usage() {
    echo "Usage: ./start_all.sh [--build|--no-build] [--watch|--no-watch] [--test]"
    echo "  --build      Rebuild Docker images before starting services"
    echo "  --no-build   Skip rebuild (faster startup, may run stale code)"
    echo "  --test    Run WMS seed + OMS-WMS E2E test after startup"
    echo "  --watch      Enable hot reload via Docker Compose watch"
    echo "  --no-watch   Disable hot reload watchers"
}

# Dev defaults: always refresh code at startup and keep auto-sync active.
BUILD_IMAGES=1
WATCH_MODE=1

for arg in "$@"; do
    case "$arg" in
        --build)
            BUILD_IMAGES=1
            ;;
        --no-build)
            BUILD_IMAGES=0
            ;;
        --test)
            RUN_TESTS=1
            ;;
        --watch)
            WATCH_MODE=1
            ;;
        --no-watch)
            WATCH_MODE=0
            ;;
        -h|--help)
            print_usage
            exit 0
            ;;
        *)
            echo "Unknown option: $arg"
            print_usage
            exit 1
            ;;
    esac
done

UP_ARGS=(-d)
if [[ $BUILD_IMAGES -eq 1 ]]; then
    UP_ARGS+=(--build)
fi

cleanup_watchers() {
    echo -e "\n${YELLOW}Stopping watch processes...${NC}"
    for pid in "${WATCH_PIDS[@]}"; do
        kill "$pid" 2>/dev/null || true
    done
}

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
docker network create identity_default || true
docker network create gateway_network || true

# Step 2: Build and start the projects using compose
echo -e "\n${YELLOW}Step 2: Starting services via Docker Compose...${NC}"

echo -e "${BLUE}Starting PMI...${NC}"
docker compose -f PMI/docker-compose.yml up "${UP_ARGS[@]}"

echo -e "${BLUE}Starting OMS (Development mode)...${NC}"
docker compose -f OMS/docker-compose.yml up "${UP_ARGS[@]}"

echo -e "${BLUE}Starting WMS (Development mode)...${NC}"
docker compose -f WMS/docker-compose.yml up "${UP_ARGS[@]}"

echo -e "${BLUE}Starting WEB (Development mode)...${NC}"
docker compose -f web/docker-compose.yml up "${UP_ARGS[@]}"

echo -e "${BLUE}Starting Gateway + Identity Service (Development mode)...${NC}"
docker compose -f gateway/docker-compose.yml up "${UP_ARGS[@]}"

# Step 3: Wait for services to be ready
echo -e "\n${YELLOW}Step 3: Waiting for APIs to respond...${NC}"
python3 -c '
import socket
import time
import sys

ports = {
    18100: "PMI API",
    18101: "OMS API",
    18102: "WMS API",
    18110: "Identity API",
    8080: "API Gateway"
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

# Step 4/5: Optional Seed + E2E tests
if [[ $RUN_TESTS -eq 1 ]]; then
    echo -e "\n${YELLOW}Step 4: Seeding WMS inventory data...${NC}"
    docker exec wms-api python seed.py

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
else
    echo -e "\n${GREEN}===============================================${NC}"
    echo -e "${GREEN}   SUCCESS: Services started in DEV mode       ${NC}"
    echo -e "${GREEN}===============================================${NC}"
    if [[ $WATCH_MODE -eq 1 ]]; then
        echo -e "\n${YELLOW}Step 6: Enabling hot reload watchers...${NC}"

        if ! docker compose watch --help >/dev/null 2>&1; then
            echo -e "${RED}Docker Compose watch is not available on this machine.${NC}"
            echo -e "${YELLOW}Please update Docker Compose or rerun with --no-watch.${NC}"
            exit 1
        fi

        WATCH_PIDS=()

        docker compose -f PMI/docker-compose.yml watch --no-up api frontend &
        WATCH_PIDS+=("$!")

        docker compose -f OMS/docker-compose.yml watch --no-up oms_backend oms_frontend &
        WATCH_PIDS+=("$!")

        docker compose -f WMS/docker-compose.yml watch --no-up wms-api wms_frontend &
        WATCH_PIDS+=("$!")

        docker compose -f web/docker-compose.yml watch --no-up web_frontend &
        WATCH_PIDS+=("$!")

        docker compose -f gateway/docker-compose.yml watch --no-up identity-api identity-frontend &
        WATCH_PIDS+=("$!")

        trap cleanup_watchers EXIT INT TERM
        echo -e "${GREEN}Hot reload is active.${NC} Keep this terminal open while coding."
        wait
    else
        echo -e "${YELLOW}Tip:${NC} You disabled hot reload with --no-watch."
        echo -e "${YELLOW}Tip:${NC} Use --test when you want seed + E2E validation."
    fi
fi
