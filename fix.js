const fs = require('fs');
const path = require('path');
function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx')) {
      results.push(file);
    }
  });
  return results;
}
const files = walk('c:/Users/Alfie Lynard/OneDrive/Desktop/Chainbudgets/frontend/src/app/dashboard');
let count = 0;
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('?? String(orgRef)')) {
    content = content.replace(/typeof orgRef === "string" \? orgRef : \(orgRef as any\)\?\._id \?\? String\(orgRef\)/g, 'orgRef ? (typeof orgRef === "string" ? orgRef : (orgRef as any)._id || "") : ""');
    fs.writeFileSync(file, content);
    count++;
    console.log('Fixed:', file);
  }
});
console.log('Total fixed:', count);
