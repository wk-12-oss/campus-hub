const fs = require('fs');
const path = require('path');

// 1. 读取原始的、有错误的文件
const rawData = fs.readFileSync(path.join(__dirname, 'schools.json'), 'utf-8');

// 2. 关键修复：把文件中可能缺失的 "]" 补上，使其成为一个合法的数组
//    你的文件中，第一个数组结束后没有 "]" 就直接开始了第二个数组，这里做一下处理。
const fixedData = rawData
    .replace(/\}\s*\{\s*"name"/g, '},\n{"name"') // 修复可能缺失的逗号
    .replace(/\]\s*\[/g, ',') // 把多个数组合并成一个
    .replace(/^\s*\[/, '[') // 确保开头是 [
    .replace(/\s*\]\s*$/, ']'); // 确保结尾是 ]

let schools;
try {
    schools = JSON.parse(fixedData);
} catch (e) {
    console.error('JSON文件格式仍然有无法修复的错误，请检查原始文件。', e.message);
    process.exit(1);
}

// 3. 根据 "school" 字段去重（保留第一个出现的）
const uniqueSchools = [];
const seen = new Set();

schools.forEach(s => {
    if (!seen.has(s.school)) {
        seen.add(s.school);
        uniqueSchools.push(s);
    }
});

// 4. 过滤：排除贵州省的所有学校（以 'gz' 开头的 code 或者 name 包含 "贵州"）
const filteredSchools = uniqueSchools.filter(s => {
    const isGuiZhou = s.school.startsWith('gz') || s.name.includes('贵州');
    return !isGuiZhou;
});

// 5. 排序 (按拼音排序，方便查找)
filteredSchools.sort((a, b) => a.school.localeCompare(b.school, 'zh'));

// 6. 写入干净的新文件
fs.writeFileSync(
    path.join(__dirname, 'schools.json'),
    JSON.stringify(filteredSchools, null, 2),
    'utf-8'
);

console.log(`✅ 完成！已生成干净的 schools.json ，共 ${filteredSchools.length} 所学校。`);