FROM node:20-alpine

WORKDIR /workspace

# Copy packages and install their deps
COPY packages ./packages
WORKDIR /workspace/packages/ui-kit
RUN npm install
WORKDIR /workspace/packages/api-client
RUN npm install

# Copy and setup frontend
WORKDIR /workspace/PMI/frontend
COPY PMI/frontend/package.json ./

# Adjust package.json for Docker paths
RUN sed -i 's|"file:../../packages|"file:/workspace/packages|g' package.json

RUN npm install

# Copy frontend source
COPY PMI/frontend .

ENV DOCKER_ENV=true

EXPOSE 3000

CMD ["npm", "run", "dev"]
