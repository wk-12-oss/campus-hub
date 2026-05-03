const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const Database = require('better-sqlite3');

const app = express();
app.use(cors());
app.use(express.static(__dirname));
app.use(bodyParser.json({ limit: '50mb' })); // 支持大图片传输

// 打开/创建数据库文件
const db = new Database('campus.db');

// 建表（如果表不存在则自动创建）
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    phone TEXT PRIMARY KEY,
    password TEXT NOT NULL,
    school TEXT,
    user_id TEXT UNIQUE,
    is_admin INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS user_profiles (
    phone TEXT PRIMARY KEY,
    nickname TEXT,
    gender TEXT DEFAULT '保密',
    bio TEXT DEFAULT '',
    avatar TEXT DEFAULT 'https://randomuser.me/api/portraits/lego/1.jpg',
    FOREIGN KEY (phone) REFERENCES users(phone)
  );

  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT,
    images TEXT,
    video TEXT,
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    is_top INTEGER DEFAULT 0,
    author_id TEXT,
    author_nickname TEXT,
    liked_by TEXT DEFAULT '[]',
    collected_by TEXT DEFAULT '[]',
    shared_by TEXT DEFAULT '[]',
    created_at TEXT,
    timestamp INTEGER
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER,
    user_id TEXT,
    content TEXT,
    image TEXT,
    created_at TEXT,
    parent_id INTEGER DEFAULT 0,
    FOREIGN KEY (post_id) REFERENCES posts(id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_phone TEXT,
    message TEXT,
    read_status INTEGER DEFAULT 0,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS express_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    num TEXT,
    school TEXT,
    type TEXT DEFAULT '普通',
    status TEXT DEFAULT '待取',
    location TEXT,
    reward TEXT,
    address TEXT,
    receive_time TEXT,
    receiver_name TEXT,
    receiver_phone TEXT,
    publisher_phone TEXT,
    taker_phone TEXT
  );

  CREATE TABLE IF NOT EXISTS secondhand_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school TEXT,
    name TEXT,
    price TEXT,
   [desc] TEXT,
    seller_nickname TEXT,
    media TEXT,
    publisher_phone TEXT,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS repairs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school TEXT,
    desc TEXT,
    status TEXT DEFAULT '处理中',
    date TEXT,
    reporter_phone TEXT
  );

  CREATE TABLE IF NOT EXISTS reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school TEXT,
    venue_name TEXT,
    person TEXT,
    student_id TEXT,
    date TEXT,
    start_time TEXT,
    duration INTEGER,
    persons INTEGER
  );
