const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const app = express();

// 1. 数据库连接
const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017/drone_db';
mongoose.connect(mongoUrl).catch(err => console.log("DB Connection Error: ", err));

// 2. 数据模型 (增加 qrImage 字段支持裁剪图存储)
const CargoRecord = mongoose.model('CargoRecord', {
    cargoId: String,
    quantity: Number,
    location: { x: Number, y: Number, z: Number },
    envImage: String, // 全景图 Base64
    qrImage: String,  // 裁剪出的二维码 Base64
    timestamp: { type: Date, default: Date.now }
});

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 3. 页面路由
const renderPage = async (req, res, view, data) => {
    // 如果请求头包含 pjax 或 partial，说明是异步加载内容，不返回布局外壳
    if (req.headers['x-partial-content']) {
        res.render(view, { ...data, layout: false });
    } else {
        // 否则返回完整页面（包含 layout 逻辑）
        res.render(view, data);
    }
};

app.get('/', (req, res) => renderPage(req, res, 'index', { title: '仪表盘' }));
app.get('/camera', (req, res) => renderPage(req, res, 'camera', { title: '相机设置' }));
app.get('/database', async (req, res) => {
    try {
        const records = await CargoRecord.find().sort({ timestamp: -1 }).limit(100);
        renderPage(req, res, 'database', { title: '数据库记录', records });
    } catch (err) {
        res.status(500).send("DB Error");
    }
});

// 4. API 接口
// 存数据
app.post('/api/save-record', async (req, res) => {
    try {
        // 【防重复逻辑】防止同一二维码短时间内重复入库
        const existing = await CargoRecord.findOne({ 
            cargoId: req.body.cargoId,
            timestamp: { $gt: new Date(Date.now() - 5000) } // 5秒内不重复存同一货物
        });

        if (existing) {
            return res.json({ success: false, message: "重复扫描" });
        }

        const record = new CargoRecord(req.body);
        const result = await record.save();
        console.log("成功入库 ID:", req.body.cargoId);
        res.json({ success: true, id: result._id });
    } catch (err) {
        console.error("保存报错:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 删除指定记录的 API
app.delete('/api/delete-record/:id', async (req, res) => {
    try {
        const id = req.params.id;
        console.log(`=== 收到删除请求: ${id} ===`);
        
        // 执行删除
        const result = await CargoRecord.findByIdAndDelete(id);
        
        if (result) {
            console.log("删除成功");
            res.json({ success: true });
        } else {
            console.log("未找到该记录");
            res.status(404).json({ success: false, message: "记录不存在" });
        }
    } catch (err) {
        console.error("删除报错:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 供前端异步刷新使用的 API
app.get('/api/records', async (req, res) => {
    try {
        // 使用 .sort({ timestamp: -1 }) 确保最新的一条在最上面
        const records = await CargoRecord.find().sort({ timestamp: -1 }).limit(50);
        res.json(records);
    } catch (err) {
        res.status(500).json([]);
    }
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));