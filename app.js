const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const app = express();
app.set('view engine', 'ejs');
app.set('views', './views');

const session = require('express-session');

let cart = []; // 儲存購物車的商品

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
app.post('/products/add' , async (req, res) => {
    if (!req.session.userId || !req.session.isSeller) {
        return res.status(403).send('只有賣家才能上傳商品');
    }

    const { name, price } = req.body;
    
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
app.post('/products/delete/:id', async (req, res) => {
    if (!req.session.userId || !req.session.isSeller) {
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
        res.redirect('/login'); // 移除 res.status(201).send('註冊成功');
    } catch (err) {
        console.error(err);
        res.status(500).send('伺服器錯誤');
    }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (user && await bcrypt.compare(password, user.password)) {
        req.session.userId = user._id; // 設置會話
        req.session.username = user.username; // 儲存用戶名到會話
        req.session.isSeller = user.isSeller; // 確保這行存在
        res.redirect('/'); // 登入成功後重定向到主頁
    } else {
        res.status(401).send('用戶名或密碼錯誤');
    }
});

app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send('登出失敗');
        }
        res.redirect('/'); // 移除 res.send('登出成功');
    });
    
});

app.post('/become-seller', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).send('請先登入');
    }

    try {
        await User.findByIdAndUpdate(req.session.userId, { isSeller: true }); // 將用戶標記為賣家
        res.redirect('/'); // 移除 res.send('恭喜你，現在你是賣家了！');
    } catch (err) {
        console.error(err);
        res.status(500).send('伺服器錯誤');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});