`);

// ========== 工具函数 ==========
function generateUserId() {
  const last = db.prepare('SELECT user_id FROM users ORDER BY user_id DESC LIMIT 1').get();
  if (!last) return '000001';
  const num = parseInt(last.user_id, 10) + 1;
  return String(num).padStart(6, '0');
}

// ========== 用户注册 ==========
app.post('/api/register', (req, res) => {
  const { phone, password, school } = req.body;
  if (!phone || !password || !school) return res.json({ success: false, msg: '信息不完整' });

  const exist = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  if (exist) return res.json({ success: false, msg: '手机号已注册' });

  const userId = generateUserId();
  db.prepare('INSERT INTO users (phone, password, school, user_id) VALUES (?,?,?,?)').run(phone, password, school, userId);
  db.prepare('INSERT INTO user_profiles (phone, nickname) VALUES (?,?)').run(phone, phone);

  res.json({ success: true, phone, school, isAdmin: false, userId });
});

// ========== 用户登录 ==========
app.post('/api/login', (req, res) => {
  const { phone, password } = req.body;
  const ADMIN_PHONE = '12345678910';
  const ADMIN_PWD = 'qwertyuiopasdfghjkl';

  if (phone === ADMIN_PHONE && password === ADMIN_PWD) {
    return res.json({ success: true, phone, isAdmin: true, school: 'gznj', userId: '000000' });
  }

  const user = db.prepare('SELECT * FROM users WHERE phone = ? AND password = ?').get(phone, password);
  if (!user) return res.json({ success: false, msg: '账号或密码错误' });

  res.json({ success: true, phone: user.phone, school: user.school, isAdmin: !!user.is_admin, userId: user.user_id });
});

// ========== 获取用户资料 ==========
app.get('/api/profile/:phone', (req, res) => {
  const profile = db.prepare('SELECT * FROM user_profiles WHERE phone = ?').get(req.params.phone);
  if (profile) {
    res.json(profile);
  } else {
    res.json({ nickname: req.params.phone, avatar: 'https://randomuser.me/api/portraits/lego/1.jpg', bio: '', gender: '保密' });
  }
});

// ========== 更新用户资料 ==========
app.put('/api/profile/:phone', (req, res) => {
  const { nickname, gender, bio, avatar } = req.body;
  const phone = req.params.phone;
  const exist = db.prepare('SELECT * FROM user_profiles WHERE phone = ?').get(phone);
  if (exist) {
    db.prepare('UPDATE user_profiles SET nickname=?, gender=?, bio=?, avatar=? WHERE phone=?').run(nickname, gender, bio, avatar, phone);
  } else {
    db.prepare('INSERT INTO user_profiles (phone, nickname, gender, bio, avatar) VALUES (?,?,?,?,?)').run(phone, nickname, gender, bio, avatar);
  }
  res.json({ success: true });
});

// ========== 获取所有帖子 ==========
app.get('/api/posts', (req, res) => {
  const posts = db.prepare('SELECT * FROM posts ORDER BY is_top DESC, timestamp DESC').all();
  // 将字符串字段转回数组格式，方便前端使用
  const formatted = posts.map(p => ({
    ...p,
    likedBy: JSON.parse(p.liked_by || '[]'),
    collectedBy: JSON.parse(p.collected_by || '[]'),
    sharedBy: JSON.parse(p.shared_by || '[]'),
    images: p.images ? p.images.split(',') : [],
    comments: []  // 评论单独获取，这里先空着
  }));
  res.json(formatted);
});

// ========== 获取单个帖子 ==========
app.get('/api/posts/:id', (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.json({ success: false, msg: '不存在' });

  post.likedBy = JSON.parse(post.liked_by || '[]');
  post.collectedBy = JSON.parse(post.collected_by || '[]');
  post.sharedBy = JSON.parse(post.shared_by || '[]');
  post.images = post.images ? post.images.split(',') : [];

  const comments = db.prepare('SELECT * FROM comments WHERE post_id = ? ORDER BY id ASC').all(req.params.id);
  // 组装回复
  const topComments = [];
  const repliesMap = {};
  comments.forEach(c => {
    if (c.parent_id === 0) {
      c.replies = [];
      topComments.push(c);
      repliesMap[c.id] = c;
    } else {
      if (repliesMap[c.parent_id]) {
        repliesMap[c.parent_id].replies.push(c);
      }
    }
  });
  post.comments = topComments;
  res.json({ post, comments: topComments });
});

// ========== 发布帖子 ==========
app.post('/api/posts', (req, res) => {
  const { title, content, images, video, author_id, author_nickname } = req.body;
  if (!title) return res.json({ success: false, msg: '标题不能为空' });

  const now = new Date().toLocaleDateString();
  const ts = Date.now();
  const imageStr = Array.isArray(images) ? images.join(',') : (images || '');

  const result = db.prepare(`
    INSERT INTO posts (title, content, images, video, author_id, author_nickname, created_at, timestamp)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(title, content, imageStr, video || '', author_id, author_nickname, now, ts);

  res.json({ success: true, postId: result.lastInsertRowid });
});

// ========== 点赞/取消点赞 ==========
app.post('/api/posts/:id/like', (req, res) => {
  const { userId, action } = req.body; // action: 'add' 或 'remove'
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.json({ success: false, msg: '帖子不存在' });

  let likedBy = JSON.parse(post.liked_by || '[]');
  let likeCount = post.like_count;

  if (action === 'add' && !likedBy.includes(userId)) {
    likedBy.push(userId);
    likeCount++;
  } else if (action === 'remove') {
    likedBy = likedBy.filter(u => u !== userId);
    if (likeCount > 0) likeCount--;
  }

  db.prepare('UPDATE posts SET like_count = ?, liked_by = ? WHERE id = ?').run(likeCount, JSON.stringify(likedBy), req.params.id);
  res.json({ success: true, likeCount, likedBy });
});

// ========== 收藏/取消收藏 ==========
app.post('/api/posts/:id/collect', (req, res) => {
  const { userId, action } = req.body;
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.json({ success: false, msg: '帖子不存在' });

  let collectedBy = JSON.parse(post.collected_by || '[]');
  if (action === 'add' && !collectedBy.includes(userId)) {
    collectedBy.push(userId);
  } else if (action === 'remove') {
    collectedBy = collectedBy.filter(u => u !== userId);
  }

  db.prepare('UPDATE posts SET collected_by = ? WHERE id = ?').run(JSON.stringify(collectedBy), req.params.id);
  res.json({ success: true, collectedBy });
});

// ========== 分享 ==========
app.post('/api/posts/:id/share', (req, res) => {
  const { userId } = req.body;
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.json({ success: false, msg: '帖子不存在' });

  let sharedBy = JSON.parse(post.shared_by || '[]');
  if (!sharedBy.includes(userId)) {
    sharedBy.push(userId);
    db.prepare('UPDATE posts SET shared_by = ? WHERE id = ?').run(JSON.stringify(sharedBy), req.params.id);
  }
  res.json({ success: true, sharedBy });
});

// ========== 评论 ==========
app.post('/api/posts/:id/comments', (req, res) => {
  const { user_id, content, image, parent_id } = req.body;
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.json({ success: false, msg: '帖子不存在' });

  const now = new Date().toLocaleString();
  db.prepare('INSERT INTO comments (post_id, user_id, content, image, created_at, parent_id) VALUES (?,?,?,?,?,?)')
    .run(req.params.id, user_id, content, image || '', now, parent_id || 0);

  // 更新评论总数
  const totalComments = db.prepare('SELECT COUNT(*) as cnt FROM comments WHERE post_id = ?').get(req.params.id).cnt;
  db.prepare('UPDATE posts SET comment_count = ? WHERE id = ?').run(totalComments, req.params.id);

  res.json({ success: true });
});

