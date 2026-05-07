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
app.get('/', (req, res) => res.render('index', { title: '无人机监控仪表盘' }));
app.get('/camera', (req, res) => res.render('camera', { title: '相机设置' }));

// 【重要修复】合并后的数据库页面路由，确保 records 被正确传入
app.get('/database', async (req, res) => {
    try {
        const records = await CargoRecord.find().sort({ timestamp: -1 }).limit(100);
        console.log(`[路由] 渲染数据库页面，记录数: ${records.length}`);
        res.render('database', { 
            title: '数据库记录', 
            records: records 
        });
    } catch (err) {
        console.error("数据库查询失败:", err);
        res.status(500).send("数据库查询失败");
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
        const records = await CargoRecord.find().sort({ timestamp: -1 });
        res.json(records); // 必须返回 JSON 数组
    } catch (err) {
        console.error("API Error:", err);
        res.status(500).json({ error: "数据库查询失败" });
    }
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));