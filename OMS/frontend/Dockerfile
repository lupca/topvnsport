FROM node:20-alpine

WORKDIR /workspace

# Copy packages
COPY packages ./packages

# Setup frontend
WORKDIR /workspace/OMS/frontend
COPY OMS/frontend/package.json ./

# Adjust paths for Docker
RUN sed -i 's|"file:../../packages|"file:/workspace/packages|g' package.json

RUN npm install

COPY OMS/frontend .

ENV DOCKER_ENV=true

# Build-time environment variables
ARG NEXT_PUBLIC_API_URL=http://localhost:18101
ARG NEXT_PUBLIC_OMS_API_URL=http://localhost:18101
ARG NEXT_PUBLIC_WMS_API_URL=http://localhost:18102
ARG NEXT_PUBLIC_IDENTITY_URL=http://localhost:13110

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_OMS_API_URL=$NEXT_PUBLIC_OMS_API_URL
ENV NEXT_PUBLIC_WMS_API_URL=$NEXT_PUBLIC_WMS_API_URL
ENV NEXT_PUBLIC_IDENTITY_URL=$NEXT_PUBLIC_IDENTITY_URL

RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]
