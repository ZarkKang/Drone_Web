const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('<h1>你好！这是运行在 Docker 容器里的 Web 服务器</h1>');
});

app.listen(3000, () => {
  console.log('服务器运行在端口 3000');
});