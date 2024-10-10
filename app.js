const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken'); // 引入jsonwebtoken
const helmet = require('helmet');
const app = express();
app.set('view engine', 'ejs');
app.set('views', './views');

const session = require('express-session');
const cookieParser = require('cookie-parser');
app.use(cookieParser());

let cart = []; // 儲存購物車的商品

app.use(helmet());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'your_secret_key', // 用於加密會話的密鑰
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // 在開發環境中設置為 false
}));

// 連接到 MongoDB
mongoose.connect('mongodb+srv://tp6u3fu0:shepherdx1000@cluster0.vazi0.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0')
    .then(() => {
        console.log('MongoDB 連接成功');
    })
    .catch(err => {
        console.error('MongoDB 連接失敗:', err);
    });

// 定義商品模型
const productSchema = new mongoose.Schema({
    name: String,
    price: Number,
    image: String
});

const Product = mongoose.model('Product', productSchema);

// 設計用戶模型
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    isSeller: { type: Boolean, default: false } // 新增 isSeller 屬性，預設為 false
});

const User = mongoose.model('User', userSchema);

app.get('/', async (req, res) => {
    try {
        const products = await Product.find(); // 從資料庫中獲取商品
        const username = req.session.username || null; // 獲取會話中的用戶名
        const isSeller = req.session.isSeller || false; // 獲取會話中的賣家狀態，預設為 false
        res.render('index', { title: '歡迎來到線上商店', products, username, isSeller }); // 傳遞用戶名和賣家狀態到模板
    } catch (err) {
        console.error(err);
        res.status(500).send('伺服器錯誤');
    }
});

app.get('/login', (req, res) => {
    res.render('login', { title: '登入' });
});

app.get('/cart', (req, res) => {
    res.render('cart', { title: '購物車', cart });
});

app.post('/cart/add', (req, res) => {
    const productId = req.body.productId; // 不需要轉換為數字
    Product.findById(productId).then(product => {
        if (product) {
            const existingItem = cart.find(item => item.id === product.id);
            if (existingItem) {
                existingItem.quantity += 1;
            } else {
                cart.push({ ...product.toObject(), quantity: 1 });
            }
        }
        res.redirect('/cart');
    }).catch(err => {
        console.error(err);
        res.status(500).send('伺服器錯誤');
    });
});

app.post('/cart/clear', (req, res) => {
    cart = []; // 清空購物車
    res.redirect('/cart'); // 重新導向到購物車頁面
});

// 新增一個路由來插入商品資料
// app.post('/products/add' , async (req, res) => {
//     if (!req.session.userId || !req.session.isSeller) {
//         return res.status(403).send('只有賣家才能上傳商品');
//     }

//     const { name, price } = req.body;
    
//     const newProduct = new Product({ name, price, image });

//     try {
//         await newProduct.save();
//         res.status(201).send('商品已成功添加');
//     } catch (err) {
//         console.error(err);
//         res.status(500).send('伺服器錯誤');
//     }
// });
app.post('/products/add', authenticateJWT, async (req, res) => {
    if (!req.user.isSeller || !req.user.userId) {
        return res.status(403).send('只有賣家才能上傳商品');
    }

    const { name, price , image} = req.body;
    const newProduct = new Product({ name, price, image });

    try {
        await newProduct.save();
        res.status(201).send('商品已成功添加');
    } catch (err) {
        console.error(err);
        res.status(500).send('伺服器錯誤');
    }
});


// 刪除產品的路由
// app.post('/products/delete/:id', async (req, res) => {
//     if (!req.session.userId || !req.session.isSeller) {
//         return res.status(403).send('只有賣家才能刪除商品');
//     }

//     const productId = req.params.id; // 獲取產品 ID
//     try {
//         await Product.findByIdAndDelete(productId); // 刪除指定的產品
//         res.redirect('/'); // 重新導向到產品列表頁面
//     } catch (err) {
//         console.error(err);
//         res.status(500).send('伺服器錯誤');
//     }
// });
app.post('/products/delete/:id', authenticateJWT, async (req, res) => {
    if (!req.user.isSeller || !req.user.userId) {
        return res.status(403).send('只有賣家才能刪除商品');
    }

    const productId = req.params.id; // 獲取產品 ID
    try {
        await Product.findByIdAndDelete(productId); // 刪除指定的產品
        res.redirect('/'); // 重新導向到產品列表頁面
    } catch (err) {
        console.error(err);
        res.status(500).send('伺服器錯誤');
    }
});


