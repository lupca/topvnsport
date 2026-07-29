FROM node:20-alpine

WORKDIR /workspace

# Copy packages and install their deps
COPY packages ./packages
WORKDIR /workspace/packages/ui-kit
RUN npm install --omit=dev
WORKDIR /workspace/packages/api-client
RUN npm install --omit=dev

# Setup frontend
WORKDIR /workspace/WMS/frontend
COPY WMS/frontend/package.json ./

# Adjust paths for Docker
RUN sed -i 's|"file:../../packages|"file:/workspace/packages|g' package.json

RUN npm install

COPY WMS/frontend .

ENV DOCKER_ENV=true

# Build-time environment variables
ARG NEXT_PUBLIC_API_URL=http://localhost:18102
ARG NEXT_PUBLIC_WMS_API_URL=http://localhost:18102
ARG NEXT_PUBLIC_PMI_API_URL=http://localhost:18100
ARG NEXT_PUBLIC_IDENTITY_URL=http://localhost:13110

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WMS_API_URL=$NEXT_PUBLIC_WMS_API_URL
ENV NEXT_PUBLIC_PMI_API_URL=$NEXT_PUBLIC_PMI_API_URL
ENV NEXT_PUBLIC_IDENTITY_URL=$NEXT_PUBLIC_IDENTITY_URL

RUN npm run build

EXPOSE 3002

CMD ["npm", "start"]