// ========== 删除帖子（只有作者或管理员可删） ==========
app.delete('/api/posts/:id', (req, res) => {

  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.json({ success: false, msg: '帖子不存在' });
  // 简化：不做权限校验，前端已经做了
  db.prepare('DELETE FROM comments WHERE post_id = ?').run(req.params.id);
  db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ========== 快递相关 ==========
app.get('/api/express/:school', (req, res) => {
  const orders = db.prepare("SELECT * FROM express_orders WHERE school = ? AND status != '已接单'").all(req.params.school);
  res.json(orders);
});

app.post('/api/express', (req, res) => {
  try {
    const { school, num, reward, address, receive_time, receiver_name, receiver_phone, publisher_phone } = req.body;
    // 为可能缺失的字段提供默认值
    const location = req.body.location || '';
    const type = req.body.type || '普通';
    const status = '待取';
    const taker_phone = '';

    db.prepare(`INSERT INTO express_orders 
      (school, num, type, status, location, reward, address, receive_time, receiver_name, receiver_phone, publisher_phone, taker_phone) 
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(school, num, type, status, location, reward, address, receive_time || '', receiver_name, receiver_phone, publisher_phone, taker_phone);

    res.json({ success: true });
  } catch (error) {
    console.error('快递发布失败:', error.message);
    res.status(500).json({ success: false, msg: error.message });
  }
});
app.put('/api/express/:id/take', (req, res) => {
  const { taker_phone } = req.body;
  db.prepare("UPDATE express_orders SET status = '已接单', taker_phone = ? WHERE id = ?").run(taker_phone, req.params.id);
  res.json({ success: true });
});

app.delete('/api/express/:id', (req, res) => {
  db.prepare('DELETE FROM express_orders WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ========== 学校搜索 ==========
app.get('/api/schools', (req, res) => {
  const keyword = req.query.keyword || '';
  if (!keyword.trim()) return res.json([]);

  const results = db.prepare(
    `SELECT name, school FROM schools WHERE name LIKE ? LIMIT 15`
  ).all(`%${keyword}%`);

  res.json(results);
});
// ========== 二手交易 ==========
app.get('/api/secondhand/:school', (req, res) => {
  const items = db.prepare('SELECT * FROM secondhand_items WHERE school = ? ORDER BY id DESC').all(req.params.school);
  res.json(items);
});

app.post('/api/secondhand', (req, res) => {
  try {
    const { school, name, price, desc, seller_nickname, media, publisher_phone } = req.body;
    db.prepare(`INSERT INTO secondhand_items (school, name, price, [desc], seller_nickname, media, publisher_phone, created_at) VALUES (?,?,?,?,?,?,?, datetime('now'))`)
      .run(school, name, price, desc || '', seller_nickname, media || '', publisher_phone);
    res.json({ success: true });
  } catch (error) {
    console.error('二手发布失败:', error.message);
    res.status(500).json({ success: false, msg: error.message });
  }
});

app.delete('/api/secondhand/:id', (req, res) => {
  db.prepare('DELETE FROM secondhand_items WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ========== 报修 ==========
app.get('/api/repairs/:school', (req, res) => {
  const list = db.prepare('SELECT * FROM repairs WHERE school = ? ORDER BY date DESC').all(req.params.school);
  res.json(list);
});

app.post('/api/repairs', (req, res) => {
  const { school, desc, reporter_phone } = req.body;
  const date = new Date().toLocaleDateString();
  db.prepare('INSERT INTO repairs (school, desc, status, date, reporter_phone) VALUES (?,?,"处理中",?,?)').run(school, desc, date, reporter_phone);
  res.json({ success: true });
});

// ========== 场馆预约 ==========
app.post('/api/reservations', (req, res) => {
  const { school, venue_name, person, student_id, date, start_time, duration, persons } = req.body;
  db.prepare('INSERT INTO reservations (school, venue_name, person, student_id, date, start_time, duration, persons) VALUES (?,?,?,?,?,?,?,?)')
    .run(school, venue_name, person, student_id, date, start_time, duration, persons);
  // 同时增加已预约人数（可选，这里简化，前端自行维护计数）
  res.json({ success: true });
});

// ========== 启动服务 ==========
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`✅ 后端运行在 http://localhost:${PORT}`);
});
db.prepare('UPDATE posts SET view_count = 555, like_count = 56 WHERE id = 3').run();
console.log('修改完成');
db.prepare('UPDATE posts SET view_count = 366, like_count = 76 WHERE id = 4').run();
console.log('修改完成');
db.prepare('UPDATE posts SET view_count = 974, like_count = 312 WHERE id = 5').run();
console.log('修改完成');
