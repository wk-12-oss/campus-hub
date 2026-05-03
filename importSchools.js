const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const db = new Database(path.join(__dirname, 'campus.db'));

// 创建学校表（如果不存在）
db.exec(`CREATE TABLE IF NOT EXISTS schools (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  school TEXT NOT NULL UNIQUE
)`);

// 读取 JSON 文件
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'schools.json'), 'utf-8'));

// 清空旧数据，重新导入（防止重复）
db.prepare('DELETE FROM schools').run();

const insert = db.prepare('INSERT OR IGNORE INTO schools (name, school) VALUES (?, ?)');
const insertMany = db.transaction((schools) => {
  for (const s of schools) {
    insert.run(s.name, s.school);
  }
});

insertMany(data);
console.log(`✅ 成功导入 ${data.length} 所学校`);
process.exit();