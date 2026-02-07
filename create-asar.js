const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const asarPath = path.join(__dirname, 'node_modules', '@electron', 'asar', 'bin', 'asar.js');
const tempDir = path.join(__dirname, 'app-temp-for-asar');
const outputAsar = path.join(__dirname, 'release', 'win-unpacked', 'resources', 'app.asar');

// 清理并创建临时目录
if (fs.existsSync(tempDir)) {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
fs.mkdirSync(tempDir, { recursive: true });

// 复制必要文件
console.log('复制文件到临时目录...');
['dist', 'dist-electron', 'package.json'].forEach(item => {
  const src = path.join(__dirname, item);
  const dest = path.join(tempDir, item);
  if (fs.existsSync(src)) {
    if (fs.statSync(src).isDirectory()) {
      fs.cpSync(src, dest, { recursive: true });
    } else {
      fs.copyFileSync(src, dest);
    }
    console.log(`  ✓ ${item}`);
  }
});

// 创建 app.asar
console.log('\n创建 app.asar...');
try {
  const resourcesDir = path.dirname(outputAsar);
  if (!fs.existsSync(resourcesDir)) {
    fs.mkdirSync(resourcesDir, { recursive: true });
  }
  execSync(`node "${asarPath}" pack "${tempDir}" "${outputAsar}"`, { stdio: 'inherit' });
  
  if (fs.existsSync(outputAsar)) {
    const stats = fs.statSync(outputAsar);
    console.log(`\n✓ app.asar 创建成功！`);
    console.log(`  大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  位置: ${outputAsar}`);
  } else {
    console.error('✗ app.asar 创建失败');
    process.exit(1);
  }
} catch (error) {
  console.error('创建 app.asar 时出错:', error.message);
  process.exit(1);
} finally {
  // 清理临时目录
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

console.log('\n完成！目录版本已准备就绪。');
console.log('运行方式：双击 release\\win-unpacked\\electron.exe');

