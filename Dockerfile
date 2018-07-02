FROM spearheadea/tsnode:8.9.4-slim-2.8.4

WORKDIR /app
COPY package.json /app/
COPY .gitignore .npmignore /app/
RUN npm i
RUN ls
COPY spec /app/spec
COPY src /app/src
COPY tsconfig.json gulpfile.js /app/
RUN npm run build
