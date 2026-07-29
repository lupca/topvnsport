FROM node:20-alpine AS build

WORKDIR /workspace

# Copy packages
COPY packages ./packages

# Setup web
WORKDIR /workspace/web
COPY web/package.json ./

# Adjust paths for Docker
RUN sed -i 's|"file:../packages|"file:/workspace/packages|g' package.json

ARG VITE_PMI_API_URL=http://localhost:18100
ARG VITE_OMS_API_URL=http://localhost:18101
ARG VITE_WMS_API_URL=http://localhost:18102
ENV VITE_PMI_API_URL=$VITE_PMI_API_URL
ENV VITE_OMS_API_URL=$VITE_OMS_API_URL
ENV VITE_WMS_API_URL=$VITE_WMS_API_URL
ENV DOCKER_ENV=true

RUN npm install

COPY web .
RUN npm run build

FROM nginx:1.27-alpine

COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/web/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
