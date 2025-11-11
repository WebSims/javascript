# --- Stage 1: Build the app ---
    FROM node:22-alpine AS build

    WORKDIR /app
    COPY package*.json ./
    RUN npm ci
    COPY . .
    RUN npm run build
    
    # --- Stage 2: Serve the app ---
    FROM nginx:alpine
    
    # Copy built files to nginx html folder
    COPY --from=build /app/dist /usr/share/nginx/html
    
    EXPOSE 80
    
    # Optional: custom nginx config
    CMD ["nginx", "-g", "daemon off;"]
    