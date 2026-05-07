# 1. 使用官方 Node.js 镜像作为基础
FROM node:18-alpine

# 2. 设置容器内的默认工作目录
WORKDIR /app

# 3. 将 package.json 复制到容器中并安装依赖
COPY package.json ./
RUN npm install

# 4. 复制所有本地代码到容器中
COPY . .

# 5. 告诉 Docker 容器运行在 3000 端口
EXPOSE 3000

# 6. 启动命令
CMD ["node", "app.js"]