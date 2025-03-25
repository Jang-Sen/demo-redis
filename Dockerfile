FROM node:22-alpine AS development

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci

COPY . .

USER node

CMD ["npm", "run", "start:dev"]