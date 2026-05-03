const Database = require('better-sqlite3');
const path = require('path');

// 打开数据库（和 server.js 用同一个文件）
const db = new Database(path.join(__dirname, 'campus.db'));

// 插入管理员用户（如果手机号已存在，先删掉避免冲突）
db.prepare('DELETE FROM users WHERE phone = ?').run('15187492838');
db.prepare('DELETE FROM user_profiles WHERE phone = ?').run('15187492838');

db.prepare(`INSERT INTO users (phone, password, school, user_id, is_admin) VALUES (?, ?, ?, ?, ?)`)
  .run('15187492838', 'qwertyuiopasdfghjklzxcvb', 'gznj', '999999', 1);

db.prepare(`INSERT INTO user_profiles (phone, nickname) VALUES (?, ?)`)
  .run('15187492838', '管理员');

console.log('✅ 管理员账号创建成功！手机号: 15187492838');
process.exit();