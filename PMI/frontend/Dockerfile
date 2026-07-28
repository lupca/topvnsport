FROM node:20-alpine

WORKDIR /workspace

# Copy pre-built packages
COPY packages ./packages

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
