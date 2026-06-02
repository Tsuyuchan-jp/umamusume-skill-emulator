const fs = require('fs');
const dump = JSON.parse(fs.readFileSync('./dump.json', 'utf8'));

// my_dump.json を取得するため、テストスクリプト上で出力させる。
// 代わりに、ここでRaceSimulator.jsを動かしたいが、TSなのでコンパイルが必要。
// vitestでコンソール出力をする。