app.get('/register', (req, res) => {
    res.render('register', { title: '註冊' }); // 渲染註冊頁面
});
// 註冊功能
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10); // 加密密碼

    const newUser = new User({ username, password: hashedPassword });
    try {
        await newUser.save();
        res.redirect('/login');
    } catch (err) {
        console.error(err);
        res.status(500).send('伺服器錯誤');
    }
});

// 登入功能
// app.post('/login', async (req, res) => {
//     const { username, password } = req.body;
//     const user = await User.findOne({ username });

//     if (user && await bcrypt.compare(password, user.password)) {
//         const token = jwt.sign({ userId: user._id, isSeller: user.isSeller }, 'your_jwt_secret', { expiresIn: '1h' }); // 生成JWT
//         res.cookie('token', token, { httpOnly: true }); // 將JWT存儲在cookie中
//         res.redirect('/');
//     } else {
//         res.status(401).send('用戶名或密碼錯誤');
//     }
// });
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (user && await bcrypt.compare(password, user.password)) {
        const token = jwt.sign({ userId: user._id, isSeller: user.isSeller }, 'your_jwt_secret', { expiresIn: '1h' }); // 生成JWT
        res.cookie('token', token, { httpOnly: true }); // 將JWT存儲在cookie中
        req.session.username = user.username; // 設置會話中的用戶名
        req.session.isSeller = user.isSeller; // 設置會話中的賣家狀態
        res.redirect('/');
    } else {
        res.status(401).send('用戶名或密碼錯誤');
    }
});

//JWT 驗證中間件
function authenticateJWT(req, res, next) {
    const token = req.cookies.token; // 從cookie中獲取token

    if (token) {
        jwt.verify(token, 'your_jwt_secret', (err, user) => {
            if (err) {
                return res.sendStatus(403);
            }
            req.user = user;
            next();
        });
    } else {
        res.sendStatus(401);
    }
}

app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send('登出失敗');
        }
        res.redirect('/'); // 移除 res.send('登出成功');
    });
    
});

// app.post('/become-seller', async (req, res) => {
//     if (!req.session.userId) {
//         return res.status(401).send('請先登入');
//     }

//     try {
//         await User.findByIdAndUpdate(req.session.userId, { isSeller: true }); // 將用戶標記為賣家
//         res.redirect('/'); // 移除 res.send('恭喜你，現在你是賣家了！');
//     } catch (err) {
//         console.error(err);
//         res.status(500).send('伺服器錯誤');
//     }
// });
app.post('/become-seller', authenticateJWT, async (req, res) => {
    if (!req.user.userId) {
        return res.status(401).send('請先登入');
    }

    try {
        await User.findByIdAndUpdate(req.user.userId, { isSeller: true }); // 將用戶標記為賣家
        res.redirect('/'); // 移除 res.send('恭喜你，現在你是賣家了！');
    } catch (err) {
        console.error(err);
        res.status(500).send('伺服器錯誤');
    }
});

const rateLimit = require('express-rate-limit'); // 引入 express-rate-limit
// 設置速率限制
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 分鐘
    max: 100, // 每個 IP 最多可以在 15 分鐘內發送 100 次請求
    message: '請求過於頻繁，請稍後再試。' // 超過限制時的回應消息
});

app.use(limiter); // 在所有路由之前使用速率限制中間件


// const PORT = 3001;
// app.listen(PORT, () => {
//     console.log(`Server is running on port ${PORT}`);
// });

const https = require('https');
const fs = require('fs');

const options = {
    key: fs.readFileSync('server.key'),
    cert: fs.readFileSync('server.cert')
};

const server = https.createServer(options, app);

server.listen(3001, () => {
    console.log('HTTPS 伺服器正在運行，端口 3001');
});